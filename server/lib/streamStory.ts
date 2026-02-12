import type { Response } from "express";

export function initSSE(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

export function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function endSSE(res: Response) {
  res.write("event: done\ndata: {}\n\n");
  res.end();
}

export function extractNarrativeFromPartialJSON(accumulated: string): string | null {
  const match = accumulated.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
  if (match && match[1]) {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }
  return null;
}
