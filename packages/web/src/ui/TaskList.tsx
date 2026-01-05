import React, { memo, useMemo } from 'react';
import type { Task } from '@/parser/parseMarkdown';

function formatMeta(task: Task): string {
  const parts: string[] = [];
  if (task.due) parts.push(task.due);
  if (task.time) parts.push(task.time);
  if (task.effortMinutes !== undefined) parts.push(`~${task.effortMinutes}m`);
  if (task.priority > 0) parts.push(`p${task.priority}`);
  if (task.tags.length > 0) parts.push(task.tags.map((t) => `#${t}`).join(' '));
  return parts.join(' · ');
}

function CelebrationBurst(props: { show: boolean }): React.ReactElement | null {
  if (!props.show) return null;

  const dots = [
    { dx: -26, dy: -18, color: '#7dd3fc' },
    { dx: 18, dy: -26, color: '#fda4af' },
    { dx: 30, dy: 8, color: '#a7f3d0' },
    { dx: -22, dy: 22, color: '#fde68a' },
    { dx: 2, dy: -34, color: '#c4b5fd' },
    { dx: -34, dy: 2, color: '#fdba74' },
    { dx: 10, dy: 30, color: '#93c5fd' },
    { dx: 34, dy: -6, color: '#f9a8d4' }
  ];

  return (
    <span className="fm-burst">
      {dots.map((dot) => (
        <i
          key={`${dot.dx},${dot.dy}`}
          style={{
            transform: `translate(${dot.dx}px, ${dot.dy}px)`,
            background: dot.color
          }}
        />
      ))}
    </span>
  );
}

export const TaskList = memo(function TaskList(props: {
  tasks: Task[];
  celebrateTaskId?: string;
  containerRef?: React.Ref<HTMLDivElement>;
  onToggleTask?: (task: Task) => void;
}): React.ReactElement {
  const sorted = useMemo(() => {
    const copy = [...props.tasks];
    copy.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return a.title.localeCompare(b.title);
    });
    return copy;
  }, [props.tasks]);

  return (
    <div
      ref={props.containerRef}
      tabIndex={-1}
      className="relative h-full overflow-auto rounded-lg bg-white/5 p-3"
    >
      <ul className="space-y-2">
        {sorted.map((task) => {
          const meta = formatMeta(task);
          return (
            <li
              key={task.id}
              className={
                'relative rounded-md border border-white/10 px-3 py-2 ' +
                (task.completed ? 'opacity-60' : 'opacity-100')
              }
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  aria-pressed={task.completed}
                  onClick={() => props.onToggleTask?.(task)}
                  className={
                    'mt-0.5 h-4 w-4 rounded border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ' +
                    (task.completed
                      ? 'border-emerald-400/70 bg-emerald-400/20'
                      : 'border-white/30 bg-white/5 hover:bg-white/10')
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{task.title || '(no title)'}</div>
                  {meta.length > 0 ? (
                    <div className="mt-0.5 truncate text-xs text-white/60">{meta}</div>
                  ) : null}
                </div>
                <div className="text-xs text-white/40">{task.section}</div>
              </div>
              <CelebrationBurst show={props.celebrateTaskId === task.id} />
            </li>
          );
        })}
      </ul>

      {sorted.length === 0 ? (
        <div className="mt-6 text-sm text-white/50">タスクがありません</div>
      ) : null}
    </div>
  );
});
