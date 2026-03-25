import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Rake from '../models/Rake';
import Wagon from '../models/Wagon';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const createRake = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    if(await Rake.findOne({rakeNumber:req.body.rakeNumber})){sendError(res,'Rake number already exists',400);return;}
    const rake=await Rake.create(req.body);
    sendSuccess(res,{rake},'Rake created',201);
  } catch(e){next(e);}
};
export const getAllRakes = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const rakes=await Rake.find().populate('wagons','wagonNumber wagonType status capacity currentLocation').populate('route','source destination estimatedTime status').sort({createdAt:-1});
    sendSuccess(res,{rakes,total:rakes.length});
  } catch(e){next(e);}
};
export const assignWagonsToRake = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const {rakeId,wagonIds}=req.body;
    const rake=await Rake.findById(rakeId); if(!rake){sendError(res,'Rake not found',404);return;}
    const wagons=await Wagon.find({_id:{$in:wagonIds},status:'available'});
    if(wagons.length!==wagonIds.length){sendError(res,'Some wagons are not available',400);return;}
    await Wagon.updateMany({_id:{$in:wagonIds}},{status:'assigned',assignedRake:rake._id});
    rake.wagons=[...rake.wagons,...wagonIds]; rake.totalCapacity=wagons.reduce((s,w)=>s+w.capacity,rake.totalCapacity); rake.status='active';
    await rake.save();
    const updated=await Rake.findById(rakeId).populate('wagons','wagonNumber wagonType status capacity');
    sendSuccess(res,{rake:updated},`${wagons.length} wagon(s) assigned`);
  } catch(e){next(e);}
};
