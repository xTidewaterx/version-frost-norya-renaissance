const fs = require("fs");
const path = require("path");

const BRING_API_KEY = process.env.BRING_API_KEY || "";
const BRING_API_UID = process.env.BRING_API_UID || "";
const TRACKING_API_URL = "https://api.bring.com/tracking/api/v2/tracking.json";
const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const STATE_FILE = path.join(process.cwd(), "src", "app", "lib", "trackingState.json");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("⚠️ [bring] failed to load state file:", err.message);
  }
  return { notified: {} };
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("❌ [bring] failed to save state file:", err.message);
  }
}

function getTrackingHeaders() {
  return {
    "X-Mybring-API-Key": BRING_API_KEY,
    "X-Mybring-API-Uid": BRING_API_UID,
    "api-version": "2",
  };
}

async function fetchBringTracking(consignmentNumber) {
  const url = `${TRACKING_API_URL}?q=${encodeURIComponent(consignmentNumber)}`;
  const res = await fetch(url, {
    headers: getTrackingHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Bring API responded with ${res.status}: ${res.statusText}`);
  }

  return res.json();
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
  } catch (err) {
    console.warn("⚠️ [bring] failed to parse tracking response:", err.message);
    return null;
  }
}

async function sendTrackingEmail({ email, consignmentNumber, status }) {
  const url = `${APP_URL}/api/send-tracking-email`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      consignmentNumber,
      status,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`send-tracking-email failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function processConsignment({ consignmentNumber, email }) {
  if (!consignmentNumber || !email) {
    console.warn("⚠️ [bring] missing consignmentNumber or email, skipping");
    return;
  }

  const state = loadState();
  const key = String(consignmentNumber);

  if (state.notified[key]) {
    console.log(`ℹ️ [bring] already notified for ${key}, skipping`);
    return;
  }

  console.log(`🔍 [bring] checking tracking for ${key}...`);

  let trackingData;
  try {
    trackingData = await fetchBringTracking(key);
  } catch (err) {
    console.error(`❌ [bring] failed to fetch tracking for ${key}:`, err.message);
    return;
  }

  console.log(`📦 [bring] tracking response for ${key}:`, JSON.stringify(trackingData, null, 2));

  const status = extractLatestStatus(trackingData);

  if (!status) {
    console.log(`⚠️ [bring] no status found for ${key}`);
    return;
  }

  console.log(`📊 [bring] ${key} current status: ${status}`);

  if (status === "IN_TRANSIT") {
    console.log(`🚚 [bring] ${key} is IN_TRANSIT, sending email...`);
    try {
      const result = await sendTrackingEmail({ email, consignmentNumber: key, status });
      console.log(`✅ [bring] tracking email sent for ${key}:`, result);

      state.notified[key] = {
        email,
        status,
        sentAt: new Date().toISOString(),
      };
      saveState(state);
    } catch (err) {
      console.error(`❌ [bring] failed to send tracking email for ${key}:`, err.message);
    }
  } else {
    console.log(`ℹ️ [bring] ${key} status is ${status}, not IN_TRANSIT yet`);
  }
}

async function poll() {
  console.log("🔔 [bring] starting tracking poll...");

  // In test mode, replace this array with your test consignments.
  // In production, fetch this from your database instead.
  const shipments = process.argv.slice(2).length > 0
    ? process.argv.slice(2).map((arg) => {
        const [consignmentNumber, email] = arg.split(":");
        return { consignmentNumber, email };
      })
    : [
        // Example test shipment:
        // { consignmentNumber: "123456789", email: "customer@example.com" },
      ];

  if (!shipments.length) {
    console.log("⚠️ [bring] no shipments to check. Provide arguments like: node bringTracking.js 123456789:customer@example.com");
    return;
  }

  for (const shipment of shipments) {
    await processConsignment(shipment);
  }

  console.log("✅ [bring] polling complete");
}

if (require.main === module) {
  poll().catch((err) => {
    console.error("❌ [bring] poll failed:", err);
    process.exit(1);
  });
}

module.exports = { poll, processConsignment, fetchBringTracking, extractLatestStatus };
