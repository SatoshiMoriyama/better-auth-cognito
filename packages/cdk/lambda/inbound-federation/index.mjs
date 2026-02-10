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
