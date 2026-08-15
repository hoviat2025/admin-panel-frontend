import { API_BASE_URL } from "@/config";

export interface StatisticsResponse {
  overview: {
    total_users: number;
    eurobot_members: number;
    hilfen_members: number;
    members_of_both: number;
    members_of_neither: number;
  };
  new_joins: {
    eurobot: JoinPeriods;
    hilfen: JoinPeriods;
  };
  countries: {
    iran: number;
    germany: number;
    other: number;
    unknown: number;
  };
}

interface JoinPeriods {
  last_24_hours: number;
  last_7_days: number;
  last_30_days: number;
  last_365_days: number;
}

interface StandardResponse<T> {
  data: T;
  error?: { code?: string; message?: string };
}

export async function fetchStatistics(token: string): Promise<StatisticsResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/statistics/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = (await response.json()) as StandardResponse<StatisticsResponse>;
  if (!response.ok || !payload.data) {
    throw new Error(
      typeof payload.error?.message === "string"
        ? payload.error.message
        : "دریافت آمار با مشکل مواجه شد.",
    );
  }

  return payload.data;
}
