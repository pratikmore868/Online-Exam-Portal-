import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireAdmin, requireStaff } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id } = await params;
    const db = await getDatabase();
    const subject = await db.collection("subjects").findOne({ id });
    if (!subject) {
      throw new ApiError(404, "Subject not found");
    }
    const chapters = await db.collection("chapters").find({ subjectId: id }).sort({ order: 1, name: 1 }).toArray();

    return NextResponse.json({
      success: true,
      subject: {
        ...subject,
        chaptersCount: chapters.length,
        chapters
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

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

    await db.collection("subjects").updateOne(
      { id },
      {
        $set: {
          ...(body.name && { name: body.name }),
          ...(body.icon && { icon: body.icon }),
          ...(body.color && { color: body.color }),
          updated: updatedDate
        }
      }
    );

    const updated = await db.collection("subjects").findOne({ id });
    return NextResponse.json({ success: true, subject: updated });
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
    await db.collection("subjects").deleteOne({ id });
    await db.collection("chapters").deleteMany({ subjectId: id });
    return NextResponse.json({ success: true, message: "Subject and related chapters deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
