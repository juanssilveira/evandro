import * as dotenv from "dotenv";
import * as path from "node:path";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

import { createRedeemCode } from "@/lib/plans/redeem";

const args = process.argv.slice(2);
let daysVal: string | null = null;
let planVal = "pro";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--days" || arg === "-d") {
    daysVal = args[i + 1];
    i++;
  } else if (arg.startsWith("--days=")) {
    daysVal = arg.split("=")[1];
  } else if (arg === "--plan" || arg === "-p") {
    planVal = args[i + 1];
    i++;
  } else if (arg.startsWith("--plan=")) {
    planVal = arg.split("=")[1];
  } else if (!daysVal && /^\d+$/.test(arg)) {
    daysVal = arg;
  }
}

if (!daysVal) {
  console.error("Erro: Duração em dias não fornecida.");
  console.error("Uso: pnpm redeem:generate --days <dias> [--plan pro]");
  console.error("Exemplo: pnpm redeem:generate --days 30");
  process.exit(1);
}

const durationDays = parseInt(daysVal, 10);
if (isNaN(durationDays) || durationDays <= 0 || !Number.isInteger(durationDays)) {
  console.error(`Erro: Duração inválida "${daysVal}". Deve ser um número inteiro positivo.`);
  process.exit(1);
}

async function main() {
  try {
    const result = await createRedeemCode({
      durationDays,
      planCode: planVal,
    });

    const planDisplay = result.planCode === "pro" ? "Pro" : result.planCode.toUpperCase();
    console.log("Redeem code created\n");
    console.log(`Code: ${result.code}`);
    console.log(`Plan: ${planDisplay}`);
    console.log(`Duration: ${result.durationDays} days`);

    process.exit(0);
  } catch (error) {
    console.error("Erro ao gerar código de resgate:", error);
    process.exit(1);
  }
}

main();
