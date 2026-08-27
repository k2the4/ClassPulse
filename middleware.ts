import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/classes', '/admin'];

export async function middleware(request: NextRequest) {
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/classes/:path*', '/admin/:path*'],
};
