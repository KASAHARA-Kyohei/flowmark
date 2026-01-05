import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { parseMarkdown, runParserSelfCheck, type Task } from '@/parser/parseMarkdown';
import { loadMarkdown, saveMarkdown } from '@/storage/persistence';
import { todayISO } from '@/utils/date';
import { EditorPane } from '@/ui/EditorPane';
import { SplitPane } from '@/ui/SplitPane';
import { Tabs, type TabItem, type ViewKey } from '@/ui/Tabs';
import { TaskList } from '@/ui/TaskList';

type Monaco = typeof import('monaco-editor');

const DEFAULT_MARKDOWN = [
  '# Inbox',
  '- [ ] welcome to Flowmark  @today  #flow  !high  ~10m',
  '- [ ] try: Cmd/Ctrl+Enter to toggle the current line',
  '- buy milk',
  '',
  '# Today',
  '- [ ] ship MVP @today @15:00 !!!',
  ''
].join('\n');

function toggleTaskLineCheckbox(line: string): string | null {
  if (!line.startsWith('- ')) return null;

  if (line.startsWith('- [ ] ')) return line.replace(/^- \[ \] /, '- [x] ');
  if (line.startsWith('- [x] ')) return line.replace(/^- \[x\] /, '- [ ] ');
  if (line.startsWith('- [X] ')) return line.replace(/^- \[X\] /, '- [ ] ');

  // No checkbox: insert a checked box (toggle = complete).
  return line.replace(/^- /, '- [x] ');
}

function toggleMarkdownAtTask(markdown: string, task: Task): string {
  const lines = markdown.split(/\r?\n/);
  const index = task.lineNumber - 1;
  const lineText = lines[index];
  if (lineText === undefined) return markdown;

  const next = toggleTaskLineCheckbox(lineText);
  if (!next) return markdown;

  lines[index] = next;
  return lines.join('\n');
}

function analyzeDashLine(line: string): { continuePrefix: string; isEmptyItem: boolean } | null {
  const match = /^(\s*)-\s+(.*)$/.exec(line);
  if (!match) return null;

  const indent = match[1] ?? '';
  let rest = match[2] ?? '';

  let hasCheckbox = false;
  if (rest.startsWith('[ ]')) {
    hasCheckbox = true;
    rest = rest.slice(3);
  } else if (rest.startsWith('[x]') || rest.startsWith('[X]')) {
    hasCheckbox = true;
    rest = rest.slice(3);
  }
  if (rest.startsWith(' ')) rest = rest.slice(1);

  const isEmptyItem = rest.trim().length === 0;
  const continuePrefix = hasCheckbox ? `${indent}- [ ] ` : `${indent}- `;

  return { continuePrefix, isEmptyItem };
}

function exportMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function App(): React.ReactElement {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [hydrated, setHydrated] = useState(false);

  const [tab, setTab] = useState<ViewKey>('inbox');
  const [celebrateTaskId, setCelebrateTaskId] = useState<string | undefined>(undefined);

  const [tasks, setTasks] = useState<Task[]>(() => {
    return parseMarkdown(DEFAULT_MARKDOWN, { now: new Date() }).tasks;
  });
  const [sections, setSections] = useState<string[]>(() => {
    return parseMarkdown(DEFAULT_MARKDOWN, { now: new Date() }).sections;
  });
  const [headings, setHeadings] = useState<string[]>(() => {
    return parseMarkdown(DEFAULT_MARKDOWN, { now: new Date() }).headings;
  });

  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const prevCompletedRef = useRef<Map<string, boolean>>(new Map());

  const isEmptyMarkdown = markdown.trim().length === 0;
  const hasAnyHeading = headings.length > 0;

  // Load persisted markdown on startup.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadMarkdown();
      if (cancelled) return;
      if (stored && stored.length > 0) setMarkdown(stored);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Parser self-check (DEV only).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      runParserSelfCheck();
      console.info('[flowmark] parser self-check: OK');
    } catch (error) {
      console.error('[flowmark] parser self-check: FAILED', error);
    }
  }, []);

  // Parse on each edit (debounced 150ms).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const parsed = parseMarkdown(markdown, { now: new Date() });
      setTasks(parsed.tasks);
      setSections(parsed.sections);
      setHeadings(parsed.headings);
    }, 150);

    return () => window.clearTimeout(handle);
  }, [markdown]);

  // Persist on each edit (debounced 300ms).
  useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      void saveMarkdown(markdown);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [markdown, hydrated]);

  // Celebrate when a task flips from incomplete -> completed.
  useEffect(() => {
    const prev = prevCompletedRef.current;
    let newlyCompletedId: string | undefined;

    for (const task of tasks) {
      const was = prev.get(task.id);
      if (was === false && task.completed === true) {
        newlyCompletedId = task.id;
        break;
      }
    }

    prevCompletedRef.current = new Map(tasks.map((t) => [t.id, t.completed]));

    if (!newlyCompletedId) return;
    setCelebrateTaskId(newlyCompletedId);
    const handle = window.setTimeout(() => setCelebrateTaskId(undefined), 700);
    return () => window.clearTimeout(handle);
  }, [tasks]);

  // When markdown is empty, keep the UI in a sane state.
  useEffect(() => {
    if (!isEmptyMarkdown) return;
    if (tab !== 'all') setTab('all');
  }, [isEmptyMarkdown, tab]);

  useEffect(() => {
    if (isEmptyMarkdown) return;

    const inboxVisible = !hasAnyHeading || headings.includes('Inbox');
    const todayVisible = !hasAnyHeading || headings.includes('Today');

    if ((tab === 'inbox' && !inboxVisible) || (tab === 'today' && !todayVisible)) {
      setTab('all');
    }
  }, [hasAnyHeading, headings, isEmptyMarkdown, tab]);

  // Keyboard shortcuts: focus editor / list.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.key === '1') {
        event.preventDefault();
        editorRef.current?.focus();
      }
      if (event.key === '2') {
        event.preventDefault();
        listRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const nowTodayISO = todayISO();

  const inboxTasks = useMemo(() => tasks.filter((t) => t.section === 'Inbox'), [tasks]);
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.section === 'Today' || t.due === nowTodayISO),
    [tasks, nowTodayISO]
  );
  const allTasks = tasks;

  const tabItems = useMemo((): TabItem[] => {
    if (isEmptyMarkdown) {
      return [{ key: 'all', label: 'All', count: allTasks.length }];
    }

    const inboxVisible = !hasAnyHeading || headings.includes('Inbox');
    const todayVisible = !hasAnyHeading || headings.includes('Today');

    const base: TabItem[] = [
      ...(inboxVisible ? [{ key: 'inbox' as const, label: 'Inbox', count: inboxTasks.length }] : []),
      ...(todayVisible ? [{ key: 'today' as const, label: 'Today', count: todayTasks.length }] : [])
    ];

    const extras: TabItem[] = sections
      .filter((s) => s !== 'Inbox' && s !== 'Today')
      .map((section) => ({
        key: `section:${section}` as const,
        label: section,
        count: tasks.filter((t) => t.section === section).length
      }));

    return [...base, ...extras, { key: 'all', label: 'All', count: allTasks.length }];
  }, [
    allTasks.length,
    hasAnyHeading,
    headings,
    inboxTasks.length,
    isEmptyMarkdown,
    sections,
    tasks,
    todayTasks.length
  ]);

  const viewTasks = useMemo(() => {
    if (tab === 'inbox') return inboxTasks;
    if (tab === 'today') return todayTasks;
    if (tab === 'all') return allTasks;

    const match = /^section:(.*)$/.exec(tab);
    if (!match) return allTasks;
    const section = match[1];
    return tasks.filter((t) => t.section === section);
  }, [allTasks, inboxTasks, tab, tasks, todayTasks]);

  const onMountEditor = (
    editor: import('monaco-editor').editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;

      const lineNumber = position.lineNumber;
      const lineText = model.getLineContent(lineNumber);
      const nextLine = toggleTaskLineCheckbox(lineText);
      if (!nextLine) return;

      const range = new monaco.Range(lineNumber, 1, lineNumber, lineText.length + 1);
      editor.executeEdits('flowmark.toggleCheckbox', [{ range, text: nextLine }]);
    });

    editor.onKeyDown((e) => {
      if (e.keyCode !== monaco.KeyCode.Enter) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;

      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) return;

      const lineNumber = position.lineNumber;
      const lineText = model.getLineContent(lineNumber);
      const atEnd = position.column === lineText.length + 1;
      if (!atEnd) return;

      const analyzed = analyzeDashLine(lineText);
      if (!analyzed) return;

      e.preventDefault();
      e.stopPropagation();

      if (analyzed.isEmptyItem) {
        const range = new monaco.Range(lineNumber, 1, lineNumber, lineText.length + 1);
        editor.executeEdits('flowmark.endDash', [{ range, text: '' }]);
        editor.setPosition({ lineNumber, column: 1 });
        return;
      }

      const range = new monaco.Range(lineNumber, position.column, lineNumber, position.column);
      editor.executeEdits('flowmark.continueDash', [{ range, text: `\n${analyzed.continuePrefix}` }]);
      editor.setPosition({ lineNumber: lineNumber + 1, column: analyzed.continuePrefix.length + 1 });
    });
  };

  const onToggleTaskFromView = useCallback(
    (task: Task) => {
      const editor = editorRef.current;
      const model = editor?.getModel();

      if (!editor || !model) {
        setMarkdown((prev) => toggleMarkdownAtTask(prev, task));
        return;
      }

      const lineCount = model.getLineCount();

      let lineNumber: number | null = null;
      if (task.lineNumber >= 1 && task.lineNumber <= lineCount) {
        const lineText = model.getLineContent(task.lineNumber);
        if (lineText === task.raw) lineNumber = task.lineNumber;
      }

      if (lineNumber === null) {
        for (let ln = 1; ln <= lineCount; ln++) {
          if (model.getLineContent(ln) === task.raw) {
            lineNumber = ln;
            break;
          }
        }
      }

      if (lineNumber === null) return;

      const lineText = model.getLineContent(lineNumber);
      const nextLine = toggleTaskLineCheckbox(lineText);
      if (!nextLine) return;

      editor.executeEdits('flowmark.toggleFromView', [
        {
          range: {
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: lineText.length + 1
          },
          text: nextLine
        }
      ]);
    },
    [setMarkdown]
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="text-sm font-semibold tracking-wide text-white">Flowmark</div>
          <div className="hidden text-xs text-white/50 md:block">
            Cmd/Ctrl+1: Editor · Cmd/Ctrl+2: View · Cmd/Ctrl+Enter: Toggle
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/90 hover:bg-white/15"
            onClick={() => exportMarkdown('flowmark.md', markdown)}
          >
            Export .md
          </button>
          <button
            type="button"
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/90 hover:bg-white/15"
            onClick={() => fileInputRef.current?.click()}
          >
            Import .md
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              void file.text().then((text) => {
                setMarkdown(text);
              });

              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main className="h-full min-h-0 p-3">
        <SplitPane
          left={
            <section className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-white/60">Markdown</div>
                <div className="text-xs text-white/40">source of truth</div>
              </div>
              <div className="min-h-0 flex-1">
                <EditorPane value={markdown} onChange={setMarkdown} onMount={onMountEditor} />
              </div>
            </section>
          }
          right={
            <section className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <Tabs value={tab} onChange={setTab} items={tabItems} />
                <div className="text-xs text-white/40">derived</div>
              </div>

              <div className="min-h-0 flex-1">
                <TaskList
                  tasks={viewTasks}
                  celebrateTaskId={celebrateTaskId}
                  containerRef={listRef}
                  onToggleTask={onToggleTaskFromView}
                />
              </div>
            </section>
          }
        />
      </main>
    </div>
  );
}
