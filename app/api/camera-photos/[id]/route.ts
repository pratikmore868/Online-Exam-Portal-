import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireStaff } from "@/lib/api";

// Incident photos are images of students, so only staff can open them and browsers must not cache them.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id } = await params;
    const db = await getDatabase();

    const photo = await db.collection("camera_photos").findOne({ id });
    if (!photo) throw new ApiError(404, "Photo not found. Photos are deleted automatically after a while.");

    return new Response(new Uint8Array(photo.data.buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
