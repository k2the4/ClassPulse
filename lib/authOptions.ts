import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "./prisma";

function getSupabaseAuthClient() {
  const rawUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl) {
    throw new Error("Missing Supabase URL. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!publishableKey) {
    throw new Error(
      "Missing Supabase publishable key. Set SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Supabase URL: ${rawUrl}`);
  }

  // Supabase clients expect the project root URL. Accept common API URLs
  // copied from the dashboard and normalize them back to the project root.
  const allowedApiPaths = ["/rest/v1", "/auth/v1", "/storage/v1", "/functions/v1"];
  if (url.pathname !== "/" && url.pathname !== "") {
    if (allowedApiPaths.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
      url.pathname = "/";
      url.search = "";
      url.hash = "";
    } else {
      throw new Error(
        `Invalid Supabase URL path: ${url.pathname}. Use the project root URL, for example https://ayktccawcpxmhpauwqie.supabase.co`,
      );
    }
  }

  return createClient(url.toString().replace(/\/$/, ""), publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Supabase Auth",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const supabaseAuth = getSupabaseAuthClient();
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
          email,
          password: credentials.password,
        });

        if (error || !data.user?.id) {
          if (process.env.NODE_ENV !== "production") {
            console.error("Supabase login failed:", error?.message ?? "No user returned");
          }
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          if (process.env.NODE_ENV !== "production") {
            console.error(`Supabase login succeeded but no ClassPulse user exists for ${email}`);
          }
          return null;
        }

        if (user.authUserId !== data.user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { authUserId: data.user.id },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          collegeId: user.collegeId,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.collegeId = (user as any).collegeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).collegeId = token.collegeId;
      }
      return session;
    },
  },
};
