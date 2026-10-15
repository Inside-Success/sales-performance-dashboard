export type AttendanceDay = "today" | "yesterday";
export function normalizeAttendanceDay(value: unknown): AttendanceDay | undefined {
  return value === "today" || value === "yesterday" ? value : undefined;
}
export function miamiDayKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function shiftCalendarDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function miamiMidnight(day: string): Date {
  const target = Date.parse(`${day}T00:00:00Z`);
  let utc = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(utc));
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
    const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    utc += target - local;
  }
  return new Date(utc);
}
export function attendanceDayKey(day: AttendanceDay, now: Date): string {
  return shiftCalendarDay(miamiDayKey(now), day === "yesterday" ? -1 : 0);
}
