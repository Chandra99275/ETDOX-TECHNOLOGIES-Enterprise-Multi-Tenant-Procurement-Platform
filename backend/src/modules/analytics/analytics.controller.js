import { getAnalyticsDashboard } from "./analytics.service.js";

function sendError(res, error) {
  const statusCode = Number(error?.statusCode) || 500;

  if (statusCode >= 500) {
    console.error("[Analytics]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Unable to load analytics. Please check the backend logs."
        : error.message,
  });
}

export async function getDashboardAnalyticsController(req, res) {
  try {
    const analytics = await getAnalyticsDashboard(req.user);

    return res.status(200).json({
      success: true,
      message: "Dashboard analytics retrieved successfully.",
      data: analytics,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getPurchaseRequestAnalyticsController(req, res) {
  try {
    const analytics = await getAnalyticsDashboard(req.user);

    return res.status(200).json({
      success: true,
      message: "Purchase request analytics retrieved successfully.",
      data: analytics.purchaseRequests,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getInvoiceAnalyticsController(req, res) {
  try {
    const analytics = await getAnalyticsDashboard(req.user);

    return res.status(200).json({
      success: true,
      message: "Invoice analytics retrieved successfully.",
      data: analytics.invoices,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getBudgetAnalyticsController(req, res) {
  try {
    const analytics = await getAnalyticsDashboard(req.user);

    return res.status(200).json({
      success: true,
      message: "Budget analytics retrieved successfully.",
      data: analytics.budgetSummary,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getAnalyticsTrendsController(req, res) {
  try {
    const analytics = await getAnalyticsDashboard(req.user);

    return res.status(200).json({
      success: true,
      message: "Analytics trends retrieved successfully.",
      data: analytics.trends,
    });
  } catch (error) {
    return sendError(res, error);
  }
}