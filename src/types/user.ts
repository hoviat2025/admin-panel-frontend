export interface User {
  counter: number;
  accounting_code: string | null;
  ban_time: string;
  country: string;
  first_name: string;
  is_ban: boolean;
  is_registered: boolean;
  join_date: string;
  last_name: string;
  mode: string;
  nickname: string;
  password: string;
  phone_number: string;
  score: number;
  user_id: string;
  username: string;
  whatsapp_number: string | null;
  profile_path: string;
  telegram_message_id: string;
  chat_not_found: boolean;
  updated_at: string;
  channel_updated_at: string;
  group_message_id: string;
  public_message_id: string;
  public_group_message_id: string;
}

export const getProfileImageUrl = (profilePath: string) => {
  return `https://pub-4036d35baed54ee7a9504072ea49740f.r2.dev/${profilePath}`;
};
