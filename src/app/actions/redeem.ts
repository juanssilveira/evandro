"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redeemCodeForUser } from "@/lib/plans/redeem";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const redeemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Informe o código de resgate."),
});

export async function redeemCodeAction(rawInput: unknown) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { error: "Não autorizado." };
  }

  const parsed = redeemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Código inválido." };
  }

  const result = await redeemCodeForUser(session.user.id, parsed.data.code);
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
