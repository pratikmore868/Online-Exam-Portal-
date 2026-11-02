// Shared by the exam screen and the server. On this warning the exam is submitted automatically.
export const MAX_WARNINGS = 3;

export const VIOLATION_TYPES = ["tab-hidden", "window-blur", "fullscreen-exit"];

export const VIOLATION_LABELS: Record<string, string> = {
  "tab-hidden": "Switched tab or minimised the browser",
  "window-blur": "Moved to another window",
  "fullscreen-exit": "Exited full screen",
};

export function submitTypeLabel(submitType?: string) {
  if (submitType === "violations") return "Auto Submit (3 warnings)";
  if (submitType === "time_up") return "Auto Submit";
  return "Manual";
}
