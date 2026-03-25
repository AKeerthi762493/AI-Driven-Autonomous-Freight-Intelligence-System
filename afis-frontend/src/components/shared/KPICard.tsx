import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  delay?: number;
}

const variantClasses = {
  default: "border-border/50",
  primary: "border-primary/30 glow-primary",
  success: "border-success/30 glow-success",
  warning: "border-warning/30 glow-warning",
  destructive: "border-destructive/30 glow-destructive",
};

const iconVariantClasses = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function KPICard({ label, value, icon: Icon, trend, variant = "default", delay = 0 }: KPICardProps) {
  const [displayValue, setDisplayValue] = useState<string | number>(typeof value === "number" ? 0 : value);

  useEffect(() => {
    if (typeof value === "number") {
      const duration = 1000;
      const steps = 30;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.round(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay }}
      className={`glass-card p-5 ${variantClasses[variant]}`}
    >
      <div className="flex justify-between items-start">
        <span className="kpi-label">{label}</span>
        <Icon className={`h-4 w-4 ${iconVariantClasses[variant]}`} />
      </div>
      <div className="mt-3 kpi-value animate-counter-roll">{displayValue}</div>
      {trend && (
        <div className={`mt-2 text-xs font-medium ${trend.positive ? "text-success" : "text-destructive"}`}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </motion.div>
  );
}
