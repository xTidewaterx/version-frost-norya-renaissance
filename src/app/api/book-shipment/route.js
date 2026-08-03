import { NextResponse } from "next/server";

const BRING_BOOKING_URL = process.env.BRING_BOOKING_URL || "https://api.qa.bring.com/booking/api/create";
const MYBRING_API_KEY = process.env.MYBRING_API_KEY;
const MYBRING_API_UID = process.env.MYBRING_API_UID;
const BRING_CLIENT_URL = process.env.BRING_CLIENT_URL || "https://localhost:3000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildBringHeaders() {
  const headers = {
    accept: "application/json",
    "x-bring-client-url": BRING_CLIENT_URL,
    "x-bring-test-indicator": "true",
    "x-mybring-api-key": MYBRING_API_KEY,
    "x-mybring-api-uid": MYBRING_API_UID,
  };
  console.log("📤 [bring-booking] headers:", JSON.stringify(headers, null, 2));
  return headers;
}

function normalizeAddress(address = {}) {
  return {
    street: address.street || "",
    streetNumber: address.streetNumber || "",
    postalCode: address.postalCode || "",
    city: address.city || "",
    countryCode: address.countryCode || "NO",
  };
}

function buildSender({ name, address }) {
  const a = normalizeAddress(address);
  return {
    name,
    address: {
      ...a,
      displayName: name,
    },
  };
}

function buildRecipient({ name, email, address }) {
  const a = normalizeAddress(address);
  return {
    name,
    email,
    address: {
      ...a,
      displayName: name,
    },
  };
}

function buildPackage({ weightInKg, lengthInCm, widthInCm, heightInCm }) {
  return {
    weightInKg: Number(weightInKg) || 1,
    lengthInCm: Number(lengthInCm) || 10,
    widthInCm: Number(widthInCm) || 10,
    heightInCm: Number(heightInCm) || 10,
  };
}

function buildPickupPoint(pickupPoint) {
  if (!pickupPoint) return undefined;
  const id = pickupPoint.id || pickupPoint.pickupPointId || "";
  const name = pickupPoint.name || pickupPoint.pickupPointName || "";

  if (!id && !name) return undefined;

  return {
    id,
    name,
    ...(pickupPoint.address?.postalCode && { postalCode: pickupPoint.address.postalCode }),
    ...(pickupPoint.address?.city && { city: pickupPoint.address.city }),
    ...(pickupPoint.address?.street && { street: pickupPoint.address.street }),
  };
}

function buildProduct({ serviceCode, productCode }) {
  const id = productCode || serviceCode || "BRING";
  return { id };
}

function extractConsignmentNumber(data) {
  try {
    const consignments = Array.isArray(data?.consignments)
      ? data.consignments
      : Array.isArray(data?.Consignments)
        ? data.Consignments
        : [];

    if (consignments.length === 0) return null;

    const first = consignments[0];
    return (
      first.consignmentNumber ||
      first.consignment_id ||
      first.consignmentId ||
      first.trackingNumber ||
      null
    );
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      sender,
      recipient,
      product,
      packages,
      pickupPoint,
      shippingDateTime,
      orderId,
    } = body;

    if (!sender || !recipient || !product) {
      return NextResponse.json(
        { error: "sender, recipient, and product are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json(
        { error: "packages array is required" },
        { status: 400 }
      );
    }

    const normalizedPickupPoint = buildPickupPoint(pickupPoint);

    const shipmentPayload = {
      schemaVersion: 1,
      consignments: [
        {
          orderReference: orderId || `NORYA-${Date.now()}`,
          shippingDateTime: shippingDateTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          sender: buildSender(sender),
          recipient: buildRecipient(recipient),
          product: buildProduct(product),
          packages: packages.map(buildPackage),
          ...(normalizedPickupPoint && { pickupPoint: normalizedPickupPoint }),
        },
      ],
    };

    console.log("📤 [bring-booking] URL:", BRING_BOOKING_URL);
    console.log("📤 [bring-booking] payload:", JSON.stringify(shipmentPayload, null, 2));

    const response = await fetch(BRING_BOOKING_URL, {
      method: "POST",
      headers: buildBringHeaders(),
      body: JSON.stringify(shipmentPayload),
    });

    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      console.error("❌ [bring-booking] API error:", response.status, data);
      return NextResponse.json(
        { error: "Bring booking failed", details: data },
        { status: response.status }
      );
    }

    const consignmentNumber = extractConsignmentNumber(data);
    const trackingUrl = consignmentNumber
      ? `https://tracking.bring.com/tracking/${consignmentNumber}`
      : null;

    console.log("✅ [bring-booking] consignmentNumber:", consignmentNumber, "trackingUrl:", trackingUrl);

    return NextResponse.json({
      success: true,
      consignmentNumber,
      trackingUrl,
      raw: data,
    });
  } catch (err) {
    console.error("❌ [bring-booking] FAILED:", err);
    return NextResponse.json(
      { error: "Failed to book Bring shipment" },
      { status: 500 }
    );
  }
}
