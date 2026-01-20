"use client";

import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const handleLogout = async () => {
    // Cognitoログアウト後のリダイレクト先を指定（ログアウトページへ）
    const cognitoLogoutUrl = `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/logout?client_id=${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(`${window.location.origin}/logout`)}`;
    
    // Better Authのログアウト
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = cognitoLogoutUrl;
        },
      },
    });
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
