import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/classes', '/admin'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtected) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const match = pathname.match(/^\/subject-analysis\/([^/]+)\/academic$/);
  if (!match) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/combined-analysis-fixed/${match[1]}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/dashboard/:path*', '/classes/:path*', '/admin/:path*', '/subject-analysis/:subjectId/academic'],
};
