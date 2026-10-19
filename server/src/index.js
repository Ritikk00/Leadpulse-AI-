import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import Lead from './models/Lead.js';
import User from './models/User.js';

app.locals.databaseInitialized = false;
const server = app.listen(env.PORT, () => console.log(`[server] API ready at http://127.0.0.1:${env.PORT}`));

async function connectToDatabase() {
  while (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    } catch (error) {
      console.error(`[server:error] MongoDB connection failed: ${error.message}. Retrying in 5 seconds.`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

await connectToDatabase();

try {
  const legacyStatuses = { New: 'NEW', Contacted: 'CONTACTED', Qualified: 'QUALIFIED', Proposal: 'QUALIFIED', Won: 'CLOSED', Lost: 'LOST' };
  const legacyPriorities = { High: 'HOT', Medium: 'WARM', Low: 'COLD' };
  for (const [legacyValue, currentValue] of Object.entries(legacyStatuses)) {
    await Lead.collection.updateMany({ status: legacyValue }, { $set: { status: currentValue } });
  }
  for (const [legacyValue, currentValue] of Object.entries(legacyPriorities)) {
    await Lead.collection.updateMany({ priority: legacyValue }, { $set: { priority: currentValue } });
  }
  await Lead.collection.updateMany({ budget: { $exists: true } }, [
    { $set: { detectedBudget: { $cond: [{ $and: [{ $ne: ['$budget', null] }, { $ne: ['$budget', ''] }] }, '$budget', { $ifNull: ['$detectedBudget', 'Not Specified'] }] } } },
    { $unset: 'budget' }
  ]);
  const legacyMembers = await User.find({ role: 'member' }).select('_id').lean();
  if (legacyMembers.length) {
    await Lead.updateMany(
      { ownerId: { $in: legacyMembers.map(({ _id }) => _id) }, assignedTo: null },
      [{ $set: { assignedTo: '$ownerId' } }]
    );
    await User.updateMany({ _id: { $in: legacyMembers.map(({ _id }) => _id) } }, { $set: { role: 'employee' } });
  }
  const owner = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id');
  if (owner) await Lead.updateMany({ ownerId: null }, { $set: { ownerId: owner._id } });
  app.locals.databaseInitialized = true;
} catch (error) {
  console.error(`[server:error] Database initialization failed: ${error.message}`);
  server.close(() => process.exit(1));
}