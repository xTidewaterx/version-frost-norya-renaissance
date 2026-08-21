import { NextResponse } from "next/server";

function getClientIp(req) {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return "unknown";
}

const rateLimits = new Map();

function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record || now - record.windowStart > windowMs) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

export function withRateLimit(maxRequests = 10, windowMs = 60000) {
  return function (handler) {
    return async function (req) {
      const key = getClientIp(req);
      if (!checkRateLimit(key, maxRequests, windowMs)) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
      return handler(req);
    };
  };
}
