# Flowmark MVP 仕様（実装準拠）

このドキュメントは、現時点の Flowmark（MVP）の挙動を「実装に合わせて」まとめた仕様書です。

## 目的

- **ソース・オブ・トゥルースは単一 Markdown**：編集体験が中心で、UI は派生ビュー。
- **即時性**：入力に追従して 100〜200ms 程度でビュー更新。
- **壊れない**：未知の記法があっても落ちず、元の行（raw）を保持。

## 全体構成

- 左ペイン：Monaco Editor（Markdown）
- 右ペイン：派生ビュー（Tabs + TaskList）
- 永続化：ローカルのみ（IndexedDB 優先、fallback で localStorage）

## Markdown → Task AST

詳細は `docs/FORMAT.md` と `docs/AST.md` を参照。

### セクション（見出し）

- MVP はレベル 1 見出しのみ：`# `
- タスクの `section` は「直前の `# ` 見出し」に所属
- 見出しが 1 つも無い場合は全て `Inbox` 扱い

### タスク行判定

- 行頭が `- ` の行を対象
- `- ` の直後にチェックボックスがあっても良い：`[ ]` / `[x]` / `[X]`
- 例

```md
- [ ] write blog @today #oss !high ~30m
- [x] fix parser bug @2026-01-07 @15:00 #wbs !!
- buy milk
```

### トークン（順不同）

- due：`@YYYY-MM-DD` / `@today` / `@tomorrow`
- time：`@HH:MM`
- tag：`#word`（英数字/underscore）
- priority：`!low` / `!high` / `!!` / `!!!`
- effort：`~<number>(m|h)` → 分に正規化

未知トークンはタイトルに残ります（パースが壊れない方針）。

### ID

- MVP は簡易安定ID：`hash(section + "\n" + normalizedLine)`
- チェックボックスの ON/OFF・未挿入状態の差は ID から除外（トグルでも同一タスク扱い）

## Tabs（右上）

### 基本

- `All` は **常に一番右** に表示
- `# 見出し` は **タスクが 0 件でも** タブとして表示（`0` 件表示）

### Inbox / Today 表示ルール

- Markdown が空（空白のみ含む）なら、タブは **All のみ**
- 見出しが 1 つも無い場合は、`Inbox` / `Today` を表示（導出ビューとして常時利用できる）
- 見出しが存在する場合は、`# Inbox` があるときだけ `Inbox` を表示、`# Today` があるときだけ `Today` を表示

補足：非表示になったタブが選択中だった場合は `All` に戻します。

## Views（右ペインの内容）

- Inbox：`section === "Inbox"`
- Today：`section === "Today"` または `due === 今日(ローカル)`
- All：全タスク
- `# <任意>` タブ：`section === <見出し名>`

## エディタ操作（Monaco）

### ショートカット

- `Cmd/Ctrl+1`：エディタへフォーカス
- `Cmd/Ctrl+2`：右ペイン（リスト）へフォーカス
- `Cmd/Ctrl+Enter`：現在行がタスクならチェックをトグル（`- [ ]` ⇄ `- [x]`）

### Enter でのリスト継続

- 行末で Enter を押したとき、現在行が `- ` で始まる場合に次行へ継続挿入
  - `- something` → 次行に `- `
  - `- [ ] something` / `- [x] something` → 次行に `- [ ] `
- **空の項目**（`- ` / `- [ ] ` のみ）で Enter を押すと、継続を解除（その行の `- ...` を消して通常行へ戻る）

## 右ペインからのトグル（提案機能）

右側リストのチェックボックスをクリックすると、左の Markdown に反映します。

- 仕組み：Task に `lineNumber`（1-based）を持たせ、Monaco のモデルをその行番号で編集
- 行番号がずれている可能性があるため、まず `lineNumber` を確認し、合わなければ `raw` 行の一致検索で補正してから編集

## 永続化

- 自動保存：編集のたびに保存（300ms デバウンス）
- 取得：起動時に読み込み
- 保存先
  - IndexedDB（優先）：DB=`flowmark` / store=`kv` / key=`markdown`
  - localStorage（fallback）：key=`flowmark:markdown`

## Import / Export

- Export：現在の Markdown を `flowmark.md` としてダウンロード
- Import：`.md` を読み込んでエディタへ反映

## パフォーマンス方針（MVP）

- パースは 1 パスで行単位に処理
- エディタ入力 → 150ms デバウンスでパース＆再描画
- TaskList 側は `memo` / `useMemo` を使い、不要な再計算を抑制

## 主要ファイル

- UI：`packages/web/src/App.tsx`
- パーサ：`packages/web/src/parser/parseMarkdown.ts` / `packages/web/src/parser/parseTaskLine.ts` / `packages/web/src/parser/tokens.ts`
- 永続化：`packages/web/src/storage/persistence.ts`
- タブ：`packages/web/src/ui/Tabs.tsx`
- リスト：`packages/web/src/ui/TaskList.tsx`
- エディタ：`packages/web/src/ui/EditorPane.tsx`
