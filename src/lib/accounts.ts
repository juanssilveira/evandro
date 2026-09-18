import { db } from "@/db";
import { accounts, accountMembers, user, type Account } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ProvisionUserInput {
  id: string;
  name?: string | null;
}

export async function provisionInitialAccount(
  userInput: ProvisionUserInput,
  targetDb = db
): Promise<Account> {
  return await targetDb.transaction(async (tx) => {
    // Check if membership already exists (idempotent / recovery protection)
    const [existingMembership] = await tx
      .select()
      .from(accountMembers)
      .where(eq(accountMembers.userId, userInput.id))
      .limit(1);

    if (existingMembership) {
      const [existingAccount] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, existingMembership.accountId))
        .limit(1);

      if (existingAccount) {
        return existingAccount;
      }
    }

    const accountName = userInput.name?.trim() || "Minha Conta";

    const [newAccount] = await tx
      .insert(accounts)
      .values({
        name: accountName,
      })
      .returning();

    await tx.insert(accountMembers).values({
      accountId: newAccount.id,
      userId: userInput.id,
      role: "owner",
    });

    return newAccount;
  });
}

export async function getCurrentAccount(
  userId: string
): Promise<Account | null> {
  const [membership] = await db
    .select({
      account: accounts,
    })
    .from(accountMembers)
    .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .where(eq(accountMembers.userId, userId))
    .limit(1);

  if (membership) {
    return membership.account;
  }

  // If user has no membership yet, provision account automatically
  const [userData] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) {
    return null;
  }

  return await provisionInitialAccount({
    id: userData.id,
    name: userData.name,
  });
}
