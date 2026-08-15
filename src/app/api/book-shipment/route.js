// File: /api/book-shipment.js
// Purpose: Enforce QA product/customerNumber rules, call Bring booking API (QA by default),
// handle non-JSON (HTML) responses gracefully, and return a stable JSON result.
//
// Environment variables expected:
// - BRING_BOOKING_URL (defaults to https://api.qa.bring.com/booking/api/create)
// - MYBRING_API_KEY
// - MYBRING_API_UID
// - BRING_CLIENT_URL (used for x-bring-client-url header, default https://localhost:3000)

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRING_BOOKING_URL =
  process.env.BRING_BOOKING_URL || "https://api.qa.bring.com/booking/api/create";
const MYBRING_API_KEY = process.env.MYBRING_API_KEY || "";
const MYBRING_API_UID = process.env.MYBRING_API_UID || "";
const BRING_CLIENT_URL = process.env.BRING_CLIENT_URL || "https://localhost:3000";
const ENV = process.env.NODE_ENV || "development";

// QA defaults (per Bring docs)
const QA_PRODUCT = { id: "3622", customerNumber: "5" };
const PICKUP_SERVICE_ID = "1073";

function maskKey(key = "") {
  if (!key) return "";
  return key.length > 8 ? `${key.slice(0, 8)}...` : key;
}

function buildBringHeaders() {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "x-bring-client-url": BRING_CLIENT_URL,
    "x-bring-test-indicator": "true",
    "x-mybring-api-key": MYBRING_API_KEY,
    "x-mybring-api-uid": MYBRING_API_UID,
  };
}

function normalizeAddress(address = {}) {
  return {
    addressLine: address.addressLine || address.street || "",
    addressLine2: address.addressLine2 || null,
    postalCode: address.postalCode || address.postcode || "",
    city: address.city || "",
    countryCode: address.countryCode || address.country || "NO",
  };
}

function buildContact(contact = {}) {
  if (!contact) return undefined;
  return {
    name: contact.name || "",
    email: contact.email || "",
    phoneNumber: contact.phoneNumber || contact.phone || "",
  };
}

function buildSender(sender = {}) {
  const addr = normalizeAddress(sender.address || sender);
  return {
    name: sender.name || addr.name || "",
    addressLine: addr.addressLine,
    addressLine2: addr.addressLine2,
    postalCode: addr.postalCode,
    city: addr.city,
    countryCode: addr.countryCode,
    ...(sender.reference ? { reference: sender.reference } : {}),
    ...(sender.contact ? { contact: buildContact(sender.contact) } : {}),
  };
}

function buildRecipient(recipient = {}) {
  const addr = normalizeAddress(recipient.address || recipient);
  return {
    name: recipient.name || addr.name || "",
    addressLine: addr.addressLine,
    addressLine2: addr.addressLine2,
    postalCode: addr.postalCode,
    city: addr.city,
    countryCode: addr.countryCode,
    ...(recipient.reference ? { reference: recipient.reference } : {}),
    ...(recipient.contact ? { contact: buildContact(recipient.contact) } : {}),
  };
}

function buildPackage(pkg = {}, idx = 0) {
  return {
    weightInKg: Number(pkg.weightInKg) || 1,
    goodsDescription: pkg.goodsDescription || pkg.description || "NORYA order",
    dimensions: {
      heightInCm: Number(pkg.heightInCm) || (pkg.dimensions?.heightInCm || 10),
      widthInCm: Number(pkg.widthInCm) || (pkg.dimensions?.widthInCm || 10),
      lengthInCm: Number(pkg.lengthInCm) || (pkg.dimensions?.lengthInCm || 10),
    },
    containerId: pkg.containerId || null,
    packageType: pkg.packageType || null,
    numberOfItems: pkg.numberOfItems || null,
    ...(pkg.correlationId ? { correlationId: pkg.correlationId } : { correlationId: `PACKAGE-${idx + 1}` }),
  };
}

function buildPickupPoint(pickupPoint) {
  if (!pickupPoint) return null;
  const id = pickupPoint.id || pickupPoint.pickupPointId || "";
  if (!id) return null;
  return {
    id,
    countryCode: pickupPoint.address?.countryCode || pickupPoint.countryCode || "NO",
  };
}

function buildProductForFlow(flow = "pib", additionalServices = []) {
  // Enforce QA defaults unless explicitly running in production with env overrides
  const base = ENV === "production" ? { id: process.env.BRING_DEFAULT_PRODUCT_ID || QA_PRODUCT.id, customerNumber: process.env.BRING_DEFAULT_CUSTOMER_NUMBER || "" } : QA_PRODUCT;
  const product = { id: base.id, customerNumber: base.customerNumber };

  const services = Array.isArray(additionalServices) ? additionalServices.slice() : [];
  if (flow === "pickup" && !services.find((s) => String(s.id || s) === PICKUP_SERVICE_ID)) {
    services.push({ id: PICKUP_SERVICE_ID });
  }

  if (services.length > 0) {
    product.additionalServices = services.map((s) => ({ id: String(s.id || s) }));
  }

  return product;
}

