import { pool } from "../db/pool";

export async function logAudit(params: {
  userId?: number | null;
  action: string;
  recordType: string;
  recordId?: number | null;
  description: string;
  previousValue?: any;
  newValue?: any;
  ip?: string;
}) {
  const { userId, action, recordType, recordId, description, previousValue, newValue, ip } = params;
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, record_type, record_id, description, previous_value, new_value, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [userId ?? null, action, recordType, recordId ?? null, description, previousValue ? JSON.stringify(previousValue) : null, newValue ? JSON.stringify(newValue) : null, ip ?? null]
  );
}
