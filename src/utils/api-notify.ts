import type { ApiResponse } from "@/types";
import { getApiErrorMessage, isValidationError } from "@/services/api.client";

type ToastFn = (props: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning" | "info";
}) => void;

export function notifySuccess(
  toast: ToastFn,
  response: ApiResponse<unknown>,
  fallbackTitle = "Success"
) {
  toast({
    variant: "success",
    title: response.message ?? fallbackTitle,
    description: response.message ? undefined : undefined,
  });
}

export function notifyError(
  toast: ToastFn,
  error: unknown,
  fallbackTitle = "Request failed"
) {
  const message = getApiErrorMessage(error, fallbackTitle);
  toast({
    variant: isValidationError(error) ? "warning" : "destructive",
    title: isValidationError(error) ? "Validation error" : fallbackTitle,
    description: message,
  });
}
