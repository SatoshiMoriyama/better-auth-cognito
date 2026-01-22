# Better AuthとAWS Cognitoで実現するステートレス認証

## はじめに

最近、Better Auth というライブラリの存在を知ったので、少し触ってみます。

https://www.better-auth.com/

今回は個人的な興味の都合上、Amazon Cognito との連携や、Cognito を経由した SSO などの動作確認をします。

### この記事で学べること

- Better Auth と Cognito の連携方法について

### 前提知識・条件

- 動作確認時の各ライブラリのバージョンは以下のとおりです。
  - Next.js: 16.1.3
  - Better Auth: 1.4.15

## Better Authとは？

下記に公式の説明を引用しましたが、Better Auth は TypeScript 向けに設計された、Next.js 等のフレームワークに依存しない、認証・認可のライブラリです。

https://github.com/better-auth/better-auth

> Better Auth is framework-agnostic authentication (and authorization) library for TypeScript. It provides a comprehensive set of features out of the box and includes a plugin ecosystem that simplifies adding advanced functionalities with minimal code in a short amount of time. Whether you need 2FA, multi-tenant support, or other complex features. It lets you focus on building your actual application instead of reinventing the wheel.

私自身、モダンなフロントエンド開発は現職が初めてなのであまり知識がないのですが、最近人気が高まっているライブラリのようです。

２要素認証、他の IDaaS との連携、マルチテナント対応等、高度な機能を備えています。

また、自身でデータベースを作ることができるセルフホスト認証機能もあり、追加のインフラを必要とせずユーザ情報を管理できます。

詳細については他の認証サービスとの比較ページもあったので、紹介しておきます。

https://www.better-auth.com/docs/comparison

## やってみた

今回は、`create-next-app` で作成した Next.js アプリケーションで、Cognito との連携を試してみます。

Better Auth は Web ページの記載も充実しており、下記の2ページを見れば、簡単に導入できました。

https://www.better-auth.com/docs/installation

https://www.better-auth.com/docs/authentication/cognito

また、MCP, Skills, LLMs.txt など AIを利用して開発するために必要なツール群も完備されております！

https://www.better-auth.com/docs/introduction#ai-tooling

### 成果物

今回作成したソースは下記に格納しています。

https://github.com/SatoshiMoriyama/better-auth-cognito/tree/main/packages/nextjs-app-simple

### 1.Cognito ユーザープールの作成

では、順を追って作っていきます！

まず、Cognito ユーザープールとアプリケーションクライアントを作成します。

今回は CDK で作成していますが、以下の３点ほど注意して作成します。

1. `generateSecret: true` - Better Auth はデフォルトでクライアントシークレットを使用するため
2. `email属性を必須に設定` - 今回の検証で、ユーザ情報として使用するため
3. `callbackUrlsとlogoutUrls` - 最初は仮の値を入れておき、手順 4 で正しい値に更新する

```typescript
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib/core';
import type { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Poolの作成
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'my-user-pool',
      signInAliases: {
        email: true,
        username: true,
      },
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true, 
        },
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognitoドメインの設定
    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `my-app-${cdk.Stack.of(this).account}`,
      },
    });

    // アプリクライアントの作成
    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: 'my-app-client',
      oAuth: {
        flows: {
          authorizationCodeGrant: true, 
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3001/',  // 後で更新
        ],
        logoutUrls: [
          'http://localhost:3001/',  // 後で更新
        ],
      },
      generateSecret: true,  // Better Authはクライアントシークレットを要求
    });

    // CloudFormation出力
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito User Pool Domain',
    });
  }
}
```

### 2.Better Authの設定

次に Better Auth の設定をしていきます。

下記のページの通り進めますが、今回は Cognito との連携のため、データベースの作成はしません。

https://www.better-auth.com/docs/installation

Better Auth ではこのようなデータベースを利用しない認証をステートレス認証と呼びます。

#### 2.1.インストール

まずは npm 等で Better Auth を導入します。

