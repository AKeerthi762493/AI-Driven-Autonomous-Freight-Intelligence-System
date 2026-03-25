import { useState, useEffect } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, FastForward } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

const SCENARIO_CONFIGS = [
  { id:1, name:"Peak Demand Surge",   source:"Mumbai",  dest:"Delhi"     },
  { id:2, name:"Route Disruption",    source:"Chennai", dest:"Bengaluru" },
  { id:3, name:"Fleet Rebalancing",   source:"Kolkata", dest:"Hyderabad" },
];

export default function DigitalTwin() {
  const [playing,   setPlaying]  = useState(false);
  const [progress,  setProgress] = useState(0);
  const [scenario,  setScenario] = useState(SCENARIO_CONFIGS[0]);
  const [simResult, setSimResult]= useState<any>(null);
  const [loading,   setLoading]  = useState(false);

  // Animate progress bar
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { setPlaying(false); return 100; }
        return p + 0.5;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [playing]);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const { data } = await API.post("/simulation/run", {
        source:          scenario.source,
        destination:     scenario.dest,
        wagonCount:      3,
        speedMultiplier: 1.0,
      });
      setSimResult(data.data.simulation);
      setProgress(0);
      setPlaying(true);
      toast.success("Simulation started", {
        description: `${scenario.source} → ${scenario.dest} | ${data.data.simulation.totalDistance} km`,
      });
    } catch(e: any) {
      toast.error("Simulation failed", { description: e.response?.data?.message || "Backend error" });
    } finally { setLoading(false); }
  };

  const reset = () => { setProgress(0); setPlaying(false); };

  const impact = simResult ? {
    delays:      simResult.summary.stopsCount,
    congestion:  Math.round(simResult.summary.stopsCount * 1.5) || 1,
    outcomes:    3,
    totalDist:   simResult.totalDistance,
    totalTime:   simResult.totalTimeMinutes,
    onTime:      simResult.summary.onTime,
  } : scenario.id === 1
    ? { delays:12, congestion:4, outcomes:3, totalDist:0, totalTime:0, onTime:false }
    : scenario.id === 2
    ? { delays:8,  congestion:2, outcomes:5, totalDist:0, totalTime:0, onTime:true  }
    : { delays:3,  congestion:1, outcomes:4, totalDist:0, totalTime:0, onTime:true  };

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Digital Twin Simulation</h1>
          <p className="text-sm text-muted-foreground">Run predictive scenarios on the network</p>
        </div>
        <AIInsightBanner compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <GlassCard className="lg:col-span-3 p-0 overflow-hidden" hover={false}>
          <div className="p-4 border-b border-border/50 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Simulation: {scenario.name}</h3>
              {simResult && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scenario.source} → {scenario.dest} · {simResult.totalDistance} km · {(simResult.totalTimeMinutes/60).toFixed(1)}h
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
              <Button size="sm" variant={playing?"destructive":"default"} onClick={() => {
                if (!simResult) { runSimulation(); } else { setPlaying(!playing); }
              }} disabled={loading}>
                {loading ? "..." : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProgress(Math.min(100, progress+10))}>
                <FastForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="h-[350px]">
            <NetworkMap dark animated={playing} showLabels />
          </div>
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-muted-foreground w-16">{progress.toFixed(0)}%</span>
              <Progress value={progress} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground">
                T+{simResult ? ((progress/100) * simResult.totalTimeMinutes / 60).toFixed(1) : (progress*0.48).toFixed(0)}h
              </span>
            </div>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard hover={false}>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">Scenarios</h4>
            <div className="space-y-2">
              {SCENARIO_CONFIGS.map(s => (
                <button key={s.id} onClick={() => { setScenario(s); reset(); setSimResult(null); }}
                  className={`w-full text-left p-3 rounded-lg transition-all text-sm ${scenario.id===s.id?"bg-primary/10 border border-primary/30":"hover:bg-muted/50"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">Predicted Impact</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Predicted Delays</span>
                <span className="font-mono text-destructive font-semibold">{impact.delays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Congestion Points</span>
                <span className="font-mono text-warning font-semibold">{impact.congestion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alt. Outcomes</span>
                <span className="font-mono text-primary font-semibold">{impact.outcomes}</span>
              </div>
              {simResult && (
                <div className={`mt-2 px-2 py-1.5 rounded text-xs font-semibold text-center ${simResult.summary.onTime?"bg-success/20 text-success":"bg-warning/20 text-warning"}`}>
                  {simResult.summary.onTime ? "✅ On-Time" : "⚠️ Delays Likely"}
                </div>
              )}
            </div>
            {!simResult && (
              <Button size="sm" variant="outline" className="w-full mt-3 text-xs" onClick={runSimulation} disabled={loading}>
                {loading ? "Running..." : "▶ Run Simulation"}
              </Button>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}