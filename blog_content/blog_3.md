# Amazon Cognito の新機能 Inbound Federation Trigger で IdP 属性を柔軟にマッピングする

[f:id:swx-satoshi-moriyama:20260205064814j:plain]

[:contents]

## はじめに

こんにちは！

アプリケーションサービス本部ディベロップメントサービス１課の森山です。

今回は 2026/1/29 に発表された Amazon Cognito の新機能を確認してみます。

[https://aws.amazon.com/jp/about-aws/whats-new/2026/01/amazon-cognito-inbound-federation-lambda-trigger/:embed:cite]

Cognito には認証フローの各段階で Lambda 関数を実行できる Lambda トリガー機能があり、今回 Inbound Federation という新しいトリガーが追加されました。

マネジメントコンソール上だと、下記の部分です。

[f:id:swx-satoshi-moriyama:20260205064636p:plain]

この Inbound Federation Trigger は Identity Provider（IdP）から連携される各種属性を、ユーザープールへ保存される前に確認・編集できるトリガーです。

この新機能により、IdP 側の設定を変更することなく、各種属性のカスタマイズが可能となりました。

### この記事で学べること

- Cognito の Inbound Federation Trigger の概要と用途
- Auth0 から連携される `user_metadata` を Cognito で扱いやすい形に変換する方法
- CDK でエスケープハッチを使って新機能を設定する方法

### 前提知識・条件

- Cognito と外部 IdP（Auth0 など）の OIDC 連携の基本的な手順は割愛します

## 新機能でできること

この機能の用途は以下のページにいくつか記載されています。

[https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/user-pool-lambda-inbound-federation.html:embed:cite]

### 1. Group membership management（グループメンバーシップ管理）

IdP から受け取ったグループ情報を Cognito のユーザープールグループにマッピング可能です。

例えば、企業の Microsoft Active Directory で「Domain Admins」に所属しているユーザーを Cognito の「Administrators」グループへ追加できます。

これにより、Post Authentication トリガーを使わずにグループ管理が可能になります。

### 2. Truncate large attributes（大きな属性の切り詰め）

Cognito のユーザー属性には 2048 文字という制限があります。

IdP から送られてくる属性値がこの制限を超える場合、このトリガーで値を切り詰めることができます。

例えば、長い自己紹介文や JSON 形式のメタデータなどを適切な長さに調整し、エラーを防ぐことができます。

### 3. Logging federation events（フェデレーションイベントのログ記録）

フェデレーション認証の詳細情報を Amazon CloudWatch Logs に記録できます。

どの IdP からどのような属性が送られてきたかを可視化することで、認証フローのデバッグやモニタリングに役立ちます。

## やってみた

今回は、JSON 文字列として連携される `user_metadata` を個別の属性に展開する、シンプルな変換処理を例に説明します。

普段個人利用している Auth0 を IdP として利用し、以下のような動作確認を行います。

1. Auth0 上のユーザーに `role` というユーザメタデータを付与する
2. これを Inbound Federation Trigger で属性マッピングしやすい形に整形する
3. Cognito 上のユーザー属性（`custom:role`）にマッピングする

1 のユーザメタデータは `"user_metadata": "{\"role\":\"developer\"}"` といった形で連携されますが、JSON 形式となっており、そのまま扱うのは難しいです。

Inbound Federation Trigger を使うことで、IdP 側の設定を変更せず、Cognito 側だけで JSON を展開できます。

個別の属性として保存できるため、アプリケーション側の実装もシンプルになります。

### 準備: ユーザメタデータの付与

今回 Auth0 の詳細な設定方法は割愛しますが、下記のようにユーザメタデータを設定します。`role` 属性を付与しておきます。

[f:id:swx-satoshi-moriyama:20260205064704p:plain]

また、ID トークン上でこのユーザメタデータを付与するように `Post Login` のアクションをカスタマイズしておきます。

[f:id:swx-satoshi-moriyama:20260205064717p:plain]

```javascript
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
    // user_metadataを追加
    if (event.user.user_metadata) {
      api.idToken.setCustomClaim(`user_metadata`, event.user.user_metadata);
    }
};
```

準備完了です。

Auth0 については大幅に記載を省略しているため該当のドキュメントのリンクも記載しておきます。

[https://auth0.com/docs/ja-jp/secure/tokens/json-web-tokens/create-custom-claims:title]

[https://auth0.com/docs/ja-jp/troubleshoot/product-lifecycle/past-migrations/custom-claims-migration:title]

### Inbound Federation Triggerの設定

次に Inbound Federation Trigger の設定をしていきます。

マネジメントコンソール上では、冒頭の画像のところから設定すれば問題ありません。

また IaC で構築する場合、2026/02/05（v2.237.1）時点ではまだ CDK でのサポートがないため、エスケープハッチで対応可能です。

```typescript
const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
cfnUserPool.addPropertyOverride('LambdaConfig.InboundFederation', {
    LambdaArn: inboundFederationFunction.functionArn,
    LambdaVersion: 'V1_0',
});
```

Lambda のコードは以下の通りです。

```javascript
export const handler = async (event) => {
  const { providerName, providerType, attributes } = event.request;

  console.log('=== Inbound Federation Trigger ===');
  console.log(`Provider: ${providerName} (${providerType})`);

  // OIDC: userInfo と idToken をマージ
  const userAttributes = {
    ...(attributes.userInfo || {}),
    ...(attributes.idToken || {}),
  };

  console.log(
    'User Attributes (Before):',
    JSON.stringify(userAttributes, null, 2),
  );

  // user_metadata を展開
  if (userAttributes.user_metadata) {
    try {
      const metadata =
        typeof userAttributes.user_metadata === 'string'
          ? JSON.parse(userAttributes.user_metadata)
          : userAttributes.user_metadata;

      Object.assign(userAttributes, metadata);
      delete userAttributes.user_metadata;

      console.log(
        'User Attributes (After):',
        JSON.stringify(userAttributes, null, 2),
      );
    } catch (e) {
      console.log('Failed to parse user_metadata:', e.message);
    }
  }

  event.response = { userAttributesToMap: userAttributes };
  return event;
};
```

OIDC の userInfo と idToken の属性をマージし、ユーザメタデータの JSON を平坦化した上でレスポンスに戻しています。

なお、今回はシンプルに記載したいため、SAML の考慮は入れていません。

また、`userAttributesToMap` に含めなかった属性はユーザープロファイルに保存されない点に注意してください。
必要な属性はすべて含める必要があります。

### 属性マッピングの設定

下記の通り、属性マッピングを設定しておきます。

[f:id:swx-satoshi-moriyama:20260205064737p:plain]

JSON で連携されたデータを平坦化しているため、`role` というシンプルな名前でマッピング可能です。

### 動作確認

では、実際にログイン動作を試してみます。

Inbound Federation Trigger のログは以下のような感じです。

#### 変換前

```json
2026-02-04T20:52:11.580Z xxxxx INFO User Attributes (Before):
{
    "sub": "auth0|xxxxxxxxxxxxxxxxxx",
    "email_verified": "false",
    "user_metadata": "{\"role\":\"developer\"}",
    "updated_at": "2026-02-04T20:52:09.822Z",
    "nickname": "example-user",
    "name": "example@example.com",
    "picture": "https://s.gravatar.com/avatar/xxxxxxxx?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fex.png",
    "email": "example@example.com",
    "iss": "https://your-tenant.auth0.com/",
    "sid": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "aud": "[your-client-id]",
    "exp": "Thu Feb 05 06:52:10 UTC 2026",
    "iat": "Wed Feb 04 20:52:10 UTC 2026"
}
```

#### 変換後

`user_metadata` 属性が削除され、`role` 属性が増えていることが確認できますね。

```json
2026-02-04T20:52:11.580Z xxxxx INFO User Attributes (After):
{
    "sub": "auth0|xxxxxxxxxxxxxxxxxx",
    "email_verified": "false",
    "updated_at": "2026-02-04T20:52:09.822Z",
    "nickname": "example-user",
    "name": "example@example.com",
    "picture": "https://s.gravatar.com/avatar/xxxxxxxx?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fex.png",
    "email": "example@example.com",
    "iss": "https://your-tenant.auth0.com/",
    "sid": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "aud": "[your-client-id]",
    "exp": "Thu Feb 05 06:52:10 UTC 2026",
    "iat": "Wed Feb 04 20:52:10 UTC 2026",
    "role": "developer"
}

```

そして、最後に Cognito 上のユーザを確認すると、`custom:role` に正しく `role` 属性がマッピングされていることが確認できました！

[f:id:swx-satoshi-moriyama:20260205064749p:plain]

## まとめ

今回は Cognito の新機能 Inbound Federation Trigger を紹介しました。

この機能により、以下のようなメリットがあります。

- IdP 側の設定変更が不要: Cognito 側だけで属性の変換・整形が可能
- デバッグが容易: フェデレーション時の属性を CloudWatch Logs で確認できる
- 柔軟な属性マッピング: JSON 形式のデータを平坦化し、個別の属性として保存できる

従来は Post Authentication トリガーや IdP 側での対応が必要だったケースも、この新機能で Cognito 側だけで完結できるようになりました。

外部 IdP との連携で属性マッピングに悩んでいる方は、ぜひ試してみてください。

個人的には、連携される全ての属性をデバッグ表示できる点も非常に良いポイントかと感じました。
