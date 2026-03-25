import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import FreightRequest from '../models/FreightRequest';
import Alert from '../models/Alert';
import Wagon from '../models/Wagon';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const bookFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const {commodityType,sourceStation,destinationStation,quantity,unit}=req.body;
    const avail=await Wagon.countDocuments({status:'available'});
    if(avail===0){await Alert.create({message:`No wagons available for booking from ${sourceStation} to ${destinationStation}`,severity:'critical',category:'wagon'});}
    const freight=await FreightRequest.create({userId:req.user?.id,commodityType,sourceStation,destinationStation,quantity,unit:unit||'tonnes',trackingEvents:[{event:'Booking created',timestamp:new Date(),location:sourceStation}]});
    sendSuccess(res,{freight},'Freight booking submitted',201);
  } catch(e){next(e);}
};
export const getMyRequests = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const page=parseInt(req.query.page as string)||1, limit=parseInt(req.query.limit as string)||10, skip=(page-1)*limit;
    const [requests,total]=await Promise.all([FreightRequest.find({userId:req.user?.id}).populate('assignedRake','rakeNumber status currentLocation').populate('assignedRoute','source destination estimatedTime').sort({createdAt:-1}).skip(skip).limit(limit),FreightRequest.countDocuments({userId:req.user?.id})]);
    sendSuccess(res,{requests,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(e){next(e);}
};
export const trackFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const freight=await FreightRequest.findById(req.params.id).populate('assignedRake','rakeNumber status currentLocation').populate('assignedRoute','source destination optimizedPath estimatedTime').populate('userId','name email');
    if(!freight){sendError(res,'Freight request not found',404);return;}
    if(req.user?.role==='industry'&&freight.userId.toString()!==req.user?.id){sendError(res,'Unauthorized',403);return;}
    sendSuccess(res,{freight});
  } catch(e){next(e);}
};
export const getAllFreightRequests = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const page=parseInt(req.query.page as string)||1, limit=parseInt(req.query.limit as string)||20, skip=(page-1)*limit;
    const query: Record<string,unknown>={};
    if(req.query.status)query.status=req.query.status;
    const [requests,total]=await Promise.all([FreightRequest.find(query).populate('userId','name email').populate('assignedRake','rakeNumber').sort({createdAt:-1}).skip(skip).limit(limit),FreightRequest.countDocuments(query)]);
    sendSuccess(res,{requests,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(e){next(e);}
};
export const approveFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const freight=await FreightRequest.findById(req.params.id);
    if(!freight){sendError(res,'Not found',404);return;}
    if(freight.status!=='pending'){sendError(res,`Cannot approve status: ${freight.status}`,400);return;}
    freight.status='approved'; freight.operatorNotes=req.body.operatorNotes;
    if(req.body.estimatedDelivery)freight.estimatedDelivery=new Date(req.body.estimatedDelivery);
    freight.trackingEvents.push({event:'Approved by operator',timestamp:new Date(),location:freight.sourceStation});
    await freight.save();
    sendSuccess(res,{freight},'Approved successfully');
  } catch(e){next(e);}
};
export const rejectFreight = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const freight=await FreightRequest.findById(req.params.id);
    if(!freight){sendError(res,'Not found',404);return;}
    if(freight.status!=='pending'){sendError(res,`Cannot reject status: ${freight.status}`,400);return;}
    freight.status='rejected'; freight.operatorNotes=req.body.operatorNotes||'Rejected by operator';
    freight.trackingEvents.push({event:'Rejected by operator',timestamp:new Date()});
    await freight.save();
    sendSuccess(res,{freight},'Rejected');
  } catch(e){next(e);}
};
