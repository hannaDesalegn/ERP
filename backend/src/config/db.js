import mongoose from 'mongoose';

// A backend with no database isn't degraded, it's broken. Exit rather than
// listen and serve requests that will all 500.
export async function connectDb(uri) {
  if (!uri) {
    console.error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected.');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // A drop after the initial connect is logged, not fatal — Mongoose reconnects.
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });
}
