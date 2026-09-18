import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import * as schema from "@/db/schema/auth";
import { provisionInitialAccount } from "@/lib/accounts";
import { sendPasswordResetEmail } from "@/lib/email";
import { getAdminDb, type AdminDb } from "./db";
import type { AdminEnvironment } from "./env-config";

function createAdminAuthInstance(adminDb: AdminDb) {
  return betterAuth({
    database: drizzleAdapter(adminDb, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL:
      process.env.BETTER_AUTH_URL ||
      process.env.APP_PUBLIC_URL ||
      process.env.BASE_URL ||
      "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    plugins: [admin()],
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, token }) => {
        const publicBaseUrl = (
          process.env.APP_PUBLIC_URL ||
          process.env.BETTER_AUTH_URL ||
          process.env.BASE_URL ||
          "http://localhost:3000"
        ).replace(/\/$/, "");
        const resetUrl = `${publicBaseUrl}/reset-password?token=${token}`;

        await sendPasswordResetEmail({
          email: user.email,
          name: user.name,
          resetUrl,
          token,
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await provisionInitialAccount(
              {
                id: createdUser.id,
                name: createdUser.name,
              },
              adminDb
            );
          },
        },
      },
    },
  });
}

type AdminAuthInstance = ReturnType<typeof createAdminAuthInstance>;

const adminAuthCache: Partial<Record<AdminEnvironment, AdminAuthInstance>> = {};

/**
 * Returns a Better Auth instance configured to query and mutate strictly the selected environment's DB.
 * URLs and secrets remain local.
 */
export function getAdminAuth(env: AdminEnvironment): AdminAuthInstance {
  if (adminAuthCache[env]) {
    return adminAuthCache[env]!;
  }

  const adminDb = getAdminDb(env);
  const authInstance = createAdminAuthInstance(adminDb);

  adminAuthCache[env] = authInstance;
  return authInstance;
}
