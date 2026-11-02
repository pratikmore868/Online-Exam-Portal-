import { MongoClient } from "mongodb";

// Run with: node --env-file=.env.local scripts/test-connection.mjs
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}

async function testConnection() {
  const client = new MongoClient(uri);
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("Connected successfully to MongoDB Atlas!");
    const db = client.db("ramraj_exam_portal");
    const collections = await db.listCollections().toArray();
    console.log("Existing collections:", collections.map(c => c.name));
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await client.close();
  }
}

testConnection();
