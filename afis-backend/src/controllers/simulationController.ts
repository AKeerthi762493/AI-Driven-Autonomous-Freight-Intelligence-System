import { Request, Response, NextFunction } from 'express';
import Route from '../models/Route';
import Wagon from '../models/Wagon';
import { runSimulation } from '../services/digitalTwinService';
import { sendSuccess, sendError } from '../utils/apiResponse';

const store = new Map<string, { status: string; result: unknown; startedAt: Date }>();

export const runSimulationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { source, destination, wagonCount, speedMultiplier } = req.body;
    if (!source || !destination) { sendError(res, 'Source and destination required', 400); return; }

    // ── Gap 3 fix: Pull real route from MongoDB ──────────────────────────────
    const savedRoute  = await Route.findOne({ source, destination });
    const realDistance = savedRoute?.totalDistance   || null;
    const realPath     = savedRoute?.optimizedPath   || null;

    // ── Pull real wagons from MongoDB (available/assigned ones) ──────────────
    const dbWagons = await Wagon.find({ status: { $in: ['available', 'assigned', 'in-transit'] } })
      .limit(wagonCount || 3)
      .select('_id wagonNumber');

    const realWagons = dbWagons.map(w => ({
      id:     (w._id as any).toString(),
      number: w.wagonNumber,
    }));

    // Run simulation with real data
    const result = runSimulation(
      source,
      destination,
      wagonCount      || 3,
      speedMultiplier || 1.0,
      realWagons.length > 0 ? realWagons : undefined,
      realDistance,
      realPath,
    );

    store.set(result.simulationId, {
      status:    'completed',
      result,
      startedAt: new Date(),
    });

    sendSuccess(res, {
      simulation: result,
      usedRealRoute:  !!savedRoute,
      usedRealWagons: realWagons.length > 0,
      routeFromDB:    savedRoute
        ? { id: savedRoute._id, totalDistance: savedRoute.totalDistance, stops: savedRoute.optimizedPath?.length }
        : null,
    }, 'Simulation completed');

  } catch (e) { next(e); }
};

export const getSimulationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (id && store.has(id)) {
      sendSuccess(res, store.get(id)!);
      return;
    }
    sendSuccess(res, {
      simulations: Array.from(store.entries())
        .map(([k, v]) => ({ simulationId: k, ...v }))
        .slice(-10),
      totalRun: store.size,
    });
  } catch (e) { next(e); }
};