import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { prepareStorage } from "./documents.js";
await pool.query("SELECT 1");
await pool.query(
  "UPDATE supplier_documents SET processing_status='failed',error='Extraction interrupted by server restart; retry extraction.' WHERE processing_status='extracting'",
);
await prepareStorage();
const server = app.listen(config.port, "127.0.0.1", () =>
  console.log(`API listening on http://127.0.0.1:${config.port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => void pool.end().then(() => process.exit(0))),
  );
