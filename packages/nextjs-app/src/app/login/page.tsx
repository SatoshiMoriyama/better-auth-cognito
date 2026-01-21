'use client';

import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  useEffect(() => {
    // Generic OAuth経由でCognitoログインへ（直接Auth0にリダイレクト）
    authClient.signIn.oauth2({
      providerId: 'cognito',
      callbackURL: '/',
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>ログイン中...</p>
    </div>
  );
}
