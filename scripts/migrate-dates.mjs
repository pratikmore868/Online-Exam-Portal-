// Adds a real createdAt date to students and exams created before it existed, so that
// "Date Created" sorting and "New this week" work. Only adds a field; safe to re-run.
// Preview: node --env-file=.env.local scripts/migrate-dates.mjs
// Apply:   node --env-file=.env.local scripts/migrate-dates.mjs --apply
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}
const apply = process.argv.includes("--apply");

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "ramraj_exam_portal");

  for (const name of ["students", "exams"]) {
    const docs = await db
      .collection(name)
      .find({ createdAt: { $exists: false } }, { projection: { created: 1 } })
      .toArray();

    const updates = [];
    let unparseable = 0;
    for (const doc of docs) {
      const date = new Date(doc.created);
      if (Number.isNaN(date.getTime())) {
        unparseable++;
      } else {
        updates.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { createdAt: date } } } });
      }
    }

    console.log(`${name}: ${updates.length} to update, ${unparseable} with unreadable dates (left unchanged)`);
    if (apply && updates.length > 0) await db.collection(name).bulkWrite(updates);
  }
  console.log(apply ? "Done." : "Nothing changed. Re-run with --apply to write these updates.");
} finally {
  await client.close();
}
