import { NextResponse } from "next/server";
import type { ApiResponse, PaginationMeta } from "@/types";
import { serializeForJson } from "@/utils/serialize";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

export class PlanLimitError extends AppError {
  constructor(message = "Plan Limit Reached. Upgrade your subscription.") {
    super(message, 403, "PLAN_LIMIT");
  }
}

export function successResponse<T>(
  data: T,
  message?: string,
  meta?: PaginationMeta
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data: data != null ? serializeForJson(data) : data,
    message,
    meta: meta != null ? serializeForJson(meta) : meta,
  });
}

export function errorResponse(
  error: string,
  statusCode = 500,
  code?: string
): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error, code },
    { status: statusCode }
  );
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode, error.code);
  }

  if (error instanceof Error) {
    console.error("Unhandled API error:", error);
    return errorResponse(
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
      500
    );
  }

  return errorResponse("Internal server error", 500);
}
