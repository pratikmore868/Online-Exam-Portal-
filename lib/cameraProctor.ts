// Browser-only camera and detection helpers. Video is analysed on the student's device and never uploaded.

let cameraStream: MediaStream | null = null;
let detectorsPromise: Promise<Detectors | null> | null = null;

export interface Detectors {
  countFaces: (video: HTMLVideoElement) => number;
  seesPhone: (video: HTMLVideoElement) => boolean;
}

export function isCameraLive() {
  return !!cameraStream?.getVideoTracks().some((track) => track.readyState === "live");
}

// Kept between pages so that moving from the camera check to the exam doesn't ask again.
export async function getCamera(): Promise<MediaStream> {
  if (cameraStream && isCameraLive()) return cameraStream;
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  });
  return cameraStream;
}

export function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}

// The detection engine prints this routine startup note as an error, which makes Next.js
// show an error screen in development. Only this exact note is hidden; real errors still appear.
function hideEngineStartupNote() {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (String(args[0]).includes("Created TensorFlow Lite XNNPACK delegate")) return;
    original(...args);
  };
}

// Resolves to null if the models can't run on this device. The exam must still work then,
// so this never rejects, and the failure is reported to staff instead.
export function loadDetectors(): Promise<Detectors | null> {
  detectorsPromise ??= (async () => {
    try {
      hideEngineStartupNote();
      const { FilesetResolver, FaceDetector, ObjectDetector } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

      const face = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite", delegate: "CPU" },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });
      const objects = await ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/mediapipe/efficientdet_lite0.tflite", delegate: "CPU" },
        runningMode: "VIDEO",
        categoryAllowlist: ["cell phone"],
        scoreThreshold: 0.4,
        maxResults: 1,
      });

      // Timestamps must always increase, including across a video element being replaced.
      let lastTimestamp = 0;
      const nextTimestamp = () => {
        lastTimestamp = Math.max(lastTimestamp + 1, performance.now());
        return lastTimestamp;
      };

      return {
        countFaces: (video) => face.detectForVideo(video, nextTimestamp()).detections.length,
        seesPhone: (video) => objects.detectForVideo(video, nextTimestamp()).detections.length > 0,
      };
    } catch (err) {
      console.error("Camera checks could not start on this device:", err);
      return null;
    }
  })();
  return detectorsPromise;
}

// A small photo for the teacher to review an incident.
export function capturePhoto(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null;
  const width = 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((video.videoHeight / video.videoWidth) * width);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.6);
}
