// Shared by the exam screen and the server. On this warning the exam is submitted automatically.
export const MAX_WARNINGS = 3;

export const VIOLATION_TYPES = ["tab-hidden", "window-blur", "fullscreen-exit"];

export const VIOLATION_LABELS: Record<string, string> = {
  "tab-hidden": "Switched tab or minimised the browser",
  "window-blur": "Moved to another window",
  "fullscreen-exit": "Exited full screen",
};

// ── Camera monitoring ──────────────────────────────────────────────────────────
// These only flag incidents for a teacher to review. They never submit an exam,
// because the detection can be wrong (poor light, a calculator mistaken for a phone).

export type CameraIncidentType = "no-face" | "multiple-faces" | "phone" | "camera-off";

export const CAMERA_INCIDENT_LABELS: Record<CameraIncidentType, string> = {
  "no-face": "No face in camera",
  "multiple-faces": "More than one face in camera",
  phone: "Possible mobile phone in camera",
  "camera-off": "Camera turned off or blocked",
};

// Student-facing wording, so a false alarm can be corrected straight away.
export const CAMERA_INCIDENT_MESSAGES: Record<CameraIncidentType, string> = {
  "no-face": "We can't see your face. Keep your face in the camera. This has been recorded.",
  "multiple-faces": "More than one face is visible. This has been recorded.",
  phone: "A mobile phone may be visible. This has been recorded.",
  "camera-off": "Your camera has stopped. This has been recorded.",
};

// How long a condition must last before it counts, so normal movement doesn't trigger it.
export const CAMERA_START_DELAYS_MS: Record<CameraIncidentType, number> = {
  "no-face": 5000,
  "multiple-faces": 3000,
  phone: 3000,
  "camera-off": 5000,
};

// How long a condition must be clear before an incident ends, so one flicker isn't two incidents.
export const CAMERA_END_DELAY_MS = 2000;

// After this long with no face, a big popup appears. It doesn't count toward the auto-submit warnings.
export const LONG_NO_FACE_MS = 60_000;

// Limits per attempt, so one faulty camera can't fill the database.
export const MAX_CAMERA_INCIDENTS = 100;
export const MAX_CAMERA_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 100_000;
export const CAMERA_PHOTO_RETENTION_DAYS = 60;

// null means "not checked on this tick", which keeps the previous reading.
export interface CameraObservation {
  faces?: number | null;
  phone?: boolean | null;
  cameraOn?: boolean | null;
}

interface ConditionState {
  value: boolean;
  since: number | null;
  clearSince: number | null;
  active: boolean;
}

export type CameraTracker = Record<CameraIncidentType, ConditionState>;

const INCIDENT_TYPES = Object.keys(CAMERA_START_DELAYS_MS) as CameraIncidentType[];

export function createCameraTracker(): CameraTracker {
  const blank = (): ConditionState => ({ value: false, since: null, clearSince: null, active: false });
  return { "no-face": blank(), "multiple-faces": blank(), phone: blank(), "camera-off": blank() };
}

// Turns a stream of readings into incidents starting and ending. Returns what changed on this tick.
export function stepCameraTracker(tracker: CameraTracker, observation: CameraObservation, now: number) {
  const started: CameraIncidentType[] = [];
  const ended: CameraIncidentType[] = [];

  const readings: Partial<Record<CameraIncidentType, boolean>> = {};
  if (observation.cameraOn !== null && observation.cameraOn !== undefined) {
    readings["camera-off"] = !observation.cameraOn;
  }
  if (observation.faces !== null && observation.faces !== undefined) {
    readings["no-face"] = observation.faces === 0;
    readings["multiple-faces"] = observation.faces > 1;
  }
  if (observation.phone !== null && observation.phone !== undefined) {
    readings.phone = observation.phone;
  }
  // With the camera off there's nothing to see, so don't also report a missing face.
  if (readings["camera-off"] ?? tracker["camera-off"].value) {
    readings["no-face"] = false;
    readings["multiple-faces"] = false;
    readings.phone = false;
  }

  for (const type of INCIDENT_TYPES) {
    const state = tracker[type];
    const reading = readings[type];
    if (reading !== undefined) state.value = reading;

    if (state.value) {
      state.clearSince = null;
      state.since ??= now;
      if (!state.active && now - state.since >= CAMERA_START_DELAYS_MS[type]) {
        state.active = true;
        started.push(type);
      }
    } else {
      state.since = null;
      if (state.active) {
        state.clearSince ??= now;
        if (now - state.clearSince >= CAMERA_END_DELAY_MS) {
          state.active = false;
          state.clearSince = null;
          ended.push(type);
        }
      }
    }
  }

  return { started, ended };
}

export function submitTypeLabel(submitType?: string) {
  if (submitType === "violations") return "Auto Submit (3 warnings)";
  if (submitType === "time_up") return "Auto Submit";
  return "Manual";
}
