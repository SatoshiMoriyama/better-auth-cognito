# タイトル

## はじめに

最近、Better Auth というサービスを知ったので、検証してみたいと思います。

私な個人的な興味の都合上、Amazon Cognito との連携や、Cognito を経由した SSO などの動作確認してみます。

### この記事で学べること

- better-auth について
- better-auth と cognito の実装について

### 前提知識・条件

- 最初から cognito との連携のお話をします。基本的な使い方等は割愛します。

## better-authとは？

## やってみた

## やってみた(SSO)

## まとめ

## めも

### 目的

Better Auth で Cognito のマネージドログイン画面をスキップし、直接 SSO 先（Auth0）にリダイレクトしたい。

### 調査結果

#### Cognitoで直接IdPにリダイレクトする方法

Cognito の認可エンドポイントに `identity_provider` パラメータを付与することで、マネージドログインをスキップできる。

```text
https://{domain}/oauth2/authorize?identity_provider=Auth0&...
```

参考: [AWS Cognito Authorization Endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)

#### Better Authの組み込みCognitoプロバイダーの制限

GitHub でソースコードを確認した結果、組み込み Cognito プロバイダーは `authorizationUrlParams` をサポートしていない。

- [packages/core/src/social-providers/cognito.ts](https://github.com/better-auth/better-auth/blob/main/packages/core/src/social-providers/cognito.ts)
- `createAuthorizationURL` 関数内で追加パラメータを渡す仕組みがない

#### 解決策: Generic OAuthプラグインを使用

Generic OAuth プラグインは `authorizationUrlParams` オプションをサポートしている。

- [Better Auth Generic OAuth Plugin](https://www.better-auth.com/docs/plugins/generic-oauth)

### 実装変更

#### 1. auth.ts - サーバー側設定

```typescript
import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';

export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'cognito',
          clientId: process.env.COGNITO_CLIENT_ID,
          clientSecret: process.env.COGNITO_CLIENT_SECRET,
          discoveryUrl: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USERPOOL_ID}/.well-known/openid-configuration`,
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          // ここがポイント！直接Auth0にリダイレクト
          authorizationUrlParams: {
            identity_provider: 'Auth0',
          },
          // nameフィールドのフォールバック処理
          mapProfileToUser: (profile) => ({
            name: profile.name || profile.email || profile.sub || 'Unknown',
            email: profile.email,
            image: profile.picture,
          }),
        },
      ],
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
```

#### 2. auth-client.ts - クライアント側設定

```typescript
import { createAuthClient } from 'better-auth/react';
import { genericOAuthClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [genericOAuthClient()],
});
```

#### 3. login/page.tsx - ログインページ

```typescript
// signIn.social → signIn.oauth2 に変更
authClient.signIn.oauth2({
  providerId: 'cognito',
  callbackURL: '/',
});
```

#### 4. CDK - コールバックURL変更

Generic OAuth プラグインのコールバック URL は `/api/auth/oauth2/callback/:providerId`

```typescript
callbackUrls: [
  'http://localhost:3000/api/auth/oauth2/callback/cognito',
],
```

### 注意点

#### mapProfileToUserが必要な理由

組み込み Cognito プロバイダーは内部で `name` フィールドのフォールバック処理をしていた。

```typescript
const name = profile.name || profile.given_name || profile.username || profile.email;
```

Generic OAuth プラグインにはこの処理がないため、`mapProfileToUser` で明示的に指定する必要がある。

#### Better Auth 1.4のステートレス認証

データベース設定を省略すると、セッション情報は Cookie に保存されるステートレスモードで動作する。

- [Better Auth 1.4 Release Notes](https://www.better-auth.com/blog/1-4)
