import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const session = request.cookies.get('better-auth.session_token');

  // 未認証の場合、ログインページへリダイレクト（ログアウトページは除外）
  if (
    !session &&
    !request.nextUrl.pathname.startsWith('/api/auth') &&
    request.nextUrl.pathname !== '/login' &&
    request.nextUrl.pathname !== '/logout'
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|logout).*)'],
};
