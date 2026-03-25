import { useState } from "react";
import API from "@/api/axiosConfig";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  type?: string;
}

interface Props {
  recommendations: Recommendation[];
}

export function AIRecommendationsPanel({ recommendations }: Props) {
  const [executing, setExecuting] = useState<string | null>(null);

  const getAction = (type?: string): string => {
    if (type === "route_optimization")  return "REROUTE";
    if (type === "approval_backlog")    return "BATCH_APPROVE";
    if (type === "wagon_reallocation")  return "REALLOCATE_WAGONS";
    if (type === "maintenance_alert")   return "SCHEDULE_MAINTENANCE";
    if (type === "demand_surge")        return "PRE_POSITION_RAKES";
    return "BATCH_APPROVE";
  };

  const handleApply = async (rec: Recommendation) => {
    setExecuting(rec.id);
    try {
      const action = getAction(rec.type);
      await API.post("/ai/execute-action", {
        action,
        recommendationId: rec.id,
        params:           { description: rec.description },
      });
      toast.success(`Action executed: ${rec.title}`, {
        description: `Impact: ${rec.impact}`,
      });
    } catch (err: any) {
      toast.error("Action failed", {
        description: err.response?.data?.message || "Please try again",
      });
    } finally {
      setExecuting(null);
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">AI Recommendations</h3>
        <p className="text-xs text-muted-foreground text-center py-6">
          ✅ System operating optimally. No recommendations at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">AI Recommendations</h3>
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">{rec.title}</p>
            <span className="text-xs font-mono font-bold text-primary shrink-0">
              {rec.confidence}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{rec.description}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-primary font-medium">
              Impact: {rec.impact}
            </span>
            <button
              onClick={() => handleApply(rec)}
              disabled={executing === rec.id}
              className="text-xs px-3 py-1 rounded-lg border border-border bg-card hover:bg-muted
                         text-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing === rec.id ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}