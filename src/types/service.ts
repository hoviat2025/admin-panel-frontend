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

/**
 * Tri-state Iranian/Persian relevance.
 *
 * `null` is "not assessed", which is a genuinely different answer from `false`.
 * Curated and imported data frequently does not know, and showing that as "No"
 * would both misinform admins and destroy the ability to find the gaps later.
 */
export type RelevanceAnswer = true | false | null;

export const RELEVANCE_KEYS = [
  "persian_owned",
  "persian_provider",
  "persian_language",
  "persian_service",
] as const;
export type RelevanceKey = (typeof RELEVANCE_KEYS)[number];

/** What an admin can pick for a relevance signal. */
export const RELEVANCE_ANSWERS = ["unknown", "yes", "no"] as const;
export type RelevanceAnswerChoice = (typeof RELEVANCE_ANSWERS)[number];

/** Map the stored tri-state value onto the choice an admin picks. */
export function relevanceAnswerToChoice(value: RelevanceAnswer): RelevanceAnswerChoice {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

/** Map an admin's choice back onto the stored tri-state value. */
export function relevanceChoiceToAnswer(choice: RelevanceAnswerChoice): RelevanceAnswer {
  if (choice === "yes") return true;
  if (choice === "no") return false;
  return null;
}

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

  // Tri-state Iranian/Persian relevance. null = not assessed. These describe the
  // listing and the people connected to it, NOT its location, which is Germany.
  persian_owned: RelevanceAnswer;
  persian_provider: RelevanceAnswer;
  persian_language: RelevanceAnswer;
  persian_service: RelevanceAnswer;

  address: string | null;
  postal_code: string | null;
  city: string | null;
  /** First-level administrative area; in the German scope, the Bundesland. */
  state: string | null;
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
  // Tri-state relevance; null means not assessed and is sent as null.
  persian_owned: RelevanceAnswer;
  persian_provider: RelevanceAnswer;
  persian_language: RelevanceAnswer;
  persian_service: RelevanceAnswer;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  state?: string | null;
  /** Defaults to Germany in the admin UI; still overridable. */
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: ServiceStatus;
  source?: string | null;
  external_id?: string | null;
  contacts: ServiceContactInput[];
  categories: ServiceCategoryInput[];
}

/**
 * Tri-state relevance for a partial update.
 *
 * A key that is present sets that signal, including to `null` ("unknown"); a key
 * that is absent leaves it alone. This is why the fields are nested rather than
 * optional at the top level: with optional top-level fields, `null` would be
 * indistinguishable from "not supplied".
 */
export type ServiceRelevanceUpdate = Partial<Record<RelevanceKey, RelevanceAnswer>>;

export interface ServiceUpdatePayload {
  name?: string;
  description?: string | null;
  owner_user_id?: number | null;
  show_owner?: boolean;
  relevance?: ServiceRelevanceUpdate;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: ServiceStatus;
  source?: string | null;
  external_id?: string | null;
}

/**
 * Full editable state of an existing service, saved in one request/transaction.
 * Same as create, plus the mandatory optimistic-concurrency token: the
 * `updated_at` that was loaded. The backend refuses the save with 409 if the row
 * moved on since.
 */
export interface ServiceAggregateSavePayload extends ServiceCreatePayload {
  expected_updated_at: string;
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

/**
 * Admin list filters.
 *
 * Location (state = Bundesland, city) and the four relevance signals are
 * independent filters: a listing in Hessen and a listing relevant to Persian
 * speakers are separate dimensions, and the UI never implies one from the other.
 */
export interface ServiceListFilters {
  q?: string;
  status?: ServiceStatus | "";
  city?: string;
  state?: string;
  category_id?: string;
  owner_user_id?: string;
  persian_owned?: RelevanceAnswerChoice | "";
  persian_provider?: RelevanceAnswerChoice | "";
  persian_language?: RelevanceAnswerChoice | "";
  persian_service?: RelevanceAnswerChoice | "";
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
