const USE_MOCK = process.env.USE_MOCK === "true";
const MYBRING_API_UID = process.env.MYBRING_API_UID;
const MYBRING_API_KEY = process.env.MYBRING_API_KEY;
const BRING_CLIENT_URL = process.env.BRING_CLIENT_URL;
const PICKUP_BASE = "https://api.qa.bring.com/pickuppoint/api";

function buildMockPickupPoints(postalCode) {
  const base = {
    id: "MOCK-PP-001",
    name: "MOCK Pakkeboks",
    address: "MOCK Gate 1",
    postalCode: postalCode || "0000",
    city: "Oslo",
    distanceInKm: 0.5,
    durationInMinutes: 2,
    pickupPointType: "LOCKER",
    openingHours: [
      { day: "Man - Fre", opening: "00:00", closing: "23:59" },
    ],
    locationDescription: "På gulvet ved inngangen",
    coordinates: { lng: 10.7522, lat: 59.9139 },
  };
  const base2 = {
    id: "MOCK-PP-002",
    name: "MOCK Butikk",
    address: "MOCK Gate 2",
    postalCode: postalCode || "0000",
    city: "Oslo",
    distanceInKm: 1.2,
    durationInMinutes: 4,
    pickupPointType: "MANNED",
    openingHours: [
      { day: "Man - Fre", opening: "09:00", closing: "17:00" },
      { day: "Lør", opening: "10:00", closing: "14:00" },
    ],
    locationDescription: "Ved kassene",
    coordinates: { lng: 10.7585, lat: 59.9112 },
  };
  return [base, base2];
}

function buildPickupPointUrl({ countryCode, postalCode, requestCountryCode, street, streetNumber }) {
  let url = `${PICKUP_BASE}/pickuppoint/${encodeURIComponent(countryCode)}/postalCode/${encodeURIComponent(postalCode)}`;
  const params = [];
  if (requestCountryCode) params.push(`requestCountryCode=${encodeURIComponent(requestCountryCode)}`);
  if (street) params.push(`street=${encodeURIComponent(street)}`);
  if (streetNumber) params.push(`streetNumber=${encodeURIComponent(streetNumber)}`);
  if (params.length) url += "?" + params.join("&");
  return url;
}

function buildBringHeaders() {
  return {
    accept: "application/json",
    "x-bring-client-url": BRING_CLIENT_URL,
    "x-bring-test-indicator": "true",
    "x-mybring-api-key": MYBRING_API_KEY,
    "x-mybring-api-uid": MYBRING_API_UID,
  };
}

function getPickupPoints(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.pickupPoints)) return data.pickupPoints;
  if (Array.isArray(data?.pickupPoint)) return data.pickupPoint;
  return [];
}

function hasNoPickupPoints(data) {
  return getPickupPoints(data).length === 0;
}

function normalizePickupPoints(data) {
  if (Array.isArray(data)) return data;
  if (!data?.pickupPoints && !data?.pickupPoint) return data;
  return {
    ...data,
    pickupPoints: getPickupPoints(data),
  };
}

async function fetchPickupPointsFromBring(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: buildBringHeaders(),
  });
  const contentType = res.headers.get("content-type");
  const data = contentType?.includes("application/json")
    ? await res.json()
    : await res.text();
  return { res, data };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode");
  const countryCode = searchParams.get("countryCode") || "NO";
  const requestCountryCode = searchParams.get("requestCountryCode");
  const street = searchParams.get("street");
  const streetNumber = searchParams.get("streetNumber");

  if (!postalCode) {
    return Response.json({ error: "postalCode er påkrevd." }, { status: 400 });
  }

  if (USE_MOCK) {
    return Response.json({ pickupPoints: buildMockPickupPoints(postalCode) });
  }

  try {
    const hasLocationFilter = Boolean(requestCountryCode || street || streetNumber);
    let url = buildPickupPointUrl({
      countryCode,
      postalCode,
      requestCountryCode,
      street,
      streetNumber,
    });
    let pickupResponse = await fetchPickupPointsFromBring(url);

    if (
      hasLocationFilter &&
      (!pickupResponse.res.ok || hasNoPickupPoints(pickupResponse.data))
    ) {
      const fallbackUrl = buildPickupPointUrl({ countryCode, postalCode });
      console.log("[Bring Pickup Point] Fallback URL:", fallbackUrl);
      pickupResponse = await fetchPickupPointsFromBring(fallbackUrl);
    } else {
      console.log("[Bring Pickup Point] URL:", url);
    }

    if (!pickupResponse.res.ok) {
      const err = typeof pickupResponse.data === "string"
        ? pickupResponse.data
        : JSON.stringify(pickupResponse.data);
      console.error("Bring Pickup Point API error:", pickupResponse.res.status, err);
      return Response.json({ error: "Kunne ikke hente hentesteder." }, { status: pickupResponse.res.status });
    }

    return Response.json(normalizePickupPoints(pickupResponse.data));

  } catch (error) {
    console.error("Pickup Point API fetch error:", error.message);
    return Response.json(
      { error: "Kunne ikke kontakte hentested-server." },
      { status: 502 }
    );
  }
}
