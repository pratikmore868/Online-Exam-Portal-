import { MongoClient, type Db } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexesPromise: Promise<void> | undefined;
}

function getClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
    }
    global._mongoClientPromise = new MongoClient(uri).connect().catch((err) => {
      // Allow the next request to retry instead of caching a failed connection forever.
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

async function createIndexes(db: Db) {
  await Promise.all([
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("sessions").createIndex({ userId: 1 }),
    db.collection("login_failures").createIndex({ key: 1 }, { unique: true }),
    db.collection("login_failures").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    // One attempt per student per exam, enforced by the database so two tabs cannot race.
    db.collection("attempts").createIndex({ examId: 1, studentId: 1 }, { unique: true }),
    db.collection("attempts").createIndex({ id: 1 }, { unique: true }),
    db.collection("attempts").createIndex({ status: 1, endsAt: 1 }),
    db.collection("attempts").createIndex({ studentId: 1, status: 1 }),
    db.collection("admins").createIndex({ username: 1 }, { unique: true }),
    db.collection("students").createIndex({ id: 1 }),
    db.collection("students").createIndex({ batch: 1 }),
    db.collection("exams").createIndex({ id: 1 }),
    db.collection("questions").createIndex({ id: 1 }),
  ]);
}

export async function getDatabase(): Promise<Db> {
  const client = await getClient();
  const db = client.db(process.env.MONGODB_DB || "ramraj_exam_portal");

  if (!global._mongoIndexesPromise) {
    global._mongoIndexesPromise = createIndexes(db).catch((err) => {
      global._mongoIndexesPromise = undefined;
      console.error("Failed to create MongoDB indexes:", err);
    });
  }
  await global._mongoIndexesPromise;

  return db;
}
