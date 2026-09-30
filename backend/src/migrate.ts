import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pool, transaction } from "./db.js";
import { root } from "./config.js";
await pool.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
);
for (const name of (await readdir(path.join(root, "database/migrations")))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(193410)");
    if (
      (
        await c.query("SELECT name FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rowCount
    )
      return;
    await c.query(
      await readFile(path.join(root, "database/migrations", name), "utf8"),
    );
    await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    console.log("Applied", name);
  });
}
await pool.end();
