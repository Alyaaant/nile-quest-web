# Railway公開設定（NILE QUEST専用）

- プロジェクト: `nile-quest-interview`（Skolivioとは別）
- 環境: `production`
- サービス: `nile-quest-web`
- ソース: `Alyaaant/nile-quest-web`, branch `main`
- Railway公開ドメイン: https://nile-quest-web-production.up.railway.app
- ボリューム: `nile-quest-data` 500MB mounted on `/data`
- 環境変数: `DATA_DIR=/data`, `NODE_ENV=production`, `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_NAME`
- Dockerfile: Node.js 22.16, port from `PORT`（Railway側が注入）
- 接続確認: `GET /health` → `{"ok":true,"service":"nile-quest"}`

## デプロイ手順
GitHub `main` へPushするとRailwayのソース接続から新しいビルドが始まります。Railwayのサービス画面で最新のデプロイが **SUCCESS** になったことを確認し、公開URLでログイン・天気表示・クイズ保存・日本語英語・ダークモードをチェックします。

**注意:** 新しいサービスや別のRailwayプロジェクトを操作する必要はありません。Skolivioには触れないでください。

**セキュリティ:** テストアカウントのパスワードはGitHubへコミットせずRailwayの変数だけに保持します。
