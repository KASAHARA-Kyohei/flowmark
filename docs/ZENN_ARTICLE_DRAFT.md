---
title: "Flowmark: Markdown単一ソースのキーボード最速タスク管理MVPをVite+React+Monacoで作った"
type: "tech"
topics: ["react", "typescript", "vite", "monaco", "markdown"]
published: false
---

Flowmark は「単一の Markdown ドキュメントをソース・オブ・トゥルースにする」タスクマネージャーのMVPです。

- 左：Monaco Editor で Markdown を編集
- 右：Markdown からパースした Task AST を元に Inbox / Today / All / セクション別ビューを表示
- 保存：IndexedDB（fallback: localStorage）

本記事は文章のブラッシュアップはせず、実装の要点と参考になりそうなコード断片をまとめます。

## 1. 技術スタック / 構成

- Vite + React + TypeScript（strict）
- Monaco：`@monaco-editor/react` + `monaco-editor`
- Tailwind CSS（最小限）
- ローカル永続化：IndexedDB → localStorage fallback

monorepo-ready なディレクトリ構成（web だけ実装）：

```text
flowmark/
  docs/
  packages/
    web/
      src/
        parser/
        storage/
        ui/
        utils/
```

起動：

```bash
cd flowmark
npm install
npm run dev
```

## 2. コア設計：Markdownが唯一の真実

重要な方針はこれだけです。

- UI は常に Markdown から導出する（右側は派生）
- 右側で操作しても、最終的には Markdown（左側）を書き換える

これで「データモデルが分岐する」事故が減ります。

## 3. タスク記法（MVP）

タスクは 1 行の Markdown リスト項目：

```md
- [ ] write blog @2026-01-10 #oss !high ~30m
- [x] fix parser bug @2026-01-07 @15:00 #wbs !!
- buy milk
```

MVP の判定はシンプルで、行頭が `- ` の行をタスク候補として扱い、`[ ]/[x]` があれば完了状態に反映します。

トークン（順不同）：

- due：`@YYYY-MM-DD` / `@today` / `@tomorrow`
- time：`@HH:MM`
- tag：`#word`（英数字/underscore）
- priority：`!low` / `!high` / `!!` / `!!!` → 0..3
- effort：`~<number>(m|h)` → minutes

未知トークンがあっても落とさず、`raw`（元行）は常に保持します。

## 4. 1パスのMarkdownパース（見出し→セクション）

見出しは MVP なので level 1（`# `）だけ扱います。セクションは「直前の見出し」です。

`parseMarkdown` は 1 回のループで、`headings/sections/tasks` を作ります：

```ts
// packages/web/src/parser/parseMarkdown.ts
for (let index = 0; index < lines.length; index++) {
  const line = lines[index];

  if (line.startsWith('# ')) {
    const heading = line.slice(2).trim();
    currentSection = heading.length > 0 ? heading : 'Inbox';
    seenSections.add(currentSection);
    if (heading.length > 0) seenHeadings.add(heading);
    continue;
  }

  if (!line.startsWith('- ')) continue;
  const parsed = parseTaskLine(line, { now });
  if (!parsed) continue;

  tasks.push({
    id: fnv1a32(`${currentSection}\n${normalizeTaskLineForId(line)}`),
    raw: line,
    section: currentSection,
    ...parsed,
    lineNumber: index + 1
  });
}
```

ポイント：

- 先頭が `- ` 以外は即スキップ（軽い）
- `lineNumber` を持たせて、右側のクリックを左側の Markdown 行に反映しやすくする

## 5. 「トグルしても同一タスク」なID（MVPの割り切り）

MVP では `id` を「(section + raw) のハッシュ」で作っていますが、チェックボックスの状態は正規化して除外しています。

```ts
// packages/web/src/parser/parseMarkdown.ts
function normalizeTaskLineForId(raw: string): string {
  if (raw.startsWith('- [ ] ')) return raw;
  if (raw.startsWith('- [x] ')) return raw.replace(/^- \[x\] /, '- [ ] ');
  if (raw.startsWith('- [X] ')) return raw.replace(/^- \[X\] /, '- [ ] ');
  if (raw.startsWith('- ')) return raw.replace(/^- /, '- [ ] ');
  return raw;
}
```

これで「未チェック→チェック→未チェック」でも同じ `id` として扱えます。

## 6. タスク行のトークン抽出（壊れない優先）

タスク行は、残り部分をスペースで split して、各 token を順番に判定します。

```ts
// packages/web/src/parser/parseTaskLine.ts
for (const token of parts) {
  const parsedDue = parseDueToken(token, ctx);
  if (parsedDue) { due = parsedDue; continue; }

  const parsedTime = parseTimeToken(token);
  if (parsedTime) { time = parsedTime; continue; }

  const parsedTag = parseTagToken(token);
  if (parsedTag) { tags.add(parsedTag); continue; }

  const parsedPriority = parsePriorityToken(token);
  if (parsedPriority !== undefined) { priority = parsedPriority; continue; }

  const parsedEffort = parseEffortToken(token);
  if (parsedEffort !== undefined) { effortMinutes = parsedEffort; continue; }

  // どれにも当てはまらない = タイトルの一部
  titleParts.push(token);
}
```

