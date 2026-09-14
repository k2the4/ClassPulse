import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

function normalizeSupabaseUrl(raw: string) {
  try {
    return new URL(raw.trim()).origin;
  } catch {
    throw new Error("Supabase URL is invalid. Use the project URL, e.g. https://<project-ref>.supabase.co");
  }
}

export function getSupabaseBrowser() {
  if (client) return client;
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase browser environment variables are missing.");
  client = createClient(normalizeSupabaseUrl(rawUrl), key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
