# NILE QUEST — Visual v1.3 修正パッチ

以前の3D ZIPは古い `app.js` を含んでいました。このパッチはv1.1天気API修正を維持しています。

## 最も簡単な適用手順
1. VS Codeで `~/Desktop/nile-quest-web` を開く。
2. `npm start` が起動している場合は Control+C。
3. このZIPを `~/Downloads` にダウンロード。
4. ターミナルで:

```sh
cd ~/Desktop/nile-quest-web
mkdir -p .visual-backup
cp public/app.js public/styles.css public/index.html src/server.mjs .visual-backup/
unzip -o ~/Downloads/NILE_QUEST_v1_3_Cinematic_Fix.zip -d .
npm run check
npm test
npm start
```

5. Chrome/Safariで `http://localhost:3000` を開き、**Command + Shift + R** で再読み込み。
6. フッターに `VISUAL v1.3`、トップにエジプトの背景画像、WORLD MAPに立体風の地図、各国のステージ詳細ページで都市の背景が表示されればOK。

DBファイルや保存データは含まれておらず、変更もしません。Skolivioと既存Railwayにも触れません。

## 必ず確認するコマンド

```sh
grep -n 'visual-1.3' public/index.html
grep -n 'weatherFromBrowser' public/app.js
ls -lh public/media/*-visual-v13.webp
curl -s http://localhost:3000/ | grep visual-1.3
```

新しいURLのまま表示されない場合、ターミナルで実行した `pwd`、上記コマンドの出力、ブラウザのURLを確認してください。なおGitHubへの反映や本番デプロイはこのZIPだけでは行われません。
