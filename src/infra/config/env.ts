import * as dotenv from "dotenv";
dotenv.config();

function required(name: string, def?: string) {
  const v = process.env[name] ?? def;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  PORT: Number(required("PORT", "3000")),
  NODE_ENV: required("NODE_ENV", "development"),
  DATABASE_URL: required("DATABASE_URL", "./data/app.db"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*"
};
