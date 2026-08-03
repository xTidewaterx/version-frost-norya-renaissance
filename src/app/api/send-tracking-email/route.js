import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTrackingHtml({ consignmentNumber, trackingUrl }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:32px 0;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                   style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">
              <tr>
                <td style="background:#111827; padding:28px 32px;">
                  <h1 style="margin:0; color:#ffffff; font-size:22px;">NORYA Marketplace</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 12px; color:#111827; font-size:20px;">Your order is on its way! 🚚</h2>
                  <p style="margin:0 0 16px; color:#52525b; font-size:15px; line-height:1.6;">
                    Great news! Your shipment has been picked up and is now in transit.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                         style="background:#f4f4f5; border-radius:8px; margin:16px 0;">
                    <tr>
                      <td style="padding:16px 20px; color:#52525b; font-size:14px;">Tracking number</td>
                      <td style="padding:16px 20px; color:#111827; font-size:14px; font-weight:bold; text-align:right;">${consignmentNumber}</td>
                    </tr>
                  </table>
                  <p style="margin:24px 0 0;">
                    <a href="${trackingUrl}" style="display:inline-block; background:#111827; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">Track your shipment</a>
                  </p>
                  <p style="margin:24px 0 0; color:#a1a1aa; font-size:12px;">
                    If you have any questions, reply to this email and we will be happy to help.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, consignmentNumber } = body;

    if (!email || !consignmentNumber) {
      return NextResponse.json(
        { error: "email and consignmentNumber are required" },
        { status: 400 }
      );
    }

    const trackingUrl = `https://tracking.bring.com/tracking/${consignmentNumber}`;

    const html = getTrackingHtml({ consignmentNumber, trackingUrl });

    await sendEmail({
      to: email,
      subject: `Your NORYA order is in transit — ${consignmentNumber}`,
      html,
    });

    return NextResponse.json({ received: true, consignmentNumber });
  } catch (err) {
    console.error("❌ [send-tracking-email] FAILED:", err);
    return NextResponse.json(
      { error: "Failed to send tracking email" },
      { status: 500 }
    );
  }
}
