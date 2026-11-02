import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { ApiError, handleApiError, readJson, requireStudent } from "@/lib/api";
import { attemptForOwner, isPastDeadline } from "@/lib/attempts";
import {
  CAMERA_INCIDENT_LABELS,
  CAMERA_PHOTO_RETENTION_DAYS,
  MAX_CAMERA_INCIDENTS,
  MAX_CAMERA_PHOTOS,
  MAX_PHOTO_BYTES,
} from "@/lib/proctoring";

const PHOTO_PREFIX = "data:image/jpeg;base64,";
const MAX_HEARTBEAT_SECONDS = 120;

// The student's browser reports what the camera check sees. Nothing here can submit an exam.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await readJson(req);
    const db = await getDatabase();
    const attempt = await attemptForOwner(db, id, user);

    if (attempt.status !== "in_progress" || isPastDeadline(attempt)) {
      return NextResponse.json({ success: true, recorded: false });
    }

    const attempts = db.collection("attempts");

    // Lets staff see how much of the exam the camera check actually ran for.
    if (body.action === "heartbeat") {
      const seconds = Number(body.seconds);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_HEARTBEAT_SECONDS) {
        throw new ApiError(400, "Invalid heartbeat.");
      }
      await attempts.updateOne(
        { id: attempt.id },
        { $inc: { cameraSeconds: seconds }, ...(body.detectorFailed === true ? { $set: { cameraDetectorFailed: true } } : {}) }
      );
      return NextResponse.json({ success: true, recorded: true });
    }

    const { eventId, type, photo } = body;
    if (typeof eventId !== "string" || !eventId || eventId.length > 64) {
      throw new ApiError(400, "Invalid incident.");
    }

    if (body.action === "end") {
      await db.collection("camera_incidents").updateOne(
        { attemptId: attempt.id, eventId, endedAt: { $exists: false } },
        { $set: { endedAt: new Date() } }
      );
      return NextResponse.json({ success: true, recorded: true });
    }

    if (body.action !== "start" || !Object.hasOwn(CAMERA_INCIDENT_LABELS, type)) {
      throw new ApiError(400, "Invalid incident.");
    }
    if ((attempt.cameraIncidentCount ?? 0) >= MAX_CAMERA_INCIDENTS) {
      return NextResponse.json({ success: true, recorded: false });
    }

    // The photo is only kept if it's a small JPEG and this attempt is under its limit.
    let photoId: string | null = null;
    const photoOk =
      typeof photo === "string" &&
      photo.startsWith(PHOTO_PREFIX) &&
      photo.length <= PHOTO_PREFIX.length + Math.ceil((MAX_PHOTO_BYTES * 4) / 3) &&
      (attempt.cameraPhotoCount ?? 0) < MAX_CAMERA_PHOTOS;
    if (photoOk) photoId = randomUUID();

    try {
      await db.collection("camera_incidents").insertOne({
        attemptId: attempt.id,
        examId: attempt.examId,
        studentId: attempt.studentId,
        eventId,
        type,
        startedAt: new Date(),
        photoId,
      });
    } catch (err) {
      // A retried request: this incident is already recorded.
      if (err instanceof MongoServerError && err.code === 11000) {
        return NextResponse.json({ success: true, recorded: true });
      }
      throw err;
    }

    if (photoId) {
      await db.collection("camera_photos").insertOne({
        id: photoId,
        attemptId: attempt.id,
        data: Buffer.from(photo.slice(PHOTO_PREFIX.length), "base64"),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + CAMERA_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000),
      });
    }

    await attempts.updateOne(
      { id: attempt.id },
      { $inc: { cameraIncidentCount: 1, cameraPhotoCount: photoId ? 1 : 0 } }
    );

    return NextResponse.json({ success: true, recorded: true });
  } catch (error) {
    return handleApiError(error);
  }
}
