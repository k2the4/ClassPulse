import { PrismaClient } from "@prisma/client";
import { createServerClient } from "@supabase/ssr";

const prisma = new PrismaClient();

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    cookies: {
      getAll: () => [],
      setAll: () => undefined,
    },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  },
);

const DEFAULT_PASSWORD = process.env.CLASS_PULSE_DEFAULT_PASSWORD || "changeme123";

async function listAllAuthUsers() {
  const users: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const [appUsers, authUsers] = await Promise.all([
    prisma.user.findMany({ orderBy: { email: "asc" } }),
    listAllAuthUsers(),
  ]);

  const byEmail = new Map(authUsers.map((user) => [user.email?.toLowerCase(), user]));

  for (const appUser of appUsers) {
    const email = appUser.email.toLowerCase();
    let authUser = byEmail.get(email);

    if (authUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: appUser.name },
      });
      if (error) throw error;
      authUser = data.user;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: appUser.name },
      });
      if (error) throw error;
      authUser = data.user;
    }

    await prisma.user.update({
      where: { id: appUser.id },
      data: { authUserId: authUser.id },
    });

    console.log(`Linked ${appUser.email}`);
  }

  console.log(`Done. Synced ${appUsers.length} Prisma users with Supabase Auth.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
