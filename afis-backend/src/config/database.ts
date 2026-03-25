import mongoose from 'mongoose';
import logger from '../utils/logger';
const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/afis_db';
    const conn = await mongoose.connect(mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err}`));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};
export default connectDB;
