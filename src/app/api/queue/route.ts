import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { mailQueueRepository } from "@/repositories/mail.repository";
import { successResponse } from "@/utils/errors";
import { getPaginationParams, buildPaginationMeta } from "@/utils";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const params = getPaginationParams(searchParams);
      const status = searchParams.get("status") ?? undefined;
      const direction = searchParams.get("direction") ?? undefined;

      const { items, total } = await mailQueueRepository.findMany({
        skip: params.skip,
        take: params.limit,
        where: {
          ...(status ? { status: status as "PENDING" | "FAILED" | "DEFERRED" } : {}),
          ...(direction ? { direction: direction as "INCOMING" | "OUTGOING" } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      const stats = await mailQueueRepository.getStats();

      return successResponse(
        { items, stats },
        undefined,
        buildPaginationMeta(total, params.page, params.limit)
      );
    },
    { permission: "queue:read" }
  );
}

export async function DELETE(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");
      const status = searchParams.get("status");

      if (id) {
        await mailQueueRepository.delete(id);
        return successResponse(null, "Queue item deleted");
      }

      const result = await mailQueueRepository.deleteQueue(status ?? undefined);
      return successResponse({ deleted: result.count }, "Queue cleared");
    },
    { permission: "queue:delete" }
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (req) => {
      const body = await req.json();
      const item = await mailQueueRepository.retry(body.id);
      return successResponse(item, "Queue item retried");
    },
    { permission: "queue:update" }
  );
}
