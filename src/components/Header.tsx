import { Home, ArrowRight, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const isDashboard = location.pathname === "/dashboard";

  const handleBack = () => {
    if (isDashboard) {
      logout();
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="sticky top-0 z-50 px-4 py-3">
      <header className="glass-intense container mx-auto flex items-center justify-between px-6 py-4 rounded-2xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="rounded-full hover:bg-silver-light/50"
        >
          {isDashboard ? (
            <LogOut className="h-5 w-5 text-charcoal" />
          ) : (
            <ArrowRight className="h-5 w-5 text-charcoal" />
          )}
        </Button>

        <h1 className="text-lg font-bold text-charcoal">پنل مدیریت</h1>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          className="rounded-full hover:bg-silver-light/50"
        >
          <Home className="h-5 w-5 text-charcoal" />
        </Button>
      </header>
    </div>
  );
};
