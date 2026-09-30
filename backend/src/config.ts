import dotenv from "dotenv";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
let directory = path.dirname(fileURLToPath(import.meta.url));
while (!existsSync(path.join(directory, ".env.example"))) {
  const parent = path.dirname(directory);
  if (parent === directory) throw new Error("Cannot locate project root");
  directory = parent;
}
export const root = directory;
dotenv.config({ path: path.join(root, ".env"), quiet: true });
export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://procurement:procurement@127.0.0.1:5433/procurement",
  port: Number(process.env.PORT ?? 3001),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  storage: path.resolve(root, process.env.DOCUMENT_STORAGE ?? "storage"),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
};
