import { NextResponse } from "next/server";

const BRING_API_KEY = process.env.MYBRING_API_KEY;
const BRING_API_UID = process.env.MYBRING_API_UID;
const TRACKING_API_URL = "https://api.bring.com/tracking/api/v2/tracking.json";

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

    return {
      status: sorted[0]?.status || null,
      description: sorted[0]?.description || null,
      date: sorted[0]?.date || null,
    };
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { consignmentNumber } = body;

    if (!consignmentNumber) {
      return NextResponse.json(
        { error: "consignmentNumber is required" },
        { status: 400 }
      );
    }

    const url = `${TRACKING_API_URL}?q=${encodeURIComponent(consignmentNumber)}`;
    const res = await fetch(url, { headers: getTrackingHeaders() });
    const data = await res.json();

    if (!res.ok) {
      console.error("❌ [bring-tracking] API error:", res.status, data);
      return NextResponse.json(
        { error: "Bring tracking API failed", status: res.status, details: data },
        { status: res.status }
      );
    }

    const latest = extractLatestStatus(data);

    console.log(
      `🔍 [bring-tracking] ${consignmentNumber} status=${latest?.status || "unknown"}`
    );

    return NextResponse.json({
      consignmentNumber,
      status: latest?.status || null,
      description: latest?.description || null,
      date: latest?.date || null,
      raw: data,
    });
  } catch (err) {
    console.error("❌ [bring-tracking] FAILED:", err);
    return NextResponse.json(
      { error: "Failed to fetch Bring tracking" },
      { status: 500 }
    );
  }
}
