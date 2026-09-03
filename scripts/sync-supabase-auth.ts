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

function getSupabaseConfig() {
  const rawUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !secretKey) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) in .env or .env.local",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Supabase URL: ${rawUrl}`);
  }

  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error(
      "Supabase URL must be the project root URL, for example https://ayktccawcpxmhpauwqie.supabase.co",
    );
  }

  // The Supabase JS client adds /auth/v1, /rest/v1, etc. itself.
  // Strip API paths if one was accidentally copied from a Supabase endpoint.
  if (url.pathname !== "/" && url.pathname !== "") {
    const allowedApiPaths = ["/rest/v1", "/auth/v1", "/storage/v1", "/functions/v1"];
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

  return { supabaseUrl: url.toString().replace(/\/$/, ""), secretKey };
}

function createAdminClient(supabaseUrl: string, secretKey: string) {
  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function listAllAuthUsers(supabase: ReturnType<typeof createAdminClient>): Promise<User[]> {
  const users: User[] = [];
  let page = 1;

  while (true) {
    const response = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (response.error) throw response.error;
    users.push(...response.data.users);

    if (response.data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function main() {
  loadLocalEnv();

  const { supabaseUrl, secretKey } = getSupabaseConfig();
  const supabase = createAdminClient(supabaseUrl, secretKey);

  const defaultPassword =
    process.env.CLASS_PULSE_DEFAULT_PASSWORD || "changeme123";

  const appUsers = await prisma.user.findMany({ orderBy: { email: "asc" } });
  const authUsers = await listAllAuthUsers(supabase);

  const authByEmail = new Map(
    authUsers
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user]),
  );

  for (const appUser of appUsers) {
    const email = appUser.email.trim().toLowerCase();
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

    if (!authUser?.id) {
      throw new Error(`Supabase Auth returned no user ID for ${email}`);
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
