import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BarChart3, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStatistics, StatisticsResponse } from "@/lib/statisticsApi";

const periodLabels = [
  ["last_24_hours", "۲۴ ساعت گذشته"],
  ["last_7_days", "۷ روز گذشته"],
  ["last_30_days", "۳۰ روز گذشته"],
  ["last_365_days", "۳۶۵ روز گذشته"],
] as const;

const number = (value: number) => value.toLocaleString("fa-IR");

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl bg-white/45 px-4 py-4 text-center">
    <div className="text-2xl font-bold text-charcoal">{number(value)}</div>
    <div className="mt-1 text-sm text-silver">{label}</div>
  </div>
);

const JoinSection = ({
  title,
  values,
}: {
  title: string;
  values: StatisticsResponse["new_joins"]["eurobot"];
}) => (
  <GlassBox className="text-right">
    <h3 className="mb-4 text-lg font-bold text-charcoal">{title}</h3>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {periodLabels.map(([key, label]) => (
        <Stat key={key} label={label} value={values[key]} />
      ))}
    </div>
  </GlassBox>
);

const Statistics = () => {
  const { token } = useAuth();
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setStatistics(await fetchStatistics(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "دریافت آمار با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-right">
            <h2 className="text-xl font-bold text-charcoal">آمار و ارقام</h2>
            <p className="mt-1 text-sm text-silver">آمار اعضا و عضویت‌های جدید</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            به‌روزرسانی
          </Button>
        </div>

        {error && (
          <GlassBox className="mb-5 flex items-center justify-between gap-4 text-right">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" onClick={() => void load()}>تلاش دوباره</Button>
          </GlassBox>
        )}

        {loading && !statistics ? (
          <GlassBox className="py-16 text-center text-silver">در حال دریافت آمار...</GlassBox>
        ) : statistics ? (
          <div className="space-y-5">
            <GlassBox className="text-right">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-charcoal" />
                <h3 className="text-lg font-bold text-charcoal">نمای کلی کاربران</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="کل کاربران" value={statistics.overview.total_users} />
                <Stat label="اعضای یوروبات" value={statistics.overview.eurobot_members} />
                <Stat label="اعضای هیلفن" value={statistics.overview.hilfen_members} />
                <Stat label="عضو هر دو" value={statistics.overview.members_of_both} />
                <Stat label="عضو هیچ‌کدام" value={statistics.overview.members_of_neither} />
              </div>
            </GlassBox>

            <JoinSection title="عضویت‌های جدید یوروبات" values={statistics.new_joins.eurobot} />
            <JoinSection title="عضویت‌های جدید هیلفن" values={statistics.new_joins.hilfen} />

            <GlassBox className="text-right">
              <h3 className="mb-4 text-lg font-bold text-charcoal">توزیع کشور کاربران</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="ایران" value={statistics.countries.iran} />
                <Stat label="آلمان" value={statistics.countries.germany} />
                <Stat label="سایر کشورها" value={statistics.countries.other} />
                <Stat label="کشور نامشخص" value={statistics.countries.unknown} />
              </div>
            </GlassBox>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Statistics;
