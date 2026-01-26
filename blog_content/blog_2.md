# Better Auth の新機能 authorizationEndpoint で認可URLをカスタマイズする - Cognito IdPスキップの実装例

## はじめに

この記事では、前回紹介した Better Auth と Cognito の連携において、Cognito 側に設定している別の IdP へ直接遷移する方法を紹介します。

https://qiita.com/s_moriyama/items/769b17b1c7b65d910fb1

前回の成果物では、以下のようにマネージドログインの画面を表示していましたが、この画面を飛ばし、直接 SSO 先（今回は Auth0）の認証画面へ遷移する方法を試してみました。

![alt text](<CleanShot 2026-01-23 at 05.48.34.gif>)

本来であれば、Better Auth から直接 Auth0 を連携させれば解決するお話でもあるのですが、今回は今月新規に追加された authorizationEndpoint の上書き機能で動作確認してみます。

### この記事で学べること

- Better Auth と Cognito に設定した IdP の認証画面へ直接遷移する方法

### 前提知識・条件

- 動作確認時の各ライブラリのバージョンは以下のとおりです
  - Next.js: 16.1.3
  - Better Auth: 1.4.15

## やってみた

では検証してみます。

### Cognitoで直接IdPにリダイレクトする方法

まず、Cognito の認可エンドポイントに `identity_provider` パラメータを付与することで、マネージドログインをスキップできます。

```text
https://{domain}/oauth2/authorize?identity_provider=Auth0&...
```

https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html

ということなので、Better Auth 側で `identity_provider` を認証 URL に付与すれば対応できそうですね。

なお、Auth0 の設定の追加は以下のとおりです。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/d1d779239c96668d4bc67fc0d6fb958935e195f6/packages/cdk/lib/cdk-stack.ts#L36-L54

### Better Auth側の対応方法

2026 年 1 月、これに対応する機能が追加されています。

https://github.com/better-auth/better-auth/pull/6962

> Adds an authorizationEndpoint option to OAuth providers so you can override the default authorization URL. This helps test against local or sandbox OAuth servers.

この PR で追加された `authorizationEndpoint` オプションは、OAuth プロバイダーの認可エンドポイント URL を上書きできる機能です。

元々はローカルやサンドボックス環境でのテスト用途を想定していますが（[Issue #6956](https://github.com/better-auth/better-auth/issues/6956)）、今回のように認可 URL にカスタムパラメータを付与したい場合にも活用できそうです。

このオプションはクエリパラメータ単位での追加ではなく、URL 全体を上書きするので、以下のように設定してみました。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app/src/lib/auth.ts

環境変数は `COGNITO_IDENTITY_PROVIDER=Auth0` を新規追加しています。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app/.env.example

これで動作することを確認しました。

![alt text](<CleanShot 2026-01-25 at 10.04.30.gif>)

### ログアウト処理の修正

最後にログアウト処理についてです。

ログアウト時は、Better Auth のセッションクリア後、Auth0 → Cognito の順でそれぞれログアウトしていきます。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app/src/app/logout-button.tsx

## まとめ

Cognito を使う制限があるかつ、不要なマネージドログイン画面を表示させない方法のご紹介でした。

このようなケース以外にも、`authorizationEndpoint` オプションは便利なシーンがありそうです。

なお、今回は新機能の `authorizationEndpoint` を使いましたが、Generic OAuth プラグインの `authorizationUrlParams` オプションでも同様のことが実現できます。

https://www.better-auth.com/docs/plugins/generic-oauth

実はこの記事を書く直前まではこの方法で実現してましたが、今回紹介した新機能の方が今回のケースでは簡単に書けます。

状況に応じて使い分けると良いと思います。
