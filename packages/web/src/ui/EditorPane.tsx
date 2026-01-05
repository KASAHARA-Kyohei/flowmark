import React from 'react';
import Editor from '@monaco-editor/react';

type Monaco = typeof import('monaco-editor');

export function EditorPane(props: {
  value: string;
  onChange: (next: string) => void;
  onMount: (editor: import('monaco-editor').editor.IStandaloneCodeEditor, monaco: Monaco) => void;
}): React.ReactElement {
  return (
    <div className="h-full overflow-hidden rounded-lg border border-white/10 bg-black/20">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        theme="vs-dark"
        value={props.value}
        onChange={(next) => props.onChange(next ?? '')}
        onMount={props.onMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
          lineNumbers: 'on',
          wordWrap: 'on',
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          overviewRulerBorder: false,
          padding: { top: 10, bottom: 10 },
          automaticLayout: true
        }}
      />
    </div>
  );
}
