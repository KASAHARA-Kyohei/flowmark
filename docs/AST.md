# Task AST

Flowmark は Markdown から Task AST を生成し、UI 表示やフィルタリングに使います。

```ts
type Task = {
  id: string;              // MVP: hash(section + "\n" + raw)
  raw: string;             // 元の 1 行
  title: string;           // トークン除去後のタイトル（残りテキスト）
  completed: boolean;
  section: string;         // 直前の # 見出し。なければ "Inbox"
  tags: string[];
  due?: string;            // YYYY-MM-DD
  time?: string;           // HH:MM
  priority: number;        // 0..3
  effortMinutes?: number;
  lineNumber: number;      // 1-based。UI から元Markdown行へ反映するための補助情報
};
```

設計方針：

- パースは「壊れない」ことを最優先（未知トークンは無視しつつ title に残る）
- 変換元の Markdown は常に `raw` として保持し、編集のソースは常にエディタ側
