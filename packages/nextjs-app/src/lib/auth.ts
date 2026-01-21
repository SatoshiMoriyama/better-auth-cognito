import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';

export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'cognito',
          clientId: process.env.COGNITO_CLIENT_ID as string,
          clientSecret: process.env.COGNITO_CLIENT_SECRET as string,
          discoveryUrl: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USERPOOL_ID}/.well-known/openid-configuration`,
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          // Cognitoのマネージドログインをスキップして、直接Auth0にリダイレクト
          authorizationUrlParams: {
            identity_provider: 'Auth0',
          },
          mapProfileToUser: (profile) => {
            return {
              name: profile.name || profile.email || profile.sub || 'Unknown',
              email: profile.email,
              image: profile.picture,
            };
          },
        },
      ],
    }),
  ],

  secret: process.env.BETTER_AUTH_SECRET as string,
  baseURL: process.env.BETTER_AUTH_URL as string,
});
