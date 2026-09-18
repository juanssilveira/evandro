import { type Account } from "@/db/schema";

export function isAccountActive(account: Pick<Account, "status"> | null | undefined): boolean {
  if (!account) return false;
  return account.status === "active";
}

export function assertAccountActive(account: Pick<Account, "status"> | null | undefined): void {
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }
  if (account.status === "disabled") {
    throw new Error("ACCOUNT_DISABLED");
  }
}
