"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { capturePhoto, getCamera, isCameraLive, loadDetectors, stopCamera, type Detectors } from "@/lib/cameraProctor";
import {
  CAMERA_INCIDENT_MESSAGES,
  LONG_NO_FACE_MS,
  MAX_WARNINGS,
  createCameraTracker,
  stepCameraTracker,
  type CameraIncidentType,
  type CameraObservation,
} from "@/lib/proctoring";

const CHECK_EVERY_MS = 1000;
const PHONE_CHECK_MIN_MS = 3000;
const PHONE_CHECK_MAX_MS = 15000;
const HEARTBEAT_EVERY_SECONDS = 30;
// A broken camera mustn't cost an honest student the exam, so they can carry on after this,
// and staff see how long the camera was off.
const CAMERA_OFF_ESCAPE_SECONDS = 60;

export function useCameraProctor(attemptId: string | null, enabled: boolean) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [activeTypes, setActiveTypes] = useState<CameraIncidentType[]>([]);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [canContinueWithoutCamera, setCanContinueWithoutCamera] = useState(false);
  const [continuedWithoutCamera, setContinuedWithoutCamera] = useState(false);
  const [longAbsence, setLongAbsence] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const noFaceSinceRef = useRef<number | null>(null);

  const attachCamera = useCallback(async () => {
    try {
      const stream = await getCamera();
      setCameraError("");
      const element = videoRef.current;
      if (element && element.srcObject !== stream) {
        element.srcObject = stream;
        await element.play().catch(() => undefined);
      }
      return true;
    } catch {
      setCameraError("We couldn't start your camera. Allow camera access for this site, check that no other app is using it, and try again.");
      return false;
    }
  }, []);

  const videoCallback = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    setVideo(element);
  }, []);

  useEffect(() => {
    if (!enabled || !attemptId || !video) return;

    let stopped = false;
    let detectors: Detectors | null = null;
    let detectorFailed = false;
    let lastPhoneCheck = 0;
    let phoneInterval = PHONE_CHECK_MIN_MS;
    let unsentSeconds = 0;
    let offSeconds = 0;
    const tracker = createCameraTracker();
    const openEvents = new Map<CameraIncidentType, string>();

    const post = (body: Record<string, unknown>, retries = 3) => {
      fetch(`/api/attempts/${attemptId}/camera`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (res.status >= 500) throw new Error("server error");
        })
        .catch(() => {
          if (!stopped && retries > 0) setTimeout(() => post(body, retries - 1), 3000);
        });
    };

    attachCamera();
    loadDetectors().then((loaded) => {
      if (stopped) return;
      detectors = loaded;
      detectorFailed = !loaded;
    });

    const timer = setInterval(() => {
      // Browsers slow timers in hidden tabs, and leaving the tab is already a warning of its own.
      if (document.hidden) return;

      const now = Date.now();
      const live = isCameraLive() && video.readyState >= 2 && video.videoWidth > 0;
      const observation: CameraObservation = { cameraOn: live };

      if (live && detectors) {
        try {
          observation.faces = detectors.countFaces(video);
          if (now - lastPhoneCheck >= phoneInterval) {
            lastPhoneCheck = now;
            const startedAt = performance.now();
            observation.phone = detectors.seesPhone(video);
            // On a slow device, check less often rather than making the exam lag.
            const took = performance.now() - startedAt;
            phoneInterval = took > 300
              ? Math.min(PHONE_CHECK_MAX_MS, phoneInterval * 2)
              : Math.max(PHONE_CHECK_MIN_MS, phoneInterval / 2);
          }
        } catch (err) {
          console.error("Camera check failed:", err);
          detectors = null;
          detectorFailed = true;
        }
      }

      // The popup stays up after the face returns, until the student acknowledges it.
      if (live && observation.faces === 0) {
        noFaceSinceRef.current ??= now;
        if (now - noFaceSinceRef.current >= LONG_NO_FACE_MS) setLongAbsence(true);
      } else if (!live || (observation.faces ?? 0) > 0) {
        noFaceSinceRef.current = null;
      }

      const { started, ended } = stepCameraTracker(tracker, observation, now);

      for (const type of started) {
        const eventId = `${now}-${Math.random().toString(36).slice(2)}`;
        openEvents.set(type, eventId);
        post({ action: "start", eventId, type, photo: live ? capturePhoto(video) : undefined });
      }
      for (const type of ended) {
        const eventId = openEvents.get(type);
        openEvents.delete(type);
        if (eventId) post({ action: "end", eventId });
      }
      if (started.length > 0 || ended.length > 0) {
        setActiveTypes([...openEvents.keys()]);
      }

      setCameraOff(!live);
      if (live) {
        offSeconds = 0;
        setCanContinueWithoutCamera(false);
        setContinuedWithoutCamera(false);
        unsentSeconds += CHECK_EVERY_MS / 1000;
      } else {
        offSeconds += CHECK_EVERY_MS / 1000;
        if (offSeconds >= CAMERA_OFF_ESCAPE_SECONDS) setCanContinueWithoutCamera(true);
      }

      if (unsentSeconds >= HEARTBEAT_EVERY_SECONDS) {
        post({ action: "heartbeat", seconds: unsentSeconds, detectorFailed }, 1);
        unsentSeconds = 0;
      }
    }, CHECK_EVERY_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
      if (unsentSeconds > 0) post({ action: "heartbeat", seconds: Math.min(120, unsentSeconds), detectorFailed }, 0);
      for (const eventId of openEvents.values()) post({ action: "end", eventId }, 0);
      // Turn the camera light off as soon as the exam is finished.
      stopCamera();
    };
  }, [enabled, attemptId, video, attachCamera]);

  return {
    videoCallback,
    activeTypes,
    // Hide the paper while the camera is off, until they're allowed to carry on without it.
    blocked: enabled && cameraOff && !continuedWithoutCamera,
    cameraError,
    retryCamera: attachCamera,
    canContinueWithoutCamera,
    continueWithoutCamera: () => setContinuedWithoutCamera(true),
    longAbsence,
    dismissLongAbsence: () => {
      // If they're still missing, the popup returns after another minute.
      noFaceSinceRef.current = null;
      setLongAbsence(false);
    },
  };
}

