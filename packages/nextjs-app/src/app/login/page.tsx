'use client';

import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  useEffect(() => {
    // Better Auth経由でCognitoログインへ（マネージドログイン表示）
    authClient.signIn.social({
      provider: 'cognito',
      callbackURL: '/',
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>ログイン中...</p>
    </div>
  );
}
