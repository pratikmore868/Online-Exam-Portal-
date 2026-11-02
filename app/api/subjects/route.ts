import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireStaff } from "@/lib/api";

export async function GET() {
  try {
    await requireStaff();

    const db = await getDatabase();
    const subjects = await db.collection("subjects").find({}).sort({ order: 1, name: 1 }).toArray();

    // Ensure chaptersCount is up-to-date with actual chapters in DB
    const chaptersCounts = await db.collection("chapters").aggregate([
      { $group: { _id: "$subjectId", count: { $sum: 1 } } }
    ]).toArray();

    const countMap: Record<string, number> = {};
    chaptersCounts.forEach(c => {
      countMap[c._id] = c.count;
    });

    const enriched = subjects.map(s => ({
      ...s,
      chaptersCount: countMap[s.id] ?? s.chaptersCount ?? 0
    }));

    return NextResponse.json({ success: true, subjects: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff();

    const body = await readJson(req);
    const { name, icon, color } = body;
    if (typeof name !== "string" || !name.trim()) {
      throw new ApiError(400, "Subject name is required");
    }

    const db = await getDatabase();
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const today = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate() > 9 ? today.getDate() : '0' + today.getDate()}, ${today.getFullYear()}`;

    const newSubject = {
      id,
      name,
      icon: icon || "📚",
      color: color || "#287FC1",
      chaptersCount: 0,
      questionsCount: 0,
      created: dateStr,
      updated: dateStr
    };

    await db.collection("subjects").updateOne(
      { id },
      { $set: newSubject },
      { upsert: true }
    );

    return NextResponse.json({ success: true, subject: newSubject });
  } catch (error) {
    return handleApiError(error);
  }
}
