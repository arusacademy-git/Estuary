import { listDashboardSummaryFromDatabase } from "@/data/dashboard/prisma-dashboard-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const role = query.get("role");
  const userId = query.get("userId");
  const view = query.get("view") ?? "ROLE";
  if (
    !userId ||
    !role ||
    !["staff", "manager", "director", "finance"].includes(role)
  ) {
    return Response.json(
      {
        error: "INVALID_DASHBOARD_SCOPE",
        message: "A valid dashboard role and user ID are required.",
      },
      { status: 400 },
    );
  }

  if (!["ROLE", "ORGANIZATION_COMPLETED"].includes(view)) {
    return Response.json(
      {
        error: "INVALID_DASHBOARD_VIEW",
        message: "The requested dashboard view is not supported.",
      },
      { status: 400 },
    );
  }

  if (
    view === "ORGANIZATION_COMPLETED" &&
    !["director", "finance"].includes(role)
  ) {
    return Response.json(
      {
        error: "DASHBOARD_VIEW_FORBIDDEN",
        message:
          "Organization expenditure analytics is available only to Director and Finance roles.",
      },
      { status: 403 },
    );
  }

  try {
    const data = await listDashboardSummaryFromDatabase({
      role: role as "staff" | "manager" | "director" | "finance",
      userId,
      view: view as "ROLE" | "ORGANIZATION_COMPLETED",
    });
    return Response.json({ data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Dashboard records could not be loaded.";
    const databaseUnavailable =
      message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED") ||
      message.includes("P1001");

    if (databaseUnavailable) {
      return Response.json({
        data: [],
        warning: "DASHBOARD_DATABASE_UNAVAILABLE",
        message:
          "Dashboard data is temporarily unavailable. The workspace is showing an empty state until the database reconnects.",
      });
    }

    return Response.json(
      {
        error: "DASHBOARD_DATABASE_ERROR",
        message,
      },
      { status: 500 },
    );
  }
}
