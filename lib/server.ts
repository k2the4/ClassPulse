import { createServerClient } from '@supabase/ssr'; import { cookies } from 'next/headers';
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export async function serverClient() { const store=cookies(); return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,publicKey,{cookies:{getAll:()=>store.getAll(),setAll:()=>{}}}); }
export async function currentProfile() { const client=await serverClient(); const {data:{user}}=await client.auth.getUser(); if(!user) return null; const {data}=await client.from('profiles').select('*').eq('id',user.id).single(); return data; }
