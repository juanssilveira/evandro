import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema/auth";
import { provisionInitialAccount } from "@/lib/accounts";
import { sendPasswordResetEmail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [
    admin(),
  ],
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
        after: async (user) => {
          await provisionInitialAccount({
            id: user.id,
            name: user.name,
          });
        },
      },
    },
  },
});
