import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, escapeRegex, handleApiError, readJson, requireStaff } from "@/lib/api";

export async function GET(req: Request) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    const query = searchParams.get("q");

    const db = await getDatabase();
    const filter: any = {};
    if (subjectId) {
      filter.subjectId = subjectId;
    }
    if (query) {
      filter.name = { $regex: escapeRegex(query), $options: "i" };
    }

    const chapters = await db.collection("chapters").find(filter).sort({ order: 1, name: 1 }).toArray();
    return NextResponse.json({ success: true, chapters });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff();

    const body = await readJson(req);
    const { subjectId, name } = body;
    if (!subjectId || typeof name !== "string" || !name.trim()) {
      throw new ApiError(400, "subjectId and name are required");
    }

    const db = await getDatabase();
    const count = await db.collection("chapters").countDocuments({ subjectId });

    const today = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate() > 9 ? today.getDate() : '0' + today.getDate()}, ${today.getFullYear()}`;

    const newChapter = {
      id: `${subjectId}-${Date.now()}`,
      subjectId,
      name: name.trim(),
      order: count + 1,
      questionsCount: 0,
      created: dateStr,
      updated: dateStr
    };

    await db.collection("chapters").insertOne(newChapter);

    // Update subject updated date and chapters count
    await db.collection("subjects").updateOne(
      { id: subjectId },
      {
        $inc: { chaptersCount: 1 },
        $set: { updated: dateStr }
      }
    );

    return NextResponse.json({ success: true, chapter: newChapter });
  } catch (error) {
    return handleApiError(error);
  }
}
