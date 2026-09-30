import pg from "pg";
import { config } from "./config.js";
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});
export const query = async (sql: string, values: unknown[] = []) =>
  (await pool.query(sql, values)).rows;
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function audit(
  eventId: string,
  type: string,
  metadata: unknown = {},
) {
  await query(
    "INSERT INTO audit_events(event_id,event_type,metadata) VALUES($1,$2,$3)",
    [eventId, type, JSON.stringify(metadata)],
  );
}
export async function invalidate(eventId: string) {
  await query(
    "UPDATE procurement_events SET revision=revision+1,status='review',updated_at=now() WHERE id=$1",
    [eventId],
  );
}
