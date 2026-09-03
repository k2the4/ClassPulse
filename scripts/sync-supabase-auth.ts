import { PrismaClient } from "@prisma/client";
import { createClient, type User } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type Env = Record<string, string>;

function loadDotEnv(filePath: string): Env {
  if (!fs.existsSync(filePath)) return {};

  const values: Env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[match[1]] = value;
  }

  return values;
}

function loadLocalEnv() {
  const root = process.cwd();
  const envFiles = [".env", ".env.local"];

  for (const file of envFiles) {
    const values = loadDotEnv(path.join(root, file));
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function listAllAuthUsers(supabase: any): Promise<User[]> {
  const users: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;
    users.push(...data.users);

    if (data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env or .env.local",
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const defaultPassword =
    process.env.CLASS_PULSE_DEFAULT_PASSWORD || "changeme123";

  const [appUsers, authUsers] = await Promise.all([
    prisma.user.findMany({ orderBy: { email: "asc" } }),
    listAllAuthUsers(supabase),
  ]);

  const authByEmail = new Map(
    authUsers
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user]),
  );

  for (const appUser of appUsers) {
    const email = appUser.email.toLowerCase();
    let authUser = authByEmail.get(email);

    if (authUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          password: defaultPassword,
          email_confirm: true,
          user_metadata: { full_name: appUser.name },
        },
      );

      if (error) throw error;
      authUser = data.user;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: defaultPassword,
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

    console.log(`Linked ${email}`);
  }

  const unlinked = await prisma.user.count({
    where: { authUserId: null },
  });

  if (unlinked !== 0) {
    throw new Error(`Auth sync finished with ${unlinked} unlinked user(s).`);
  }

  console.log(`Done. Synced ${appUsers.length} Prisma users with Supabase Auth.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
