import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import axios from 'axios';
import Wagon from '../models/Wagon';
import Alert from '../models/Alert';
import { sendSuccess, sendError } from '../utils/apiResponse';

// ─── Fetch live train position from IRCTC RapidAPI ───────────────────────────
async function fetchLiveTrainPosition(trainNo: string): Promise<{
  currentStation: string;
  delay: number;
  speed: number;
} | null> {
  const key  = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
  if (!key || !host) return null;

  try {
    const { data } = await axios.get(
      `https://${host}/getLiveTrainStatus`,
      {
        params: { trainNo, startDay: '1' },
        headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
        timeout: 4000,
      }
    );
    const body = data?.body || data?.data || data;
    if (!body) return null;
    return {
      currentStation: body.current_station_name || body.currentStation || 'Unknown',
      delay:          parseInt(body.delay || body.lateBy || '0'),
      speed:          parseFloat(body.speed || '25'),
    };
  } catch {
    return null;
  }
}

// ─── Map wagon number to train number (realistic Indian freight trains) ───────
function getTrainNoForWagon(wagonNumber: string): string {
  const freightTrains = ['58501','58502','58503','58504','58505','58001','58002'];
  const idx = parseInt(wagonNumber.replace(/\D/g, '')) % freightTrains.length;
  return freightTrains[idx] || '58501';
}

// ─── Controllers ─────────────────────────────────────────────────────────────
export const getAllWagons = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query: Record<string, unknown> = {};
    if (req.query.status)   query.status          = req.query.status;
    if (req.query.location) query.currentLocation = new RegExp(req.query.location as string, 'i');

    const wagons = await Wagon.find(query)
      .populate('assignedRake', 'rakeNumber status')
      .sort({ wagonNumber: 1 });

    const [total, available, assigned, maintenance] = await Promise.all([
      Wagon.countDocuments(),
      Wagon.countDocuments({ status: 'available' }),
      Wagon.countDocuments({ status: 'assigned' }),
      Wagon.countDocuments({ status: 'maintenance' }),
    ]);

    // Enrich in-transit wagons with live IRCTC data
    const enrichedWagons = await Promise.all(
      wagons.map(async (w) => {
        const wObj = w.toObject();
        if (w.status === 'in-transit') {
          const trainNo  = getTrainNoForWagon(w.wagonNumber);
          const liveData = await fetchLiveTrainPosition(trainNo);
          return {
            ...wObj,
            liveTracking: liveData
              ? {
                  trainNo,
                  currentStation: liveData.currentStation,
                  delayMinutes:   liveData.delay,
                  speedKmh:       liveData.speed,
                  dataSource:     'IRCTC RapidAPI',
                  fetchedAt:      new Date().toISOString(),
                }
              : {
                  trainNo,
                  dataSource: 'IRCTC unavailable — using MongoDB location',
                  currentStation: w.currentLocation,
                },
          };
        }
        return { ...wObj, liveTracking: null };
      })
    );

    sendSuccess(res, {
      wagons: enrichedWagons,
      summary: {
        total,
        available,
        assigned,
        maintenance,
        inTransit:       total - available - assigned - maintenance,
        liveTrackingOn:  enrichedWagons.filter(w => w.liveTracking?.dataSource === 'IRCTC RapidAPI').length,
      },
      dataSource: 'MongoDB + IRCTC RapidAPI',
    });
  } catch (e) { next(e); }
};

export const createWagon = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendError(res, 'Validation failed', 400, errors.array()); return; }
    const wagon = await Wagon.create(req.body);
    sendSuccess(res, { wagon }, 'Wagon created', 201);
  } catch (e) { next(e); }
};

export const updateWagonLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const wagon = await Wagon.findById(req.params.id);
    if (!wagon) { sendError(res, 'Wagon not found', 404); return; }

    wagon.locationHistory.push({ location: wagon.currentLocation, timestamp: new Date() });
    wagon.currentLocation = req.body.location;
    if (req.body.status) wagon.status = req.body.status;
    await wagon.save();

    if (req.body.status === 'maintenance') {
      await Alert.create({
        message:        `Wagon ${wagon.wagonNumber} moved to maintenance at ${req.body.location}`,
        severity:       'warning',
        category:       'maintenance',
        relatedEntity:  'Wagon',
        relatedEntityId: wagon._id,
      });
    }

    // Get live position for updated wagon if in-transit
    let liveTracking = null;
    if (req.body.status === 'in-transit' || wagon.status === 'in-transit') {
      const trainNo = getTrainNoForWagon(wagon.wagonNumber);
      const live    = await fetchLiveTrainPosition(trainNo);
      if (live) {
        liveTracking = {
          trainNo,
          currentStation: live.currentStation,
          delayMinutes:   live.delay,
          dataSource:     'IRCTC RapidAPI',
        };
      }
    }

    sendSuccess(res, { wagon, liveTracking }, 'Location updated');
  } catch (e) { next(e); }
};