import { createServerClient } from '@supabase/ssr'; import { NextResponse, type NextRequest } from 'next/server';
const protectedPaths=['/dashboard','/classes','/admin'];
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export async function middleware(request: NextRequest) { let response=NextResponse.next({request}); const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,publicKey,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>items.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}); const {data:{user}}=await supabase.auth.getUser(); if(protectedPaths.some(path=>request.nextUrl.pathname.startsWith(path)) && !user) return NextResponse.redirect(new URL('/login',request.url)); return response; }
export const config={matcher:['/dashboard/:path*','/classes/:path*','/admin/:path*']};
