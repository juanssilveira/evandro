import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";

export type AdminEnvironment = "development" | "production";

export interface AdminInfraConfig {
  DATABASE_URL: string;

  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;

  BUNNY_STREAM_LIBRARY_ID?: string;
  BUNNY_STREAM_API_KEY?: string;
  BUNNY_STREAM_CDN_HOSTNAME?: string;
  BUNNY_ACCOUNT_API_KEY?: string;

  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ASSETS_BUCKET?: string;
}

export interface AdminEnvironmentStatus {
  development: {
    available: boolean;
    databaseUrlPresent: boolean;
  };
  production: {
    available: boolean;
    databaseUrlPresent: boolean;
    filePresent: boolean;
    reason?: string;
  };
}

/**
 * Parses .env.production without mutating global process.env.
 * Extracts only allowed infrastructure variables.
 */
function readProductionInfraConfig(): Partial<AdminInfraConfig> | null {
  try {
    const prodFilePath = path.resolve(process.cwd(), ".env.production");
    if (!fs.existsSync(prodFilePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(prodFilePath, "utf8");
    const parsed = dotenv.parse(fileContent);

    return {
      DATABASE_URL: parsed.DATABASE_URL?.trim() || undefined,
      MUX_TOKEN_ID: parsed.MUX_TOKEN_ID?.trim() || undefined,
      MUX_TOKEN_SECRET: parsed.MUX_TOKEN_SECRET?.trim() || undefined,
      BUNNY_STREAM_LIBRARY_ID: parsed.BUNNY_STREAM_LIBRARY_ID?.trim() || undefined,
      BUNNY_STREAM_API_KEY: parsed.BUNNY_STREAM_API_KEY?.trim() || undefined,
      BUNNY_STREAM_CDN_HOSTNAME: parsed.BUNNY_STREAM_CDN_HOSTNAME?.trim() || undefined,
      BUNNY_ACCOUNT_API_KEY: parsed.BUNNY_ACCOUNT_API_KEY?.trim() || undefined,
      R2_ACCOUNT_ID: parsed.R2_ACCOUNT_ID?.trim() || undefined,
      R2_ACCESS_KEY_ID: parsed.R2_ACCESS_KEY_ID?.trim() || undefined,
      R2_SECRET_ACCESS_KEY: parsed.R2_SECRET_ACCESS_KEY?.trim() || undefined,
      R2_ASSETS_BUCKET: parsed.R2_ASSETS_BUCKET?.trim() || undefined,
    };
  } catch (err) {
    console.error("[Admin Config] Failed to read .env.production:", err);
    return null;
  }
}

/**
 * Reads allowed infrastructure variables from current process.env (Development / .env.local).
 */
function readDevelopmentInfraConfig(): Partial<AdminInfraConfig> {
  let localParsed: Record<string, string> = {};
  try {
    const localFilePath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(localFilePath)) {
      localParsed = dotenv.parse(fs.readFileSync(localFilePath, "utf8"));
    }
  } catch {
    localParsed = {};
  }

  return {
    DATABASE_URL: (process.env.DATABASE_URL || localParsed.DATABASE_URL)?.trim() || undefined,
    MUX_TOKEN_ID: (process.env.MUX_TOKEN_ID || localParsed.MUX_TOKEN_ID)?.trim() || undefined,
    MUX_TOKEN_SECRET: (process.env.MUX_TOKEN_SECRET || localParsed.MUX_TOKEN_SECRET)?.trim() || undefined,
    BUNNY_STREAM_LIBRARY_ID: (process.env.BUNNY_STREAM_LIBRARY_ID || localParsed.BUNNY_STREAM_LIBRARY_ID)?.trim() || undefined,
    BUNNY_STREAM_API_KEY: (process.env.BUNNY_STREAM_API_KEY || localParsed.BUNNY_STREAM_API_KEY)?.trim() || undefined,
    BUNNY_STREAM_CDN_HOSTNAME: (process.env.BUNNY_STREAM_CDN_HOSTNAME || localParsed.BUNNY_STREAM_CDN_HOSTNAME)?.trim() || undefined,
    BUNNY_ACCOUNT_API_KEY: (process.env.BUNNY_ACCOUNT_API_KEY || localParsed.BUNNY_ACCOUNT_API_KEY)?.trim() || undefined,
    R2_ACCOUNT_ID: (process.env.R2_ACCOUNT_ID || localParsed.R2_ACCOUNT_ID)?.trim() || undefined,
    R2_ACCESS_KEY_ID: (process.env.R2_ACCESS_KEY_ID || localParsed.R2_ACCESS_KEY_ID)?.trim() || undefined,
    R2_SECRET_ACCESS_KEY: (process.env.R2_SECRET_ACCESS_KEY || localParsed.R2_SECRET_ACCESS_KEY)?.trim() || undefined,
    R2_ASSETS_BUCKET: (process.env.R2_ASSETS_BUCKET || localParsed.R2_ASSETS_BUCKET)?.trim() || undefined,
  };
}

/**
 * Returns availability and status of both development and production environments.
 */
export function getAdminEnvironmentStatus(): AdminEnvironmentStatus {
  const devConfig = readDevelopmentInfraConfig();
  const devDbPresent = Boolean(devConfig.DATABASE_URL && devConfig.DATABASE_URL.length > 0);

  const prodFilePath = path.resolve(process.cwd(), ".env.production");
  const prodFileExists = fs.existsSync(prodFilePath);
  const prodConfig = prodFileExists ? readProductionInfraConfig() : null;
  const prodDbPresent = Boolean(prodConfig?.DATABASE_URL && prodConfig.DATABASE_URL.length > 0);

  let prodReason: string | undefined;
  if (!prodFileExists) {
    prodReason = "Arquivo .env.production não encontrado no projeto.";
  } else if (!prodDbPresent) {
    prodReason = "DATABASE_URL ausente ou vazia no arquivo .env.production.";
  }

  return {
    development: {
      available: devDbPresent,
      databaseUrlPresent: devDbPresent,
    },
    production: {
      available: prodFileExists && prodDbPresent,
      databaseUrlPresent: prodDbPresent,
      filePresent: prodFileExists,
      reason: prodReason,
    },
  };
}

/**
 * Gets isolated infrastructure configuration for the selected environment.
 * Throws explicit error if environment is invalid or missing required credentials.
 * NEVER falls back to development when requesting production.
 */
export function getAdminEnvironmentConfig(env: AdminEnvironment): AdminInfraConfig {
  if (env === "production") {
    const prodConfig = readProductionInfraConfig();
    if (!prodConfig) {
      throw new Error(
        "Ambiente Production indisponível: arquivo .env.production não encontrado."
      );
    }
    if (!prodConfig.DATABASE_URL) {
      throw new Error(
        "Ambiente Production indisponível: DATABASE_URL ausente em .env.production."
      );
    }
    return prodConfig as AdminInfraConfig;
  }

  if (env === "development") {
    const devConfig = readDevelopmentInfraConfig();
    if (!devConfig.DATABASE_URL) {
      throw new Error(
        "Ambiente Development indisponível: DATABASE_URL ausente em process.env / .env.local."
      );
    }
    return devConfig as AdminInfraConfig;
  }

  throw new Error(`Ambiente administrativo inválido: "${String(env)}".`);
}
