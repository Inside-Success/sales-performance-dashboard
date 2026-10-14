import "server-only";
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Two bounded attempts; do not hammer a live base shared with production intake.
export async function readAirtablePage(url: string, token: string, deadline: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (Date.now() >= deadline) throw new Error("Attendance refresh exceeded its time budget.");
    await pause(250);
    try {
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store",
        signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))) });
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        const delay = response.status === 429 ? Math.max(30000, Number(response.headers.get("retry-after") || 0) * 1000) : 1000;
        if (Date.now() + delay >= deadline) throw new Error("Source retry exceeded its time budget.");
        await pause(delay); continue;
      }
      return response;
    } catch (error) {
      if (attempt || Date.now() + 1000 >= deadline) throw error;
      await pause(1000);
    }
  }
  throw new Error("Source read attempts were exhausted.");
}
