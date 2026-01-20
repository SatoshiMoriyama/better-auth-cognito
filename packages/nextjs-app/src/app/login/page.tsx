'use client';

import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const handleCognitoLogin = async () => {
    await authClient.signIn.social({
      provider: 'cognito',
      callbackURL: '/',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-8">
        <h2 className="text-center text-3xl font-bold">ログイン</h2>

        <button
          type="button"
          onClick={handleCognitoLogin}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Cognitoでログイン
        </button>
      </div>
    </div>
  );
}
