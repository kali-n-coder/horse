# 文化祭競馬

GitHub Pages と Firebase Firestore/Auth で動かす、Cloud FunctionsなしのWeb競馬ゲームです。

## 構成

- `docs/`: GitHub Pagesで配信する静的ファイル
- `firestore.rules`: Firestoreの権限ルール
- `firebase.json`: Firebase CLI用の設定

## Firebase側で必要な作業

1. Firebase Consoleでプロジェクトを作成する
2. Authenticationで「匿名」を有効にする
3. Firestore Databaseを作成する
4. Webアプリを追加し、表示されたFirebase configを `docs/app.js` の `firebaseConfig` に貼る
5. 初回ログイン後、自分のUIDを確認する
6. Firestore Consoleで `admins/{自分のUID}` ドキュメントを作る
7. `.firebaserc.example` を参考に `.firebaserc` を作り、自分のFirebaseプロジェクトIDを書く
8. `npm run firebase -- login` でFirebaseにログインする
9. `npm run deploy:rules` でFirestore Rulesを反映する

`admins/{UID}` の中身は空でも構いません。

## 運営フロー

1. 参加者が「入場」して表示名を保存する
2. 係が管理画面で参加者にゲーム内通貨を付与する
3. 参加者が馬を登録する
4. 係が「出走表を作成」を押す
5. 参加者が投票する
6. 係が「レース開始」を押す
7. ゴール後、係が「払戻を確定」を押す

Cloud Functionsを使わないため、レース結果と払戻は管理者ブラウザが処理します。
