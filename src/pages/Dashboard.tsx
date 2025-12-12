import { useNavigate } from "react-router-dom";
import { Users, Zap, BarChart3, Brain } from "lucide-react";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";

interface DashboardItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  disabled: boolean;
}

const dashboardItems: DashboardItem[] = [
  {
    id: "users",
    title: "مدیریت کاربران",
    description: "مشاهده و جست و جو و فیلتر و ویرایش در بین کاربران",
    icon: Users,
    path: "/users",
    disabled: false,
  },
  {
    id: "shortcuts",
    title: "کار های پرتکرار",
    description: "میان بر هایی برای کارهای پرتکرار مانند مشاهده کاربران بن شده",
    icon: Zap,
    path: "/shortcuts",
    disabled: true,
  },
  {
    id: "stats",
    title: "آمار و ارقام",
    description: "مشاهده آمار و ارقام مختلف مانند تعداد کاربران و ...",
    icon: BarChart3,
    path: "/stats",
    disabled: true,
  },
  {
    id: "ai",
    title: "هوش مصنوعی",
    description: "استفاده از هوش مصنوعی برای مشاهده و جست و جو در بین کاربران",
    icon: Brain,
    path: "/ai",
    disabled: true,
  },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-charcoal mb-6 text-center">
          داشبورد
        </h2>
        
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {dashboardItems.map((item, index) => (
            <div
              key={item.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <GlassBox
                onClick={() => !item.disabled && navigate(item.path)}
                disabled={item.disabled}
                className="h-full flex flex-col items-center text-center relative"
              >
                {item.disabled && (
                  <span className="absolute top-3 left-3 text-xs text-silver bg-secondary/80 px-2 py-1 rounded-full z-10">
                    به زودی
                  </span>
                )}
                <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <item.icon className="w-7 h-7 text-charcoal" />
                </div>
                <h3 className="font-bold text-charcoal mb-2">{item.title}</h3>
                <p className="text-sm text-silver leading-relaxed">
                  {item.description}
                </p>
              </GlassBox>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
