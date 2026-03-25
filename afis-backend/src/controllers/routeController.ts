import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import Route from '../models/Route';
import { dijkstra, getRealDistance } from '../services/routeOptimizationService';
import { sendSuccess, sendError } from '../utils/apiResponse';
import logger from '../utils/logger';

export const optimizeRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendError(res, 'Validation failed', 400, errors.array()); return; }

    const { source, destination, trafficFactor = 1.0 } = req.body;
    if (source === destination) { sendError(res, 'Source and destination cannot be the same', 400); return; }

    // Try ORS API first for real distances
    let realDistance = await getRealDistance(source, destination);

    // Dijkstra on real IR distances
    const result = dijkstra(source, destination);
    if (!result.found) { sendError(res, `No route found between ${source} and ${destination}`, 404); return; }

    const totalDistance = realDistance?.distance || result.totalDistance;
    const avgSpeedKmph  = 25; // Real IR freight average

    // Apply traffic factor
    const adjustedTime = Math.round((totalDistance / avgSpeedKmph) * 60 * trafficFactor);

    // Save or update route in DB
    let route = await Route.findOne({ source, destination });
    if (!route) {
      route = await Route.create({
        source, destination,
        optimizedPath:  result.path,
        totalDistance,
        estimatedTime:  adjustedTime,
        trafficFactor,
        status:         'active',
        delayMinutes:   0,
      });
    } else {
      route.optimizedPath = result.path;
      route.totalDistance = totalDistance;
      route.estimatedTime = adjustedTime;
      route.trafficFactor = trafficFactor;
      await route.save();
    }

    sendSuccess(res, {
      route,
      optimization: {
        pathFound:           true,
        stops:               result.path.length,
        totalDistance,
        estimatedTimeHours:  (adjustedTime / 60).toFixed(1),
        dataSource:          realDistance ? 'OpenRouteService API' : 'Indian Railways Statistics',
        avgSpeedKmph,
      },
    }, 'Route optimized');
  } catch (error) {
    next(error);
  }
};

export const getAllRoutes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const routes = await Route.find().sort({ createdAt: -1 }).limit(50);
    sendSuccess(res, { routes, total: routes.length });
  } catch (error) {
    next(error);
  }
};