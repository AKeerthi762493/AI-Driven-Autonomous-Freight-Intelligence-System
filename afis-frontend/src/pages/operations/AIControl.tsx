import { useEffect, useState } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { AIRecommendationsPanel } from "@/components/shared/AIRecommendationsPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Brain, Zap, Shield, TrendingUp } from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

export default function AIControl() {
  const [autoDecision, setAutoDecision] = useState(true);
  const [aiRecs,       setAiRecs]       = useState<any[]>([]);
  const [kpi,          setKpi]          = useState({ decisions:0, autoApproved:0, manualReview:0, timeSaved:"0h" });
  const [loading,      setLoading]      = useState(true);
  const [running,      setRunning]      = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [recRes, analyticsRes] = await Promise.all([
        API.get("/ai/recommendations"),
        API.get("/analytics/dashboard"),
      ]);
      const recs = recRes.data.data.recommendations;
      setAiRecs(recs.map((r: any) => ({
        id:         r.id,
        title:      r.title,
        description:r.description,
        impact:     r.estimatedImpact,
        confidence: r.priority === "critical" ? 94 : r.priority === "high" ? 88 : 79,
        type:       r.type,
      })));
      const k = analyticsRes.data.data.kpi;
      setKpi({
        decisions:   k.totalFreightRequests,
        autoApproved:k.activeShipments,
        manualReview:k.pendingApprovals,
        timeSaved:   `${Math.round((k.totalFreightRequests || 0) * 0.4)}h`,
      });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      await load();
      toast.info("What-if analysis complete", { description: `Found ${aiRecs.length} recommendations from live data` });
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Control Center</h1>
          <p className="text-sm text-muted-foreground">Central intelligence & decision management</p>
        </div>
        <AIInsightBanner />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Decisions Today" value={loading ? 0 : kpi.decisions}   icon={Brain}      variant="primary"  />
        <KPICard label="Auto-Approved"   value={loading ? 0 : kpi.autoApproved} icon={Zap}       variant="success"  delay={0.1} />
        <KPICard label="Manual Review"   value={loading ? 0 : kpi.manualReview} icon={Shield}    variant="warning"  delay={0.2} />
        <KPICard label="Time Saved"      value={loading ? "0h": kpi.timeSaved}  icon={TrendingUp} variant="primary"  delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2" hover={false}>
          <AIRecommendationsPanel recommendations={loading ? [] : aiRecs} />
        </GlassCard>

        <div className="space-y-4">
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold mb-4">Engine Controls</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <div className="text-sm font-medium">Auto-Decision Mode</div>
                  <div className="text-xs text-muted-foreground">AI executes high-confidence decisions</div>
                </div>
                <Switch checked={autoDecision} onCheckedChange={setAutoDecision} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <div className="text-sm font-medium">Confidence Threshold</div>
                  <div className="text-xs text-muted-foreground">Min. confidence for auto-approval</div>
                </div>
                <span className="font-mono text-sm text-primary font-semibold">85%</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold mb-4">What-If Analysis</h3>
            <p className="text-xs text-muted-foreground mb-3">Run hypothetical scenarios to predict outcomes</p>
            <Button variant="outline" className="w-full" disabled={running} onClick={runAnalysis}>
              <Brain className="mr-2 h-4 w-4" /> {running ? "Analysing..." : "Run Analysis"}
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}