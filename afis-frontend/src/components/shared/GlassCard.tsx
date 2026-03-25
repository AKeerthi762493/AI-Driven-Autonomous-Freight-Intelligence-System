import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = "", hover = true }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      whileHover={hover ? { y: -2 } : undefined}
      className={`glass-card p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
