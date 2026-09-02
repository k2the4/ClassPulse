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

  const subjectAcademicMatch = pathname.match(/^\/subject-analysis\/([^/]+)\/academic$/);
  if (subjectAcademicMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/combined-analysis-fixed/${subjectAcademicMatch[1]}`;
    return NextResponse.rewrite(url);
  }

  const studentReportMatch = pathname.match(/^\/section-analysis\/([^/]+)\/students$/);
  if (studentReportMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/class-analysis-student-shell-fixed/${studentReportMatch[1]}`;
    return NextResponse.rewrite(url);
  }

  const overallMatch = pathname.match(/^\/section-analysis\/([^/]+)\/overall$/);
  if (overallMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/class-analysis-overall-heading-fixed/${overallMatch[1]}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/classes/:path*',
    '/admin/:path*',
    '/subject-analysis/:subjectId/academic',
    '/section-analysis/:sectionId/students',
    '/section-analysis/:sectionId/overall',
  ],
};
