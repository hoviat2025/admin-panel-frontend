/**
 * Service-directory types.
 *
 * These mirror the backend's Milestone 2A admin API exactly. The backend is
 * authoritative for every rule here (one primary category, provenance pairing,
 * status/publish requirements); the frontend only mirrors them to help the admin
 * and to catch obviously invalid states before a request is sent.
 */

export const SERVICE_STATUSES = ["draft", "published", "hidden", "archived"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const CONTACT_TYPES = ["phone", "email", "url", "username", "other"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export interface ServiceContact {
  id?: number;
  title: string;
  type: ContactType;
  value: string;
  platform: string | null;
  display_order: number;
  is_visible: boolean;
}

export interface ServiceCategorySummary {
  id: number;
  name: string;
  slug: string;
}

export interface ServiceCategoryAssignment {
  category_id: number;
  is_primary: boolean;
  category?: ServiceCategorySummary | null;
}

export interface Service {
  id: number;

  owner_user_id: number | null;
  show_owner: boolean;

  name: string;
  description: string | null;

  persian_owned: boolean;
  persian_language: boolean;
  persian_service: boolean;

  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;

  status: ServiceStatus;

  source: string | null;
  external_id: string | null;

  created_at: string;
  updated_at: string;

  contacts: ServiceContact[];
  categories: ServiceCategoryAssignment[];
}

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

/* ---------------------------------------------------------------- payloads */

export interface ServiceContactInput {
  title: string;
  type: ContactType;
  value: string;
  platform?: string | null;
  display_order: number;
  is_visible: boolean;
}

export interface ServiceCategoryInput {
  category_id: number;
  is_primary: boolean;
}

export interface ServiceCreatePayload {
  name: string;
  description?: string | null;
  owner_user_id?: number | null;
  show_owner: boolean;
  persian_owned: boolean;
  persian_language: boolean;
  persian_service: boolean;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: ServiceStatus;
  source?: string | null;
  external_id?: string | null;
  contacts: ServiceContactInput[];
  categories: ServiceCategoryInput[];
}

export interface ServiceUpdatePayload {
  name?: string;
  description?: string | null;
  owner_user_id?: number | null;
  show_owner?: boolean;
  persian_owned?: boolean;
  persian_language?: boolean;
  persian_service?: boolean;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: ServiceStatus;
  source?: string | null;
  external_id?: string | null;
}

/**
 * Full editable state of an existing service, saved in one request/transaction.
 * Same as create, plus the optimistic-concurrency token.
 */
export interface ServiceAggregateSavePayload extends ServiceCreatePayload {
  expected_updated_at?: string | null;
}

export interface CategoryCreatePayload {
  name: string;
  slug: string;
  parent_id?: number | null;
  description?: string | null;
  display_order: number;
  is_active: boolean;
}

export interface CategoryUpdatePayload {
  name?: string;
  slug?: string;
  parent_id?: number | null;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ServiceListFilters {
  q?: string;
  status?: ServiceStatus | "";
  city?: string;
  category_id?: string;
  owner_user_id?: string;
  persian_owned?: string;
  persian_language?: string;
  persian_service?: string;
  source?: string;
}

/* --------------------------------------------------------- owner selection */

/** Minimal shape used by the owner picker; taken from the users admin list. */
export interface OwnerCandidate {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  username: string | null;
  country: string | null;
}
