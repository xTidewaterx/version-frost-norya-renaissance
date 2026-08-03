import { NextResponse } from "next/server";

const BRING_API_KEY = process.env.MYBRING_API_KEY;
const BRING_API_UID = process.env.MYBRING_API_UID;
const TRACKING_API_URL = "https://api.bring.com/tracking/api/v2/tracking.json";
const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTrackingHeaders() {
  return {
    "X-Mybring-API-Key": BRING_API_KEY,
    "X-Mybring-API-Uid": BRING_API_UID,
    "api-version": "2",
    accept: "application/json",
  };
}

function extractLatestStatus(trackingData) {
  try {
    const consignments = trackingData?.consignmentSet || [];
    if (!consignments.length) return null;

    const events = consignments[0]?.packageSet?.[0]?.eventSet || [];
    if (!events.length) return null;

    const sorted = events
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return sorted[0]?.status || null;
  } catch {
    return null;
  }
}

async function sendTrackingEmail({ email, consignmentNumber }) {
  const url = `${APP_URL}/api/send-tracking-email`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      consignmentNumber,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`send-tracking-email failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { consignmentNumber, email } = body;

    if (!consignmentNumber || !email) {
      return NextResponse.json(
        { error: "consignmentNumber and email are required" },
        { status: 400 }
      );
    }

    const trackUrl = `${TRACKING_API_URL}?q=${encodeURIComponent(consignmentNumber)}`;
    const res = await fetch(trackUrl, { headers: getTrackingHeaders() });
    const data = await res.json();

    if (!res.ok) {
      console.error("❌ [bring-check] API error:", res.status, data);
      return NextResponse.json(
        { error: "Bring tracking API failed", status: res.status, details: data },
        { status: res.status }
      );
    }

    const status = extractLatestStatus(data);

    console.log(
      `🔍 [bring-check] ${consignmentNumber} status=${status || "unknown"} email=${email}`
    );

    if (status === "IN_TRANSIT") {
      console.log(`🚚 [bring-check] ${consignmentNumber} is IN_TRANSIT, sending email...`);
      const result = await sendTrackingEmail({ email, consignmentNumber });
      console.log(`✅ [bring-check] tracking email sent:`, result);
      return NextResponse.json({ status, sent: true, result });
    }

    return NextResponse.json({ status, sent: false });
  } catch (err) {
    console.error("❌ [bring-check] FAILED:", err);
    return NextResponse.json(
      { error: "Failed to check Bring tracking" },
      { status: 500 }
    );
  }
}