export function LongAbsenceDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1900 }}>
      <div className="modal-box" role="alertdialog" aria-labelledby="exam-absence-title">
        <div style={{ padding: "22px 24px" }}>
          <h2 id="exam-absence-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#991b1b" }}>
            ⚠️ We can&apos;t see your face
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
            Your face has been out of the camera for over a minute, and this has been recorded for your teacher to review. The timer keeps running.{" "}
            <strong>This doesn&apos;t count toward your {MAX_WARNINGS} warnings and won&apos;t submit your exam.</strong>
          </p>
        </div>
        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            autoFocus
            onClick={onClose}
            style={{
              padding: "10px 22px",
              border: "none",
              borderRadius: 8,
              background: "#287FC1",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            I&apos;m Back, Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export function CameraPreview({ videoCallback }: { videoCallback: (element: HTMLVideoElement | null) => void }) {
  return (
    <div style={{ padding: "10px 16px 0", borderTop: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>📷 Camera on</div>
      <video
        ref={videoCallback}
        aria-label="Your camera"
        autoPlay
        muted
        playsInline
        style={{ width: "100%", maxHeight: 130, background: "#111827", borderRadius: 8, objectFit: "cover", transform: "scaleX(-1)" }}
      />
    </div>
  );
}

export function CameraAlert({ types }: { types: CameraIncidentType[] }) {
  const shown = types.filter((type) => type !== "camera-off");
  if (shown.length === 0) return null;
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1800,
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 16px",
        background: "#991b1b",
        color: "#ffffff",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {shown.map((type) => (
        <div key={type}>⚠️ {CAMERA_INCIDENT_MESSAGES[type]}</div>
      ))}
    </div>
  );
}

export function CameraBlockedOverlay({
  error,
  canContinue,
  onRetry,
  onContinue,
}: {
  error: string;
  canContinue: boolean;
  onRetry: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1950,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(17,24,39,0.8)",
        color: "#ffffff",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Your camera is off</h2>
        <p style={{ margin: "8px 0 16px", fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
          {error || "This exam needs your camera, so the paper is hidden until it's back."} The timer keeps running, and this is being recorded.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={onRetry}
            style={{ padding: "10px 22px", border: "none", borderRadius: 8, background: "#287FC1", color: "#ffffff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Turn Camera On
          </button>
          {canContinue && (
            <button
              onClick={onContinue}
              style={{ padding: "10px 22px", border: "1px solid #ffffff", borderRadius: 8, background: "transparent", color: "#ffffff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Continue Without Camera (teacher will review)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The check before starting. Reports true only once exactly one face has been steady for 2 seconds.
export function CameraCheck({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);
  const [asking, setAsking] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onReadyChange(ready);
  }, [ready, onReadyChange]);

  const start = useCallback(async () => {
    setError("");
    setAsking(true);
    try {
      await getCamera();
      setStarted(true);
      setStatus("Loading the camera check...");
    } catch {
      setError("We couldn't start your camera. Click the camera icon next to the address bar, choose Allow, and try again. Also check that no other app is using it. If it still doesn't work, ask your invigilator or teacher, who can exempt you for this exam.");
    } finally {
      setAsking(false);
    }
  }, []);

  // Ask for permission as soon as the page opens, so the browser's Allow popup appears straight away.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) start();
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  useEffect(() => {
    if (!started) return;

    let stopped = false;
    let detectors: Detectors | null = null;
    let goodSince: number | null = null;
    let loaded = false;

    // The video element only exists once started is true, which is why this runs here.
    getCamera()
      .then(async (stream) => {
        const element = videoRef.current;
        if (!stopped && element) {
          element.srcObject = stream;
          await element.play().catch(() => undefined);
        }
      })
      .catch(() => setError("Your camera stopped. Please reload this page and try again."));

    loadDetectors().then((result) => {
      detectors = result;
      loaded = true;
    });

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (stopped || !video || video.readyState < 2) return;
      if (!loaded) return;

      // If detection can't run on this device, don't lock the student out. Staff see this in the report.
      if (!detectors) {
        setStatus("Camera is working. Automatic checks aren't available on this device, and your teacher will be told.");
        setReady(true);
        return;
      }

      let faces = 0;
      try {
        faces = detectors.countFaces(video);
      } catch {
        detectors = null;
        return;
      }
      if (faces === 1) {
        goodSince ??= Date.now();
        if (Date.now() - goodSince >= 2000) {
          setStatus("✓ One face detected. You're ready to start.");
          setReady(true);
        } else {
          setStatus("Face found. Hold still...");
        }
      } else {
        goodSince = null;
        setReady(false);
        setStatus(faces === 0 ? "We can't see your face. Move into the frame and improve the lighting." : "More than one face is visible. Only you should be in the frame.");
      }
    }, 500);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [started]);

  return (
    <div className="card" style={{ padding: 20, border: ready ? "2px solid #22c55e" : "2px solid #e5e7eb" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#111827" }}>📷 Camera Check</h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
        This exam uses your camera to check that you stay in the frame, that no one else is with you, and that no mobile phone is visible. The video is checked on your device and isn&apos;t uploaded. If something is flagged, one small photo is saved for your teacher to review.
      </p>
      {!started ? (
        asking ? (
          <p role="status" style={{ margin: 0, padding: "12px 14px", background: "#eff6ff", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#1e40af" }}>
            👆 Click <strong>Allow</strong> in your browser&apos;s popup to turn on your camera.
          </p>
        ) : (
          <button
            onClick={start}
            style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#287FC1", color: "#ffffff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Try Again
          </button>
        )
      ) : (
        <>
          <video
            ref={videoRef}
            aria-label="Your camera"
            autoPlay
            muted
            playsInline
            style={{ width: "100%", maxWidth: 320, display: "block", background: "#111827", borderRadius: 8, transform: "scaleX(-1)" }}
          />
          <p role="status" style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: ready ? "#15803d" : "#92400e" }}>
            {status}
          </p>
        </>
      )}
      {error && (
        <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "#991b1b", lineHeight: 1.5 }}>
          {error}
        </p>
      )}
    </div>
  );
}
