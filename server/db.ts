import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
// Enable connection caching for better performance with serverless
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool configuration optimized for Neon serverless
// Neon auto-suspends connections after ~5 minutes of inactivity
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Maximum number of clients in the pool
  max: 10,
  // Close idle connections after 30 seconds (before Neon's 5-minute timeout)
  idleTimeoutMillis: 30000,
  // Timeout for acquiring a connection from the pool
  connectionTimeoutMillis: 10000,
  // Allow the process to exit even if pool has clients
  allowExitOnIdle: true,
};

export const pool = new Pool(poolConfig);

// Handle pool errors gracefully to prevent crashes
pool.on('error', (err) => {
  console.error('[Database] Pool error:', err.message);
  // Don't crash the process - the pool will automatically reconnect
});

// Handle connection errors
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('[Database] Client error:', err.message);
  });
});

export const db = drizzle({ client: pool, schema });

// Health check function to verify database connectivity
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}

// Graceful shutdown helper
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    console.log('[Database] Pool closed gracefully');
  } catch (error) {
    console.error('[Database] Error closing pool:', error);
  }
}