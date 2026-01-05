import React from 'react';

export type ViewKey = 'inbox' | 'today' | 'all' | `section:${string}`;

export type TabItem = {
  key: ViewKey;
  label: string;
  count: number;
};

export function Tabs(props: {
  value: ViewKey;
  onChange: (key: ViewKey) => void;
  items: TabItem[];
}): React.ReactElement {
  const { value, onChange, items } = props;

  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ' +
              (active
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/5 hover:text-white')
            }
          >
            <span>{item.label}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/80">
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
