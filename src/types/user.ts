export interface User {
  counter: number | null;
  accounting_code: string | null;
  ban_time: number;
  country: string | null;
  first_name: string | null;
  is_ban: boolean;
  is_registered: boolean;
  join_date: number | null;
  last_name: string | null;
  mode: string | null;
  nickname: string | null;
  password: string | null;
  phone_number: string | null;
  score: number;
  user_id: number;
  username: string | null;
  whatsapp_number: string | null;
  profile_path: string | null;
  telegram_message_id: string | null;
  chat_not_found: boolean;
  updated_at: string;
  channel_updated_at: string | null;
  group_message_id: string | null;
  public_message_id: string | null;
  public_group_message_id: string | null;
  is_in_eurobot: boolean;
  is_in_hilfen_bot: boolean;
  hilfen_id: number | null;
  hilfen_status: string | null;
  hilfen_date_join: number | null;
  hilfen_command: string | null;
  hilfen_data: string | null;
  hilfen_id_card_photo: string | null;
  hilfen_all_projects: number | null;
  hilfen_all_projects_done: number | null;
  hilfen_limits_time: number | null;
  hilfen_message_id: number | null;
  hilfen_group_message_id: number | null;
  field_updated_at: Record<string, string | null>;
}

export const getProfileImageUrl = (profilePath: string | null | undefined) => {
  if (!profilePath) return "";
  if (/^https?:\/\//i.test(profilePath)) return profilePath;
  return `https://pub-4036d35baed54ee7a9504072ea49740f.r2.dev/${profilePath}`;
};
