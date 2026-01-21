"use client";

import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const handleLogout = async () => {
    // Better Authのセッションをクリア
    await authClient.signOut();

    // Cognitoログアウト（マネージドログインからもログアウト）
    const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const logoutUri = `${window.location.origin}/logout`;

    window.location.href = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
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