`npm install better-auth`

#### 2.2.環境変数設定

次に、次工程で作成する Better Auth クライアントのパラメータを保持するため、今回は `.env` で環境変数を設定していきます。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/5e3da78e189da4a1af10dcf0ceb6381a17ab3fcd/packages/nextjs-app-simple/.env.example

簡単に各環境変数の説明を記載しておきます。

##### Better Auth関連の環境変数

| 環境変数                  | 説明                                                                   | 例                                                           |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | 暗号化・ハッシュ等に利用する秘密鍵。64文字以上のランダムな文字列を推奨                            | `0nhmaiDZzk8cHMjx3yoc0bfiQkOksN5j...`                      |
| `BETTER_AUTH_URL`       | Better AuthのベースURL。                               | `http://localhost:3001`                                    |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | クライアントサイドで使用するBetter AuthのベースURL                               | `http://localhost:3001`                                    |

`BETTER_AUTH_SECRET` は Better Auth が暗号化・ハッシュ等に利用する秘密鍵となりますが、下記ページから設定する値を生成できます。

https://www.better-auth.com/docs/installation#set-environment-variables

![alt text](<CleanShot 2026-01-22 at 06.15.20.png>)

##### AWS Cognito関連の環境変数

次の作業で必要な情報を環境変数に設定しておきます。

| 環境変数                  | 説明                                                                   | 例                                                           |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `COGNITO_CLIENT_ID`     | Cognito User PoolのアプリクライアントID                                       | `1ab2cd3ef4gh5ij6kl7mn8op9q`                               |
| `COGNITO_CLIENT_SECRET` | Cognito User Poolのアプリクライアントシークレット                                   | `a1b2c3d4e5f6g7h8i9j0k1l2m3...`                           |
| `COGNITO_DOMAIN`        | Cognito User Poolのドメイン（ホスト名のみ）                                      | `my-app-123456789012.auth.ap-northeast-1.amazoncognito.com` |
| `COGNITO_REGION`        | Cognito User PoolのAWSリージョン                                           | `ap-northeast-1`                                           |
| `COGNITO_USERPOOL_ID`   | Cognito User PoolのID                                                 | `ap-northeast-1_AbCdEfGhI`                                 |

#### 2.3.Better Authインスタンス作成

Better Auth のインスタンスを作成しておきます。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/5e3da78e189da4a1af10dcf0ceb6381a17ab3fcd/packages/nextjs-app-simple/src/lib/auth.ts

Cognito との連携する際には下記のページの通り、ユーザープールとの紐付けが必要なのでここで設定しておきます。

https://www.better-auth.com/docs/authentication/cognito

#### 2.4 Better Authクライアントの作成

クライアントサイドで Better Auth を利用するためにクライアントを作成しておきます。

利用箇所については後述しますが、Cognito のマネージドログインへのリダイレクト等で利用しています。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app-simple/src/lib/auth-client.ts

### 3. 認証に必要なエンドポイントの作成

Cognito から返ってきた認証コードをトークンに交換する際のエンドポイント等、認証に必要なエンドポイントを作成していきます。

Next.js の場合、たった３行で全てのエンドポイントの実装が完了します。

`toNextJsHandler` 関数が、Next.js App Router の形式で必要なエンドポイントを全てハンドリングしてくれます。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app-simple/src/app/api/auth/%5B...all%5D/route.ts

今回のサンプルの場合、以下のようなエンドポイントを使っています。

| エンドポイント | 説明 |
| ------------ | ---- |
| `/api/auth/sign-in/social` | Cognitoのマネージドログイン画面へリダイレクト |
| `/api/auth/callback/cognito` | Cognitoからの認証コードをトークンに交換し、セッションCookieを設定 |
| `/api/auth/get-session` | 現在ログインしているユーザーの情報を取得 |
| `/api/auth/sign-out` | Better Authのセッションをクリア |

### 4.CognitoにコールバックURLを登録

手順３で作成できたコールバック URL を Cognito に設定し、許可しておきます。

