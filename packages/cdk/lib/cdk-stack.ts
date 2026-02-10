import * as path from 'node:path';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib/core';
import type { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Inbound Federation Lambda関数の作成
    const inboundFederationFunction = new lambda.Function(
      this,
      'InboundFederationFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda/inbound-federation'),
        ),
        timeout: cdk.Duration.seconds(10),
        description: 'Auth0属性をログ出力するInbound Federation Trigger',
      },
    );

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
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: {
          required: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognitoドメインの設定
    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `my-app-${cdk.Stack.of(this).account}`,
      },
    });

    // Auth0 IDプロバイダーの追加（OIDC）
    const auth0Provider = new cognito.UserPoolIdentityProviderOidc(
      this,
      'Auth0Provider',
      {
        userPool,
        name: 'Auth0',
        clientId: process.env.AUTH0_CLIENT_ID || '',
        clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
        issuerUrl: `https://${process.env.AUTH0_DOMAIN}`,
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: cognito.ProviderAttribute.other('email'),
          profilePicture: cognito.ProviderAttribute.other('picture'),
          custom: {
            'custom:role': cognito.ProviderAttribute.other('role'),
          },
        },
      },
    );

    // アプリクライアントの作成
    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: 'my-app-client',
      // Auth0プロバイダーへの依存関係を追加
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.custom('Auth0'),
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
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
          'http://localhost:3000/api/auth/callback/cognito',
          'http://localhost:3001/api/auth/callback/cognito',
        ],
        logoutUrls: [
          'http://localhost:3000/login',
          'http://localhost:3001/login',
        ],
      },
      generateSecret: true,
    });

    // Auth0プロバイダーが作成されてからクライアントを作成
    userPoolClient.node.addDependency(auth0Provider);

    // Lambda関数にCognitoからの呼び出し権限を付与
    inboundFederationFunction.addPermission('CognitoInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: userPool.userPoolArn,
    });

    // L1コンストラクトを使ってInbound Federationトリガーを設定
    // CDKのL2コンストラクトではまだサポートされていないため
    const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.addPropertyOverride('LambdaConfig.InboundFederation', {
      LambdaArn: inboundFederationFunction.functionArn,
      LambdaVersion: 'V1_0',
    });

    // 強制更新用のタグ（ドリフト修正）
    cdk.Tags.of(userPool).add('LastUpdated', new Date().toISOString());

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

    new cdk.CfnOutput(this, 'UserPoolClientSecret', {
      value: userPoolClient.userPoolClientSecret.unsafeUnwrap(),
      description: 'Cognito User Pool Client Secret',
      exportName: 'UserPoolClientSecret',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito User Pool Domain (Full URL for COGNITO_DOMAIN)',
      exportName: 'UserPoolDomain',
    });

    new cdk.CfnOutput(this, 'HostedUIUrl', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com/login?client_id=${userPoolClient.userPoolClientId}&response_type=code&redirect_uri=http://localhost:3000/api/auth/callback/cognito`,
      description: 'Cognito Hosted UI Login URL',
      exportName: 'HostedUIUrl',
    });

    new cdk.CfnOutput(this, 'InboundFederationFunctionArn', {
      value: inboundFederationFunction.functionArn,
      description: 'Inbound Federation Lambda Function ARN',
      exportName: 'InboundFederationFunctionArn',
    });
  }
}
