// Creates the first staff login, or resets the password of an existing one.
// Run with: node --env-file=.env.local scripts/create-admin.mjs <username> "<full name>" [admin|teacher]
import { randomBytes, randomInt, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

const [username, name, role = "admin"] = process.argv.slice(2);
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}
if (!username || !name || !["admin", "teacher"].includes(role)) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <username> "<full name>" [admin|teacher]');
  process.exit(1);
}

// Same format as lib/password.ts
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
let password = "RR-";
for (let i = 0; i < 12; i++) password += alphabet[randomInt(alphabet.length)];

const salt = randomBytes(16);
const hash = await promisify(scrypt)(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "ramraj_exam_portal");
  const key = username.toLowerCase();

  await db.collection("admins").updateOne(
    { username: key },
    {
      $set: { name, role, status: "active", passwordHash, mustChangePassword: true },
      $setOnInsert: { username: key, createdAt: new Date() },
    },
    { upsert: true }
  );
  // Any device logged in with the old password is signed out.
  await db.collection("sessions").deleteMany({ userId: key, role: { $ne: "student" } });

  console.log(`\nLogin ready for ${name} (${role})`);
  console.log(`  Username:           ${key}`);
  console.log(`  Temporary password: ${password}`);
  console.log("\nThis password is shown only once and must be changed at first login.\n");
} finally {
  await client.close();
}
