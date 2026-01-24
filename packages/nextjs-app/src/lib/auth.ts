import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  socialProviders: {
    cognito: {
      clientId: process.env.COGNITO_CLIENT_ID as string,
      clientSecret: process.env.COGNITO_CLIENT_SECRET as string,
      domain: process.env.COGNITO_DOMAIN as string,
      region: process.env.COGNITO_REGION as string,
      userPoolId: process.env.COGNITO_USERPOOL_ID as string,
      authorizationEndpoint: `https://${process.env.COGNITO_DOMAIN}/oauth2/authorize?identity_provider=${process.env.COGNITO_IDENTITY_PROVIDER}`,
    },
  },

  secret: process.env.BETTER_AUTH_SECRET as string,
  baseURL: process.env.BETTER_AUTH_URL as string,
});
