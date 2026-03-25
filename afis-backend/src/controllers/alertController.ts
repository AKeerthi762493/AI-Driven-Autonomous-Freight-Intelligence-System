import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import Alert from '../models/Alert';
import Wagon from '../models/Wagon';
import Route from '../models/Route';
import FreightRequest from '../models/FreightRequest';
import { sendSuccess, sendError } from '../utils/apiResponse';
import logger from '../utils/logger';

// ── IRCTC PNR Status API (only available endpoint on this subscription) ───────
async function checkPNRStatus(pnrNumber: string): Promise<{
  status: string;
  delayed: boolean;
  trainName: string;
  from: string;
  to: string;
} | null> {
  if (!process.env.RAPIDAPI_KEY) return null;
  try {
    const { data } = await axios.get(
      `https://irctc-indian-railway-pnr-status.p.rapidapi.com/getPNRStatus/${pnrNumber}`,
      {
        headers: {
          'x-rapidapi-key':  process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': process.env.RAPIDAPI_HOST || 'irctc-indian-railway-pnr-status.p.rapidapi.com',
        },
        timeout: 6000,
      }
    );

    // API responded successfully
    if (data && data.success === false) {
      // PNR flushed/not found — not an error, just expired
      return null;
    }

    if (data && data.data) {
      const d = data.data;
      const chartPrepared = d.chartPrepared || false;
      const boardingPoint  = d.boardingPoint || d.from || '';
      const destination    = d.destinationStation || d.to || '';
      const trainName      = d.trainName || d.train || 'Unknown Train';

      // If chart not prepared and departure is soon → possible delay indicator
      return {
        status:    d.bookingStatus || 'CNF',
        delayed:   !chartPrepared,
        trainName,
        from:      boardingPoint,
        to:        destination,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const recentAlertExists = async (
  pattern: RegExp,
  category: string,
  windowHours = 24
): Promise<boolean> => {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const existing = await Alert.findOne({
    message:    { $regex: pattern },
    category,
    isResolved: false,
    createdAt:  { $gte: since },
  });
  return !!existing;
};

export const getAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query: Record<string, unknown> = {
      isResolved: req.query.resolved === 'true',
    };
    if (req.query.severity) query.severity = req.query.severity;
    if (req.query.category) query.category = req.query.category;

    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(req.query.limit as string) || 50);

    sendSuccess(res, {
      alerts,
      summary: {
        total:    alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning:  alerts.filter(a => a.severity === 'warning').length,
        info:     alerts.filter(a => a.severity === 'info').length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const alert = await Alert.create(req.body);
    sendSuccess(res, { alert }, 'Alert created', 201);
  } catch (error) {
    next(error);
  }
};

export const resolveAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isResolved: true, resolvedAt: new Date(), resolvedBy: req.user?.id },
      { new: true }
    );
    if (!alert) { sendError(res, 'Alert not found', 404); return; }
    sendSuccess(res, { alert }, 'Alert resolved');
  } catch (error) {
    next(error);
  }
};

// Main alert checker — runs every 10 minutes
export const checkAndGenerateAlerts = async (): Promise<void> => {
  try {
    logger.info('Running alert checks...');

    // 1. IRCTC PNR Status — check real freight PNRs from approved bookings
    try {
      const approvedFreights = await FreightRequest.find({
        status: { $in: ['approved', 'in-transit'] },
        pnrNumber: { $exists: true, $ne: null },
      }).limit(3);

      for (const freight of approvedFreights) {
        const pnr = (freight as any).pnrNumber;
        if (!pnr) continue;

        const pnrStatus = await checkPNRStatus(pnr);
        if (pnrStatus && pnrStatus.delayed) {
          const pattern = new RegExp(`PNR ${pnr}`);
          const exists  = await recentAlertExists(pattern, 'delay', 6);
          if (!exists) {
            await Alert.create({
              message:  `PNR ${pnr} (${pnrStatus.trainName}) — chart not prepared. Route: ${pnrStatus.from} → ${pnrStatus.to}. Possible departure delay. (IRCTC API)`,
              severity: 'warning',
              category: 'delay',
            });
            logger.info(`Created PNR delay alert for ${pnr}`);
          }
        }
      }
    } catch (err) {
      logger.warn('IRCTC PNR check failed — skipping:', err);
    }

    // 2. Wagon shortage from real DB
    const available = await Wagon.countDocuments({ status: 'available' });
    const total     = await Wagon.countDocuments();
    if (available < Math.ceil(total * 0.15)) {
      const exists = await recentAlertExists(/wagon.*available/, 'wagon', 24);
      if (!exists) {
        await Alert.create({
          message:  `Critical wagon shortage: only ${available}/${total} wagons available for allocation`,
          severity: available === 0 ? 'critical' : 'warning',
          category: 'wagon',
        });
      }
    }

    // 3. Route delays from DB
    const delayedRoutes = await Route.find({ delayMinutes: { $gt: 30 } });
    for (const route of delayedRoutes) {
      const pattern = new RegExp(`${route.source}.*${route.destination}`);
      const exists  = await recentAlertExists(pattern, 'route', 6);
      if (!exists) {
        await Alert.create({
          message:         `Route delay: ${route.source} → ${route.destination}. Delay: ${route.delayMinutes} minutes.`,
          severity:        route.delayMinutes > 60 ? 'critical' : 'warning',
          category:        'route',
          relatedEntity:   'Route',
          relatedEntityId: route._id,
        });
      }
    }

    // 4. Pending freight backlog
    const oneHourAgo   = new Date(Date.now() - 60 * 60 * 1000);
    const stalePending = await FreightRequest.countDocuments({
      status:    'pending',
      createdAt: { $lte: oneHourAgo },
    });
    if (stalePending > 5) {
      const exists = await recentAlertExists(/freight requests.*pending/, 'demand', 12);
      if (!exists) {
        await Alert.create({
          message:  `${stalePending} freight requests pending for over 1 hour without operator review`,
          severity: 'warning',
          category: 'demand',
        });
      }
    }

    // 5. Maintenance overdue
    const overdueWagons = await Wagon.find({
      nextMaintenanceDue: { $lte: new Date() },
      status: { $ne: 'maintenance' },
    }).limit(3);
    for (const wagon of overdueWagons) {
      const pattern = new RegExp(`${wagon.wagonNumber}.*maintenance`);
      const exists  = await recentAlertExists(pattern, 'maintenance', 24);
      if (!exists) {
        await Alert.create({
          message:         `Wagon ${wagon.wagonNumber} maintenance overdue. Location: ${wagon.currentLocation}`,
          severity:        'warning',
          category:        'maintenance',
          relatedEntity:   'Wagon',
          relatedEntityId: wagon._id,
        });
      }
    }

    logger.info('Alert checks complete');
  } catch (error) {
    logger.error('Alert generation error:', error);
  }
};