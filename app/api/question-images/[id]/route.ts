import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, requireUser } from "@/lib/api";

// Pictures in questions, which students need too. Solutions are never sent to students, so their pictures' IDs aren't known to them.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const db = await getDatabase();

    const image = await db.collection("question_images").findOne({ id });
    if (!image) throw new ApiError(404, "Image not found.");

    return new Response(new Uint8Array(image.data.buffer), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
