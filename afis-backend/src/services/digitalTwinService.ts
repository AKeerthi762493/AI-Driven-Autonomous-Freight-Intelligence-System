import { dijkstra } from './routeOptimizationService';

export interface SimulationStep {
  step:              number;
  timestamp:         string;
  wagonId:           string;
  wagonNumber:       string;
  location:          string;
  progressPercent:   number;
  speedKmh:          number;
  distanceCovered:   number;
  remainingDistance: number;
  status:            'moving' | 'stopped' | 'arrived';
}

export interface SimulationResult {
  simulationId:    string;
  source:          string;
  destination:     string;
  totalDistance:   number;
  totalTimeMinutes: number;
  steps:           SimulationStep[];
  completedAt:     string;
  routePath:       string[];
  dataSource:      string;
  summary: {
    avgSpeedKmh:     number;
    stopsCount:      number;
    onTime:          boolean;
    predictedDelay:  number;
    routeStops:      number;
  };
}

const STEPS = 10;

// ─── Main simulation — uses real route data when provided ────────────────────
export const runSimulation = (
  source:          string,
  destination:     string,
  wagonCount       = 3,
  speedMultiplier  = 1.0,
  // Real data injected from simulationController
  realWagons?:     Array<{ id: string; number: string }>,
  realDistance?:   number | null,
  realPath?:       Array<{ station: string; distanceFromPrevious: number }> | null
): SimulationResult => {

  // Use real Dijkstra path
  const dijkResult  = dijkstra(source, destination);
  const path        = realPath || dijkResult.path;
  const totalDist   = realDistance || dijkResult.totalDistance || 500;
  const totalTime   = Math.round((totalDist / 25) * 60 / speedMultiplier); // 25 km/h IR avg
  const avgSpeed    = totalDist / (totalTime / 60);

  // Use real wagons from DB if provided, else use defaults
  const defaultWagons = [
    { id: 'W001', number: 'WGN-001' },
    { id: 'W002', number: 'WGN-002' },
    { id: 'W003', number: 'WGN-003' },
  ];
  const wagons      = (realWagons && realWagons.length > 0)
    ? realWagons.slice(0, Math.min(wagonCount, realWagons.length))
    : defaultWagons.slice(0, Math.min(wagonCount, 3));

  const steps: SimulationStep[] = [];
  const now         = new Date();
  let   stops       = 0;
  let   totalDelay  = 0;

  // Build station checkpoint map from real path
  const stationCheckpoints: Array<{ station: string; atDistance: number }> = [];
  let cumDist = 0;
  for (const node of path) {
    cumDist += node.distanceFromPrevious || 0;
    stationCheckpoints.push({ station: node.station, atDistance: cumDist });
  }

  for (let i = 0; i <= STEPS; i++) {
    const prog    = i / STEPS;
    const dist    = Math.round(totalDist * prog);
    const rem     = totalDist - dist;

    // Find current station from real path checkpoints
    let loc = source;
    for (const cp of stationCheckpoints) {
      if (cp.atDistance <= dist) loc = cp.station;
    }

    // Realistic delay: 10% chance of stop, adds 5-15 min delay
    const stopped   = i > 0 && i < STEPS && Math.random() < 0.1;
    const delayMins = stopped ? Math.round(5 + Math.random() * 10) : 0;
    if (stopped) { stops++; totalDelay += delayMins; }

    const ts = new Date(now.getTime() + (i * totalTime * 60000) / STEPS + totalDelay * 60000);

    for (const w of wagons) {
      steps.push({
        step:              i,
        timestamp:         ts.toISOString(),
        wagonId:           w.id,
        wagonNumber:       w.number,
        location:          i === STEPS ? destination : loc,
        progressPercent:   Math.round(prog * 100),
        speedKmh:          stopped ? 0 : Math.round(avgSpeed + (Math.random() - 0.5) * 15),
        distanceCovered:   dist,
        remainingDistance: rem,
        status:            i === STEPS ? 'arrived' : stopped ? 'stopped' : 'moving',
      });
    }
  }

  const routePath = path.map(p => p.station);

  return {
    simulationId:     `SIM-${Date.now()}`,
    source,
    destination,
    totalDistance:    totalDist,
    totalTimeMinutes: totalTime + totalDelay,
    steps,
    completedAt:      new Date(now.getTime() + (totalTime + totalDelay) * 60000).toISOString(),
    routePath,
    dataSource: realDistance
      ? 'MongoDB saved route + real wagon data'
      : 'Dijkstra IR distances + default wagons',
    summary: {
      avgSpeedKmh:    Math.round(avgSpeed),
      stopsCount:     stops,
      onTime:         stops <= 1 && totalDelay <= 15,
      predictedDelay: totalDelay,
      routeStops:     routePath.length,
    },
  };
};