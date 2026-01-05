# Flowmark Markdown Format (MVP)

Flowmark のソース・オブ・トゥルースは 1 つの Markdown ドキュメントです。
UI はこの Markdown をパースして Task AST を生成し、そこから各ビューを描画します。

## タスク行の判定

次の条件を満たす行はタスクとして扱います。

- 行頭が `- `（ダッシュ + 半角スペース）
- その直後にチェックボックスがあってもなくてもよい：`[ ]` または `[x]`

例：

```md
- [ ] write blog @today #oss !high
- [x] fix parser bug @2026-01-07 @15:00 #wbs !!
- [ ] buy milk
- just a dash task without checkbox
```

## セクション（見出し）

MVP ではレベル 1 見出し（`# `）のみを扱います。
タスクの `section` は「直前の `# ` 見出し」によって決まります。

- 見出しが 1 つもない場合は、すべて `Inbox` 扱い

例：

```md
# Inbox
- [ ] buy milk

# Today
- [ ] ship MVP @today
```

## トークン（順不同）

タスク行のタイトル以外のメタ情報は、スペース区切りのトークンとして埋め込みます。
認識できないトークンがあっても壊れず、必ず `raw` 行を保持します。

- due：`@YYYY-MM-DD` または `@today` または `@tomorrow`
- time：`@HH:MM`（24h）
- tag：`#word`（英数字/underscore）
- priority：`!low` / `!high` / `!!` / `!!!`
- effort：`~<number>(m|h)`（分または時間 → 分に正規化）

例：

```md
- [ ] write blog @2026-01-10 #oss !high ~30m
- [x] deep work @tomorrow @09:30 #focus !!! ~1.5h
```
