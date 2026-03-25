import { motion } from "framer-motion";
import { Brain, Zap } from "lucide-react";

interface AIInsightBannerProps {
  compact?: boolean;
}

export function AIInsightBanner({ compact }: AIInsightBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-primary">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
        <span className="font-medium">AI Engine Active</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20"
    >
      <Brain className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium text-primary">Heuristic Insight Engine v4.2 Active</span>
      <Zap className="h-3 w-3 text-primary animate-pulse-glow" />
    </motion.div>
  );
}