また、合わせてログアウト後に遷移する URL も指定しておきます。

```typescript:packages/cdk/lib/cdk-stack.ts
    // アプリクライアントの作成
    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: 'my-app-client',
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
+          'http://localhost:3001/api/auth/callback/cognito',
        ],
        logoutUrls: [
+          'http://localhost:3001/logout',
        ],
      },
      generateSecret: true,
    });
```

これで Better Auth 側の設定は完了です。

### 5. アプリ側の実装

次にアプリ側の実装です。

#### 5.1 認証状態の確認（middleware）

未認証の場合、ログインページへ誘導する…といった動作をさせるため認証状態を取得する必要があります。

サーバーサイドでの認証状態の確認は `getSession()` を使うことができます。

proxy.ts 上で呼び出すことで、各種ページリクエスト時に Cookie へ保存されたトークンの署名や有効期限を検証するようにしてみました。

検証の結果、未認証と判断された場合、ログインページ('/login')へリダイレクトさせています。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app-simple/src/proxy.ts

#### 5.2 ログインページ

ログインページ自体もとてもシンプルです。

今回はクライアントサイドレンダリングで作成しており、`authClient.signIn.social()` を利用するのみです。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app-simple/src/app/login/page.tsx

#### 5.3 ホームページ

ホームページでは、先ほど紹介した `getSession()` で取得したセッション情報を使い、メールアドレス(`session?.user.email`)を画面に表示しています。

```typescript:/src/app/page.tsx
import { headers } from 'next/headers';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import LogoutButton from './logout-button';

export default async function Home() {
+  const session = await auth.api.getSession({
+    headers: await headers(),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
...
          <LogoutButton />
        </div>
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
+            user.email：{session?.user.email}
          </h1>
        </div>
...
```

このような感じで Cognito でログイン時に使用したメールアドレスが表示されます。

![alt text](<CleanShot 2026-01-22 at 12.57.37.png>)

#### 5.4 ログアウト機能

ログアウトも、`authClient.signOut()` のみで完結します。

https://github.com/SatoshiMoriyama/better-auth-cognito/blob/main/packages/nextjs-app-simple/src/app/logout-button.tsx#L10

現時点では、Better Auth の機能だけでは連携先の Cognito 側のログアウトができないため、自前で以下の URL へリダイレクトするようにしています。

`https://[cognitoDomain]/logout?client_id=[clientId]&logout_uri=[logoutUri]`

Cognito 側でログアウト処理が完了後は、`logout_uri` で指定した URL にリダイレクトされます。

## 動作確認

最後に動作確認しておきます。

以下ログインからログアウトの動作です。

![alt text](<CleanShot 2026-01-23 at 05.48.34.gif>)

### redirect_uri_mismatch

動作確認の中で、以下のようなエラーによく遭遇しました。

![alt text](<CleanShot 2026-01-23 at 05.58.28.png>)

開発者ツールでリダイレクト内容を見ると、`redirect_uri_mismatch` というエラーが確認できます。

これは Cognito に登録されているコールバック URL と、実際にリクエストで送信されたコールバック URL が一致しない場合に発生します。

`https://my-app-xxxxxx.auth.ap-northeast-1.amazoncognito.com/error?error=redirect_mismatch&client_id=7is7531s6c2l86gh4r2au5arrhP

![alt text](<CleanShot 2026-01-23 at 05.59.04.png>)

Cognito の設定反映には少し時間がかかることもあります。

設定値に問題がなければ、少し待ってから再度試してみてください。

## まとめ

Better Auth と Cognito の連携により、以下を実現できました。

- ステートレスな認証（DB レス）
- Cognito マネージドログイン画面の利用
- シンプルな実装（数行のコード）

Cognito の連携は、Amplify を使った連携もありますが、Better Auth で作っておくと、認証・認可部分を切り離せるため有用です。

記事のボリュームの関係上、Cognito を経由した SSO についての記載ができなかったので、次回紹介します。
