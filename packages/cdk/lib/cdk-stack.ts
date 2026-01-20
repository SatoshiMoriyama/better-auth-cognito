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
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
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
          'http://localhost:3000/api/auth/callback/cognito',
          'https://example.com/api/auth/callback/cognito',
        ],
        logoutUrls: [
          'http://localhost:3000/logout',
          'https://example.com/logout',
        ],
      },
      generateSecret: true,
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
  }
}
