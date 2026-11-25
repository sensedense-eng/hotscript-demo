import type { VercelRequest } from "@vercel/node";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 6;

const requestLogByIp = new Map<string, number[]>();

export function getClientIp(req: VercelRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function checkRateLimit(req: VercelRequest): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const ip = getClientIp(req);
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const timestamps = (requestLogByIp.get(ip) ?? []).filter((ts) => ts > cutoff);

  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    requestLogByIp.set(ip, timestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  timestamps.push(now);
  requestLogByIp.set(ip, timestamps);

  // 防止长时间运行后 Map 无限增长
  if (requestLogByIp.size > 500) {
    for (const [key, list] of requestLogByIp.entries()) {
      const fresh = list.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        requestLogByIp.delete(key);
      } else {
        requestLogByIp.set(key, fresh);
      }
    }
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_MINUTE - timestamps.length,
    retryAfterSec: 0,
  };
}
