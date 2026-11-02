// Shows recent dates as "Today" or "Yesterday". Only changes how a date is displayed, never the date itself.
export function friendlyDay(value: string | Date, now: Date = new Date()) {
  const date = new Date(value);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function friendlyDateTime(value: string | Date, now: Date = new Date()) {
  const time = new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${friendlyDay(value, now)}, ${time}`;
}
