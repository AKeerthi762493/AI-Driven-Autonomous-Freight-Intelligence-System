/**
 * Run once to clean up duplicate alerts in your database
 * Usage: cd afis-backend && npx ts-node src/utils/clearDuplicateAlerts.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Alert from '../models/Alert';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/afis_db';

const cleanup = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Find all unresolved alerts
  const allAlerts = await Alert.find({ isResolved: false }).sort({ createdAt: 1 });

  const seen = new Map<string, string>(); // message prefix → first _id
  const toDelete: string[] = [];

  for (const alert of allAlerts) {
    const key = alert.message.slice(0, 60) + alert.category;
    if (seen.has(key)) {
      toDelete.push((alert._id as any).toString());
    } else {
      seen.set(key, (alert._id as any).toString());
    }
  }

  if (toDelete.length > 0) {
    await Alert.deleteMany({ _id: { $in: toDelete } });
    console.log(`✅ Deleted ${toDelete.length} duplicate alerts`);
  } else {
    console.log('✅ No duplicate alerts found');
  }

  await mongoose.disconnect();
  process.exit(0);
};

cleanup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});