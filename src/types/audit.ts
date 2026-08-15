export type AuditChange = {
  before: unknown;
  after: unknown;
};

export type AuditLog = {
  id: number;
  admin_id: number;
  admin_username: string;
  action: string;
  target_type: string;
  target_id: string;
  changes: Record<string, AuditChange>;
  sync_channels?: boolean | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

export type AuditListMeta = {
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type AuditListResponse = {
  data: AuditLog[];
  meta: AuditListMeta;
};
