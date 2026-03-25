import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/apiResponse';
export const register = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const {name,email,password,role}=req.body;
    if(await User.findOne({email})){sendError(res,'Email already registered.',400);return;}
    const user=await User.create({name,email,password,role});
    sendSuccess(res,{token:generateToken(user),user:{id:user._id,name:user.name,email:user.email,role:user.role}},'Registration successful',201);
  } catch(e){next(e);}
};
export const login = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const errors=validationResult(req); if(!errors.isEmpty()){sendError(res,'Validation failed',400,errors.array());return;}
    const {email,password}=req.body;
    const user=await User.findOne({email}).select('+password');
    if(!user||!(await user.comparePassword(password))){sendError(res,'Invalid email or password.',401);return;}
    sendSuccess(res,{token:generateToken(user),user:{id:user._id,name:user.name,email:user.email,role:user.role}},'Login successful');
  } catch(e){next(e);}
};
export const getMe = async (req:Request, res:Response, next:NextFunction): Promise<void> => {
  try {
    const user=await User.findById(req.user?.id);
    if(!user){sendError(res,'User not found',404);return;}
    sendSuccess(res,{user:{id:user._id,name:user.name,email:user.email,role:user.role}});
  } catch(e){next(e);}
};
