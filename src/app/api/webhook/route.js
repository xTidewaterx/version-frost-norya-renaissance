export async function POST(req) {
  console.log("🔥 STRIPE HIT OUR ENDPOINT!");
  return new Response("ok", { status: 200 });
}

export async function GET() {
  return new Response("Webhook endpoint is alive!", { status: 200 });
}
