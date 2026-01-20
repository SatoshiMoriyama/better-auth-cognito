import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  // セッションCookieをチェック
  const session = request.cookies.get('better-auth.session_token');

  // 未認証かつログインページ以外の場合、ログインページへリダイレクト
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// 認証が必要なパスを指定（API、静的ファイル、ログインページは除外）
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};
