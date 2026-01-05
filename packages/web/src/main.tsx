import React from 'react';
import ReactDOM from 'react-dom/client';

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

import App from './App';
import './styles.css';

// Monaco + Vite: wire up workers explicitly for a smooth dev/build experience.
const globalWithMonaco = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
};

globalWithMonaco.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    // Markdown は専用 worker が無くても editor worker で十分（MVP）。
    // label を見て分岐したくなったら、存在する worker のみ追加する。
    void _workerId;
    void label;
    return new EditorWorker();
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
