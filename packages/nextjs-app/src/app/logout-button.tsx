"use client";

import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const handleLogout = async () => {
    // 1. Better Authのセッションをクリア
    await authClient.signOut();

    // 2. 最終的なログアウト先（アプリのログアウトページ）
    const finalLogoutUrl = `${window.location.origin}/logout`;

    // 3. CognitoログアウトURL（Auth0からのreturnTo先）
    const cognitoLogoutUrl = `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/logout?client_id=${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(finalLogoutUrl)}`;

    // 4. Auth0ログアウトURL（Cognitoにリダイレクト）
    const auth0LogoutUrl = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/v2/logout?client_id=${process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(cognitoLogoutUrl)}`;

    // 5. Auth0からログアウト開始（Auth0 → Cognito → /logout の順にリダイレクト）
    window.location.href = auth0LogoutUrl;
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
    >
      ログアウト
    </button>
  );
}
