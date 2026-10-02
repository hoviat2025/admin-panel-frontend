import { API_BASE_URL } from "@/config";
import {
  Category,
  CategoryCreatePayload,
  CategoryTreeNode,
  CategoryUpdatePayload,
  OwnerCandidate,
  PaginationMeta,
  Service,
  ServiceAggregateSavePayload,
  ServiceCategoryInput,
  ServiceContactInput,
  ServiceCreatePayload,
  ServiceListFilters,
  ServiceStatus,
  ServiceUpdatePayload,
} from "@/types/service";

/**
 * Client for the admin service-management API
 * (/api/admin/service-management/*).
 *
 * Mirrors lib/auditApi.ts: same auth header source, same envelope handling, and
 * the backend's own error message is preferred over a generic string so the
 * admin sees the real reason (for example "a published service must mark
 * exactly one category as primary").
 */

const BASE = `${API_BASE_URL}/admin/service-management`;

export interface Envelope<T> {
  data: T;
  meta?: Partial<PaginationMeta>;
  error?: { code?: string; message?: string } | Record<string, never>;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}`,
  "Content-Type": "application/json",
});

/** Throws with the backend's message so callers can surface it verbatim. */
async function unwrap<T>(response: Response): Promise<Envelope<T>> {
  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("نشست شما منقضی شده است. دوباره وارد شوید.");
    }
    if (response.status === 403) {
      throw new Error("شما اجازه انجام این عملیات را ندارید.");
    }
    const message = body?.error && typeof body.error === "object" ? body.error.message : undefined;
    throw new Error(message || `درخواست با خطا مواجه شد (${response.status}).`);
  }

  return body ?? ({ data: null as T, meta: {}, error: {} });
}

async function request<T>(path: string, init?: RequestInit): Promise<Envelope<T>> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  return unwrap<T>(response);
}

/* ---------------------------------------------------------------- services */

function buildServiceQuery(filters: ServiceListFilters, page: number, size: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(size));
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export async function fetchServices(
  filters: ServiceListFilters,
  page = 1,
  size = 20,
): Promise<{ services: Service[]; meta: PaginationMeta }> {
  const body = await request<Service[]>(`/services/?${buildServiceQuery(filters, page, size)}`);
  return {
    services: body.data ?? [],
    meta: {
      total: body.meta?.total ?? 0,
      page: body.meta?.page ?? page,
      size: body.meta?.size ?? size,
      pages: body.meta?.pages ?? 1,
    },
  };
}

export async function fetchService(id: number): Promise<Service> {
  const body = await request<Service>(`/services/${id}`);
  return body.data;
}

export async function createService(payload: ServiceCreatePayload): Promise<Service> {
  const body = await request<Service>("/services/", { method: "POST", body: JSON.stringify(payload) });
  return body.data;
}

export async function updateService(id: number, payload: ServiceUpdatePayload): Promise<Service> {
  const body = await request<Service>(`/services/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  return body.data;
}

/**
 * Save the whole editable aggregate of an existing service in one request.
 *
 * This is what the editor uses for an existing service: one transaction, so a
 * failure cannot leave new contacts with old categories.
 *
 * `payload.expected_updated_at` is the `updated_at` that was loaded and is
 * mandatory: it is what lets the backend detect that someone else saved in the
 * meantime and answer 409 instead of overwriting their work.
 */
export async function saveServiceAggregate(
  id: number,
  payload: ServiceAggregateSavePayload,
): Promise<Service> {
  const body = await request<Service>(`/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return body.data;
}

export async function changeServiceStatus(id: number, status: ServiceStatus): Promise<Service> {
  const body = await request<Service>(`/services/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return body.data;
}

export async function assignServiceOwner(
  id: number,
  ownerUserId: number | null,
): Promise<Service> {
  const body = await request<Service>(`/services/${id}/owner`, {
    method: "PATCH",
    body: JSON.stringify({ owner_user_id: ownerUserId }),
  });
  return body.data;
}

export async function setServiceShowOwner(id: number, showOwner: boolean): Promise<Service> {
  const body = await request<Service>(`/services/${id}/show-owner?show_owner=${showOwner}`, {
    method: "PATCH",
  });
  return body.data;
}

export async function replaceServiceContacts(
  id: number,
  contacts: ServiceContactInput[],
): Promise<Service> {
  const body = await request<Service>(`/services/${id}/contacts`, {
    method: "PUT",
    body: JSON.stringify({ contacts }),
  });
  return body.data;
}

export async function replaceServiceCategories(
  id: number,
  categories: ServiceCategoryInput[],
): Promise<Service> {
  const body = await request<Service>(`/services/${id}/categories`, {
    method: "PUT",
    body: JSON.stringify({ categories }),
  });
  return body.data;
}

/* -------------------------------------------------------------- categories */

export async function fetchCategories(includeInactive = true): Promise<Category[]> {
  const body = await request<Category[]>(`/categories/?include_inactive=${includeInactive}`);
  return body.data ?? [];
}

export async function fetchCategoryTree(includeInactive = true): Promise<CategoryTreeNode[]> {
  const body = await request<CategoryTreeNode[]>(`/categories/tree?include_inactive=${includeInactive}`);
  return body.data ?? [];
}

export async function createCategory(payload: CategoryCreatePayload): Promise<Category> {
  const body = await request<Category>("/categories/", { method: "POST", body: JSON.stringify(payload) });
  return body.data;
}

export async function updateCategory(id: number, payload: CategoryUpdatePayload): Promise<Category> {
  const body = await request<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  return body.data;
}

/* ------------------------------------------------------------ owner lookup */

/**
 * Owner candidates come from the existing admin users endpoint. It is reused
 * as-is on purpose: it is the project's advanced user-filter API and this
 * milestone does not modify it.
 */
export async function searchOwnerCandidates(term: string, size = 10): Promise<OwnerCandidate[]> {
  const params = new URLSearchParams({ page: "1", size: String(size) });
  if (term.trim()) params.set("search", term.trim());
  const response = await fetch(`${API_BASE_URL}/admin/users-management/?${params.toString()}`, {
    headers: authHeaders(),
  });
  const body = await unwrap<OwnerCandidate[]>(response);
  return body.data ?? [];
}
