import { NextRequest } from "next/server";
import { billingService } from "@/services/billing.service";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { successResponse } from "@/utils/errors";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(body, signature)) {
    return new Response(JSON.stringify({ success: false, error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = JSON.parse(body) as {
    event: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
        };
      };
    };
  };

  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && payment?.id) {
      await billingService.handleWebhookPaymentCaptured(
        payment.order_id,
        payment.id
      );
    }
  }

  return successResponse(null, "Webhook processed");
}
