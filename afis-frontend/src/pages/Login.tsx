import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Factory, Train, Eye, ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { useNavigate } from "react-router-dom";
import API from "@/api/axiosConfig";

type Role = "industry" | "operator" | null;

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");

    if (!selectedRole)        { setError("Please select a role first."); return; }
    if (!email.trim())        { setError("Email address is required."); return; }
    if (!password.trim())     { setError("Password is required."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const { data } = await API.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const user = data.data.user;

      if (user.role !== selectedRole) {
        setError(`This account is a "${user.role}" account. Please select the correct role.`);
        return;
      }

      localStorage.setItem("afis_token", data.data.token);
      localStorage.setItem("afis_user",  JSON.stringify(user));

      navigate(user.role === "operator" ? "/operations" : "/industry");

    } catch (err: any) {
      if (!err.response) {
        setError("Cannot reach server. Make sure the backend is running on port 5000.");
      } else if (err.response.status === 401) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(err.response.data?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (role: Role) => {
    if (!role) return;
    setError("");
    setLoading(true);
    const creds = {
      industry: { email: "industry@afis.com", password: "industry123" },
      operator: { email: "operator@afis.com", password: "operator123" },
    };
    try {
      const { data } = await API.post("/auth/login", creds[role]);
      localStorage.setItem("afis_token", data.data.token);
      localStorage.setItem("afis_user",  JSON.stringify(data.data.user));
      navigate(role === "operator" ? "/operations" : "/industry");
    } catch (err: any) {
      if (!err.response) {
        setError("Backend not running. Start it: cd afis-backend && npm run dev");
      } else {
        setError("Demo failed. Run seeder: cd afis-backend && npx ts-node src/utils/seedData.ts");
      }
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: "industry" as const, icon: Factory, label: "Industry User",    desc: "Book & Track Freight"      },
    { id: "operator" as const, icon: Train,   label: "Railway Operator", desc: "Manage & Optimize Network" },
  ];

  return (
    <div className="flex min-h-svh dark">
      {/* Left - Animated Map */}
      <div className="hidden lg:flex lg:w-[60%] relative bg-background overflow-hidden">
        <div className="absolute inset-0">
          <NetworkMap dark animated showLabels />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/40" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-4">
  
            </div>
            <h1 className="text-4xl font-bold text-foreground leading-tight">
              Autonomous Freight<br />Intelligence System
            </h1>
            <p className="mt-3 text-muted-foreground text-sm max-w-md">
              AI-driven railway logistics platform for autonomous network orchestration and freight optimization.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-card">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
          className="w-full max-w-md space-y-8"
        >
          <div>
            <h2 className="text-2xl font-bold text-card-foreground">Sign In</h2>
            <p className="mt-1 text-sm text-muted-foreground">Access AFIS Command Platform</p>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Select Role
            </label>
            <div className="flex gap-3">
              {roles.map((role) => (
                <motion.button
                  key={role.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedRole(role.id); setError(""); }}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    selectedRole === role.id
                      ? "border-primary bg-primary/10 glow-primary"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <role.icon className={`h-6 w-6 mb-2 ${selectedRole === role.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-sm font-semibold text-card-foreground">{role.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{role.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4 text-muted-foreground">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Email address"
                type="email"
                className="pl-10"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Password"
                type="password"
                className="pl-10"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={handleLogin}
              disabled={loading || !selectedRole || !email || !password}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            
          </div>
        </motion.div>
      </div>
    </div>
  );
}