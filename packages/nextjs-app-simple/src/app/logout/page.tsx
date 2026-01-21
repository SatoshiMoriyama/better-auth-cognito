import Link from 'next/link';

export default function LogoutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">ログアウトしました</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          トップページに戻る
        </Link>
      </div>
    </div>
  );
}
