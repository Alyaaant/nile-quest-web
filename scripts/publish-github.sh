#!/usr/bin/env bash
set -euo pipefail
EXPECTED_GITHUB_USER='Alyaaant'
REPO_NAME='nile-quest-web'
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if ! command -v git >/dev/null; then echo 'git が必要です。'; exit 1; fi
if ! command -v gh >/dev/null; then echo 'GitHub CLI がありません。Macで brew install gh を実行してください。'; exit 1; fi
if ! gh auth status >/dev/null 2>&1; then echo 'GitHub にログインしてください: gh auth login'; exit 1; fi
actual_user="$(gh api user --jq .login)"
if [[ "$actual_user" != "$EXPECTED_GITHUB_USER" ]]; then
  echo "GitHub のログイン先が違います。現在: $actual_user / 必要: $EXPECTED_GITHUB_USER"
  exit 1
fi
if gh repo view "$EXPECTED_GITHUB_USER/$REPO_NAME" >/dev/null 2>&1; then
  echo "同名の GitHub リポジトリが既にあります: $EXPECTED_GITHUB_USER/$REPO_NAME"
  echo '事故を防ぐため既存リポジトリは変更しません。'
  exit 1
fi
if [[ -d .git ]]; then
  echo 'このフォルダはすでに Git 管理されています。手動で確認してください。'
  exit 1
fi
npm run check
npm test
git init -b main
git add --all
if git ls-files | grep -E '^data/.*sqlite|^\.env$'; then
  echo '危険: 秘密情報またはデータベースが含まれています。push を中止します。'
  exit 1
fi
git -c user.name="$EXPECTED_GITHUB_USER" -c user.email="$(gh api user --jq .id)+${EXPECTED_GITHUB_USER}@users.noreply.github.com" commit -m 'Build Nile Quest world-travel interview game'
gh repo create "$EXPECTED_GITHUB_USER/$REPO_NAME" --public --source=. --remote=origin --push \
  --description 'NILE QUEST: Cairo to Tokyo, five-stage travel quiz web application'
echo
printf 'GitHub: https://github.com/%s/%s\n' "$EXPECTED_GITHUB_USER" "$REPO_NAME"
echo '公開Webサイトは別途 Railway 等のホスティングサービスへのデプロイが必要です。'
