import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { handleApiError, readJson, requireAdmin, requireStaff } from "@/lib/api";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id } = await params;
    const body = await readJson(req);
    const db = await getDatabase();

    const today = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const updatedDate = `${months[today.getMonth()]} ${today.getDate() > 9 ? today.getDate() : '0' + today.getDate()}, ${today.getFullYear()}`;

    await db.collection("chapters").updateOne(
      { id },
      {
        $set: {
          ...(body.name && { name: body.name.trim() }),
          updated: updatedDate
        }
      }
    );

    const updated = await db.collection("chapters").findOne({ id });
    return NextResponse.json({ success: true, chapter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const db = await getDatabase();
    const chapter = await db.collection("chapters").findOne({ id });
    if (chapter) {
      await db.collection("chapters").deleteOne({ id });
      await db.collection("subjects").updateOne(
        { id: chapter.subjectId },
        { $inc: { chaptersCount: -1 } }
      );
    }
    return NextResponse.json({ success: true, message: "Chapter deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
