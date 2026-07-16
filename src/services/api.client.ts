import type { ApiResponse } from "@/types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

class ApiClient {
  private baseUrl = "/api";

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const text = await response.text();

    if (!text) {
      if (response.ok) {
        return { success: true } as ApiResponse<T>;
      }
      throw new ApiClientError("Empty response from server", response.status);
    }

    let data: ApiResponse<T>;
    try {
      data = JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new ApiClientError("Invalid JSON response from server", response.status);
    }

    return data;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });

    const data = await this.parseResponse<T>(response);

    if (!response.ok || data.success === false) {
      throw new ApiClientError(
        data.error ?? data.message ?? "Request failed",
        response.status,
        data.code
      );
    }

    return data;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function isValidationError(error: unknown): boolean {
  return error instanceof ApiClientError && error.statusCode === 400;
}

export function isPlanLimitError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "PLAN_LIMIT";
}
