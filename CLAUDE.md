# CLAUDE.md — ponzu-hoshi-koujou

## この repo について
「ひらけ！ほしこうじょう」探索×自動化サンドボックスゲーム（PWA）。単一HTMLで実装。

## 必ず守ること
- デプロイのたびに index.html 内の `GAME_VERSION` 定数を上げる（キャッシュ更新のため）。上げ忘れると変更が反映されないことがある。
- GitHub Pages公開（mainブランチ）。デプロイは deploy.yml で自動実行。
- 単一HTML構成を維持する（外部フレームワーク不使用、VanillaJS）。

## 既知の癖
- Pages Actionsのworkflow runがまれに `Queued` のまま止まることがある（legacyビルド方式起因）。後続のrunが正常終了していれば実害なし、キャンセルもできないので放置でOK。

## ここに書かないこと
- ゲームのフェーズ進捗・仕様変更の詳細はここではなく、ノア側の `企画_ゲーム_ほしこうじょう.md` が正。このCLAUDE.mdは「実装のたびに毎回効くべき技術的な前提」だけを持つ。
