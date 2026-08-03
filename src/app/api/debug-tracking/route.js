import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const KEY = process.env.MYBRING_API_KEY;
  const UID = process.env.MYBRING_API_UID;
  const CLIENT_URL = process.env.BRING_CLIENT_URL;

  // Correct Bring Tracking API URL (public, no headers allowed)
  const url = "https://tracking.bring.com/api/tracking.json?q=LL102299001NO";

  // Tracking API must be called WITHOUT headers
  const res = await fetch(url);

  const responseText = await res.text();

  return NextResponse.json({
    envVars: {
      MYBRING_API_KEY: KEY,
      MYBRING_API_UID: UID,
      BRING_CLIENT_URL: CLIENT_URL,
    },
    // Shown only for debugging; not actually used in the request
    intendedHeaders: {
      "X-MyBring-API-Key": KEY,
      "X-MyBring-API-Uid": UID,
      "X-Bring-Client-URL": CLIENT_URL,
      "api-version": "2",
      Accept: "application/json",
    },
    bringResponseStatus: res.status,
    bringResponseBody: responseText,
  });
}
