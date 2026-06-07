// MongoDB Atlas access via the official driver over Cloudflare TCP sockets.
//
// IMPORTANT: Cloudflare Workers CANNOT reuse a TCP socket across requests. A
// client cached at module scope will hang on the next request when it tries to
// reuse the previous request's (now-dead) socket. So we open a fresh connection
// per request and always close it. Timeouts ensure we fail fast, never hang.

import { MongoClient } from "mongodb";

/**
 * Open a connection, run `fn(db)`, then close. Returns whatever fn returns.
 * Usage:  return withDb(env, async (db) => { ... });
 */
export async function withDb(env, fn) {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  const client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 20000,
  });
  await client.connect();
  try {
    return await fn(client.db(env.DB_NAME || "expense_tracker"));
  } finally {
    await client.close().catch(() => {});
  }
}

export const expensesCol = (db) => db.collection("expenses");
export const reportsCol = (db) => db.collection("reports");

/** Lightweight reachability check used by /health?check=db */
export async function pingDb(env) {
  return withDb(env, async (db) => {
    await db.command({ ping: 1 });
    return true;
  });
}
