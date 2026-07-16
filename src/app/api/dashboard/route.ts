import { NextRequest } from "next/server";
import { withAuth } from "@/middleware/auth";
import { dashboardService } from "@/services/dashboard.service";
import { successResponse } from "@/utils/errors";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (req, user) => {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get("type") ?? "overview";

      if (type === "charts") {
        const days = parseInt(searchParams.get("days") ?? "30", 10);
        const charts = await dashboardService.getChartData(days);
        return successResponse(charts);
      }

      if (user.role === UserRole.SUPER_ADMIN) {
        const stats = await dashboardService.getSuperAdminStats();
        return successResponse({
          ...stats,
          totalStorage: stats.totalStorage.toString(),
          usedStorage: stats.usedStorage.toString(),
        });
      }

      if (user.role === UserRole.ORG_ADMIN && user.organizationId) {
        const stats = await dashboardService.getOrgAdminStats(user.organizationId);
        return successResponse(stats);
      }

      const stats = await dashboardService.getUserStats(user.id);
      return successResponse(stats);
    },
    { permission: "dashboard:read" }
  );
}