function extractConsignmentNumber(data) {
  try {
    const consignments = Array.isArray(data?.consignments) ? data.consignments : [];
    if (!consignments.length) return null;
    const first = consignments[0];
    return first?.confirmation?.consignmentNumber || first.consignmentNumber || first.consignmentId || null;
  } catch {
    return null;
  }
}

function extractPackageNumber(data) {
  try {
    const consignments = Array.isArray(data?.consignments) ? data.consignments : [];
    if (!consignments.length) return null;
    const pkgs = consignments[0]?.confirmation?.packages || consignments[0]?.packages || [];
    if (!pkgs.length) return null;
    return pkgs[0]?.packageNumber || pkgs[0]?.package_number || null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    // Validate env
    if (!MYBRING_API_KEY || !MYBRING_API_UID) {
      console.error("❌ [bring-booking] Missing MYBRING_API_KEY or MYBRING_API_UID");
      return NextResponse.json({ error: "Missing Bring API credentials (MYBRING_API_KEY or MYBRING_API_UID)" }, { status: 500 });
    }

    const body = await req.json();

    const {
      sender,
      recipient,
      packages,
      pickupPoint,
      shippingDateTime,
      orderId,
      customerSpecifiedDispatchDateTime,
      additionalServices,
      flow = "pib",
    } = body;

    if (!sender || !recipient) {
      return NextResponse.json({ error: "sender and recipient are required" }, { status: 400 });
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json({ error: "packages array is required" }, { status: 400 });
    }

    const shipmentPayload = {
      schemaVersion: 1,
      consignments: [
        {
          shippingDateTime: shippingDateTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          ...(customerSpecifiedDispatchDateTime ? { customerSpecifiedDispatchDateTime } : {}),
          purchaseOrder: null,
          correlationId: orderId || `NORYA-${Date.now()}`,
          parties: {
            sender: buildSender(sender),
            recipient: buildRecipient(recipient),
            pickupPoint: buildPickupPoint(pickupPoint),
          },
          product: buildProductForFlow(flow, additionalServices),
          packages: packages.map((p, i) => buildPackage(p, i)),
        },
      ],
    };

    // Log headers and payload (mask key)
    const headers = buildBringHeaders();
    console.log("📤 [bring-booking] URL:", BRING_BOOKING_URL);
    console.log("📤 [bring-booking] headers:", JSON.stringify({
      ...headers,
      "x-mybring-api-key": maskKey(headers["x-mybring-api-key"]),
      "x-mybring-api-uid": headers["x-mybring-api-uid"],
    }, null, 2));
    console.log("📤 [bring-booking] payload:", JSON.stringify(shipmentPayload, null, 2));

    const response = await fetch(BRING_BOOKING_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(shipmentPayload),
      redirect: "follow",
    });

    // Always read text first to avoid JSON parse exceptions on HTML
    const rawText = await response.text();
    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    // If response is not JSON, surface a clear error with excerpt
    if (!contentType.includes("application/json")) {
      console.error("❌ [bring-booking] non-JSON response from Bring. status:", response.status, "url:", response.url);
      console.error(rawText.slice(0, 2000));
      return NextResponse.json({
        error: "Bring returned non-JSON response (likely auth/404/redirect). Check API key/UID, customerNumber and endpoint.",
        status: response.status,
        details: rawText.slice(0, 2000),
      }, { status: response.status || 502 });
    }

    // Parse JSON safely
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      console.error("❌ [bring-booking] invalid JSON from Bring:", err);
      console.error(rawText.slice(0, 2000));
      return NextResponse.json({ error: "Invalid JSON from Bring", details: rawText.slice(0, 2000) }, { status: 502 });
    }

    // Domain-level errors inside consignments
    if (data?.consignments?.[0]?.errors) {
      console.warn("⚠️ [bring-booking] Bring returned domain errors:", JSON.stringify(data.consignments[0].errors, null, 2));
    }

    if (!response.ok) {
      console.error("❌ [bring-booking] API error:", response.status, data);
      return NextResponse.json({ error: "Bring booking failed", details: data }, { status: response.status || 502 });
    }

    const consignmentNumber = extractConsignmentNumber(data);
    const packageNumber = extractPackageNumber(data);
    const trackingUrl = consignmentNumber ? `https://sporing.posten.no/sporing/${consignmentNumber}` : null;

    console.log("✅ [bring-booking] consignmentNumber:", consignmentNumber, "packageNumber:", packageNumber, "trackingUrl:", trackingUrl);

    return NextResponse.json({
      success: true,
      consignmentNumber,
      packageNumber,
      trackingUrl,
      raw: data,
    });
  } catch (err) {
    console.error("❌ [bring-booking] FAILED:", err && err.message ? err.message : String(err));
    return NextResponse.json({ error: "Failed to book Bring shipment", details: String(err) }, { status: 500 });
  }
}
