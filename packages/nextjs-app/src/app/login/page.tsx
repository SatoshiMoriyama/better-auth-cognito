'use client';

import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  useEffect(() => {
    // ページ表示時に自動的にCognitoログインへ
    authClient.signIn.social({
      provider: 'cognito',
      callbackURL: '/',
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
    </div>
  );
}