未知トークンを落とさないので、記法を将来拡張しても破壊的変更になりにくいです。

## 7. 即時更新：150msのパースデバウンス

エディタの変更に追従して、150ms デバウンスでパースしてビュー更新しています。

```ts
// packages/web/src/App.tsx
useEffect(() => {
  const handle = window.setTimeout(() => {
    const parsed = parseMarkdown(markdown, { now: new Date() });
    setTasks(parsed.tasks);
    setSections(parsed.sections);
    setHeadings(parsed.headings);
  }, 150);
  return () => window.clearTimeout(handle);
}, [markdown]);
```

## 8. タブ設計：Allは常に右端 / Inbox・Todayは条件付き

All は常に右端に置きたいので、最後に必ず追加しています。

また、要望に合わせて次の表示ルールになっています。

- Markdown が空（空白のみ） → **All のみ**
- 見出しが 0 件 → `Inbox/Today` は導出ビューとして表示
- 見出しがある → `# Inbox` があるときだけ Inbox 表示（Todayも同様）

```ts
// packages/web/src/App.tsx
if (isEmptyMarkdown) return [{ key: 'all', label: 'All', count: allTasks.length }];

const inboxVisible = !hasAnyHeading || headings.includes('Inbox');
const todayVisible = !hasAnyHeading || headings.includes('Today');

return [...base, ...extras, { key: 'all', label: 'All', count: allTasks.length }];
```

## 9. キーボード中心の編集：Cmd/Ctrl+Enterで現在行トグル

Monaco のコマンドとして登録しています。

```ts
// packages/web/src/App.tsx
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
```

## 10. Enterで `- ` を継続（空行で解除）

「入力の流れを止めない」ための小さな工夫です。

- `- something` の行末で Enter → 次行に `- `
- `- [ ] something` の行末で Enter → 次行に `- [ ] `
- 空の `- ` / `- [ ] ` で Enter → 継続を解除（その行を消す）

```ts
// packages/web/src/App.tsx
if (analyzed.isEmptyItem) {
  const range = new monaco.Range(lineNumber, 1, lineNumber, lineText.length + 1);
  editor.executeEdits('flowmark.endDash', [{ range, text: '' }]);
  editor.setPosition({ lineNumber, column: 1 });
  return;
}

editor.executeEdits('flowmark.continueDash', [
  { range, text: `\n${analyzed.continuePrefix}` }
]);
```

## 11. 右側クリックで左側Markdownに反映（派生→真実へ戻す）

右側リストは派生なので、チェック操作は最終的に Monaco のモデル（=Markdown）を更新します。

`lineNumber` が合わなければ、`raw` の一致で補正してから編集します。

```ts
// packages/web/src/App.tsx
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
```

この方式だと、UI操作のたびに別状態を持たずに済みます。

## 12. 永続化：IndexedDB → localStorage fallback

保存は `packages/web/src/storage/persistence.ts` に閉じ込めました。

- IndexedDB：DB=`flowmark` / store=`kv` / key=`markdown`
- localStorage：key=`flowmark:markdown`

```ts
// packages/web/src/storage/persistence.ts
function pickBackend(): StorageBackend {
  try {
    if (typeof indexedDB !== 'undefined') {
      return indexedDbBackend();
    }
  } catch {
    // ignore
  }
  return localStorageBackend();
}
```

保存は 300ms デバウンスで自動保存：

```ts
// packages/web/src/App.tsx
useEffect(() => {
  if (!hydrated) return;
  const handle = window.setTimeout(() => void saveMarkdown(markdown), 300);
  return () => window.clearTimeout(handle);
}, [markdown, hydrated]);
```

## 13. Import / Export

- Export：Blob を作ってダウンロード
- Import：`file.text()` で読み込んで `setMarkdown(text)`

（MVPなので最小実装）

## 14. 画面分割のリサイズ（よくある境界ドラッグ）

SplitPane を自前で作り、ドラッグで左幅を調整できるようにしています。

- 初期は 50/50（保存値が無い場合）
- ドラッグ中は `cursor: col-resize` と `userSelect: none`
- 幅は `flowmark:split:leftPx` に保存

```ts
// packages/web/src/ui/SplitPane.tsx
const half = rect.width / 2;
const clamped = clamp(half, minLeftPx, rect.width - minRightPx);
setLeftPx(clamped);
```

## 15. 小さな演出：完了時のミニバースト

ライブラリは入れずに、CSSアニメーション + 小さいドットで「やった感」を出しています。

```css
/* packages/web/src/styles.css */
@keyframes fm-burst { /* ... */ }
.fm-burst { animation: fm-burst 650ms ease-out forwards; }
```

## 16. メモ：Monaco + Vite の worker

`monaco-editor` の worker を明示的に指定しています。

```ts
// packages/web/src/main.tsx
globalThis.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  }
};
```

（Markdown 専用 worker は今回のMVPでは省略）

## 17. 次の拡張アイデア

- タスクの「位置ジャンプ」（右側クリックで該当行へカーソル移動）
- セクション並び順を Markdown の順序に合わせる（今はアルファベットソート）
- 右側リストのキーボード操作（j/k、Enterトグル、検索）
- パーサのテストを Vitest 等で追加

