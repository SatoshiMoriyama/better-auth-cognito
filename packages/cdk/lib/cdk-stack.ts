import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Poolの作成
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'my-user-pool',
      // サインインオプション
      signInAliases: {
        email: true,
        username: true,
      },
      // セルフサインアップを有効化
      selfSignUpEnabled: true,
      // ユーザー検証設定
      autoVerify: {
        email: true,
      },
      // パスワードポリシー
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      // アカウント復旧設定
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // 標準属性
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      // リソース削除時の動作（開発環境用）
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognitoドメインの設定（マネージドログインに必要）
    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        // ユニークなドメインプレフィックスを指定
        // 本番環境では環境変数やパラメータから取得することを推奨
        domainPrefix: `my-app-${cdk.Stack.of(this).account}`,
      },
    });

    // アプリクライアントの作成（マネージドログイン対応）
    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: 'my-app-client',
      // OAuth設定
      oAuth: {
        // 認可フロー
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        // スコープ
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        // コールバックURL（実際のアプリケーションURLに置き換える）
        callbackUrls: [
          'http://localhost:3000/callback',
          'https://example.com/callback',
        ],
        // ログアウトURL
        logoutUrls: [
          'http://localhost:3000',
          'https://example.com',
        ],
      },
      // 認証フロー
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      // トークンの有効期限
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      // セキュリティ設定
      preventUserExistenceErrors: true,
      // クライアントシークレットを生成しない（SPAの場合）
      generateSecret: false,
    });

    // CloudFormation出力
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: userPoolDomain.domainName,
      description: 'Cognito User Pool Domain',
      exportName: 'UserPoolDomain',
    });

    new cdk.CfnOutput(this, 'HostedUIUrl', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com/login?client_id=${userPoolClient.userPoolClientId}&response_type=code&redirect_uri=http://localhost:3000/callback`,
      description: 'Cognito Hosted UI Login URL',
      exportName: 'HostedUIUrl',
    });
  }
}
