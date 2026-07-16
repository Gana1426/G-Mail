import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { billingService } from "@/services/billing.service";
import { successResponse } from "@/utils/errors";
import { ForbiddenError } from "@/utils/errors";
import { verifyRazorpayPaymentSchema } from "@/utils/validation";
import { UserRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    if (!user.organizationId) {
      throw new ForbiddenError("No organization associated with this account");
    }
    if (user.role !== UserRole.ORG_ADMIN) {
      throw new ForbiddenError("Only organization admins can verify payments");
    }

    const body = await req.json();
    const input = verifyRazorpayPaymentSchema.parse(body);

    const status = await billingService.verifyPayment(
      user.organizationId,
      {
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
      },
      user
    );

    return successResponse(status, "Payment verified. Plan activated.");
  });
}
