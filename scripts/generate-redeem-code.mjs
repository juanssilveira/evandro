import * as dotenv from "dotenv";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

// Parse CLI flags: --days <N>, --plan <name>
const args = process.argv.slice(2);
let daysVal = null;
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

const normalizedPlan = (planVal || "pro").trim().toLowerCase();
if (normalizedPlan !== "pro") {
  console.error(`Erro: Plano inválido "${planVal}". Apenas o plano "pro" é suportado no momento.`);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Erro: DATABASE_URL não configurada.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  const getBlock = (len) => {
    const bytes = crypto.randomBytes(len);
    let s = "";
    for (let i = 0; i < len; i++) {
      s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return s;
  };
  return `EVN-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}`;
}

function hashCode(code) {
  const norm = code.trim().toUpperCase();
  return crypto.createHash("sha256").update(norm).digest("hex");
}

async function main() {
  try {
    const code = generateCode();
    const codeHash = hashCode(code);

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO redeem_codes (id, code_hash, plan_code, duration_days, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
        [codeHash, normalizedPlan, durationDays]
      );
    } finally {
      client.release();
    }

    const planDisplay = normalizedPlan === "pro" ? "Pro" : normalizedPlan.toUpperCase();
    console.log("Redeem code created\n");
    console.log(`Code: ${code}`);
    console.log(`Plan: ${planDisplay}`);
    console.log(`Duration: ${durationDays} days`);

    process.exit(0);
  } catch (error) {
    console.error("Erro ao gerar código de resgate:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
