import { API_BASE_URL } from "@/config";
import { AuditListResponse, AuditLog } from "@/types/audit";

export type AuditFilters = {
  admin_id?: string;
  admin_username?: string;
  target_user_id?: string;
  action?: string;
  changed_field?: string[];
  created_after?: string;
  created_before?: string;
  sync_channels?: "true" | "false";
};

export function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
});

const unwrap = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const body = await response.json();
  const error = body?.error;
  if (error && typeof error === "object" && Object.keys(error).length > 0) {
    throw new Error(error.message || "Request failed");
  }
  return body as T;
};

export async function fetchAuditLogs(
  filters: AuditFilters,
  page = 1,
  size = 20,
): Promise<AuditListResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  });
  const response = await fetch(`${API_BASE_URL}/admin/audit-logs/?${params}`, {
    headers: authHeaders(),
  });
  return unwrap<AuditListResponse>(response);
}

export async function fetchAuditLog(id: number): Promise<AuditLog> {
  const response = await fetch(`${API_BASE_URL}/admin/audit-logs/${id}`, {
    headers: authHeaders(),
  });
  const body = await unwrap<{ data: AuditLog }>(response);
  return body.data;
}
