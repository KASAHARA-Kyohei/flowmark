# Flowmark

Flowmark は「Markdown を唯一のソース」にした、キーボード中心の超高速タスクマネージャー（MVP）です。

- 左：Monaco Editor で Markdown を編集
- 右：Markdown から導出したビュー（Inbox / Today / All）
- 保存：ローカルのみ（IndexedDB 優先、失敗時は localStorage）

## 起動

```bash
cd flowmark
npm install
npm run dev
```

または（web パッケージ直下で）

```bash
cd flowmark/packages/web
npm install
npm run dev
```

## ショートカット

- `Cmd/Ctrl+1`：エディタへフォーカス
- `Cmd/Ctrl+2`：ビューリストへフォーカス
- `Cmd/Ctrl+Enter`：エディタの現在行がタスクならチェックをトグル

## ファイル形式（概要）

タスクは 1 行の Markdown リスト項目です。

例：

```md
- [ ] write blog @2026-01-10 #oss !high ~30m
- [x] fix parser bug @2026-01-07 @15:00 #wbs !!
- [ ] buy milk
```

詳細は `docs/FORMAT.md` を参照してください。

## Import / Export

- Export：現在の Markdown を `.md` としてダウンロード
- Import：`.md` を読み込んでエディタへ反映

## ドキュメント

- `docs/FORMAT.md`：Markdown タスク記法
- `docs/AST.md`：Task AST 仕様
- `docs/UX_PRINCIPLES.md`：UX の考え方（flow first）
- `docs/SPEC.md`：現時点の仕様（実装準拠）
- `docs/ZENN_ARTICLE_DRAFT.md`：Zenn 投稿用ドラフト（技術要点）

## デプロイ（Vercel）

このプロジェクトは静的サイトとしてデプロイできます（バックエンド不要）。

- Build：`npm --workspace packages/web run build`
- Output：`packages/web/dist`

`vercel.json`（`flowmark/vercel.json`）を同梱しているので、基本はそのまま Import するだけで動きます。

## License

MIT
