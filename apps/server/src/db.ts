import { Pool } from 'pg';
import config from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export async function ensureDbConnection() {
  await pool.query('SELECT 1');
  console.log('[database] connection established');
}
