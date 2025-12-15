import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassBox } from "@/components/GlassBox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config"; // Import the central URL

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Prepare data as Form URL Encoded (Required by your API)
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      // 2. Send Request
      const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
        method: "POST",
        headers: {
          // Important: This matches the curl command you provided
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const data = await response.json();

      // 3. Handle Response
      if (response.ok && data.access_token) {
        // Success: The API returns { access_token: "...", ... }
        login(data.access_token);
        
        toast({
          title: "خوش آمدید!",
          description: "ورود با موفقیت انجام شد",
        });
        navigate("/dashboard");
      } else {
        // Error: The API returns { error: { message: "..." } }
        const errorMessage = data.error?.message || "نام کاربری یا رمز عبور اشتباه است";
        
        toast({
          variant: "destructive",
          title: "خطا در ورود",
          description: errorMessage,
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مشکلی در برقراری ارتباط با سرور پیش آمد",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <GlassBox intense className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full gold-button flex items-center justify-center">
              <User className="w-10 h-10 text-charcoal" />
            </div>
            <h1 className="text-2xl font-bold text-charcoal">پنل مدیریت</h1>
            <p className="text-silver mt-2">وارد حساب کاربری خود شوید</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">
                نام کاربری
              </label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-silver" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="نام کاربری را وارد کنید"
                  className="pr-10 bg-secondary/50 border-silver-light/50 text-charcoal placeholder:text-silver/50 rounded-xl h-12"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">
                رمز عبور
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-silver" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور را وارد کنید"
                  className="pr-10 bg-secondary/50 border-silver-light/50 text-charcoal placeholder:text-silver/50 rounded-xl h-12"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="w-full rounded-xl h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "ورود"
              )}
            </Button>
          </form>
        </GlassBox>
      </div>
    </div>
  );
};

export default Login;