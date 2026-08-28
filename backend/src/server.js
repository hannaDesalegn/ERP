import 'dotenv/config'; // must be first — app.js reads CORS_ORIGIN when it loads
import app from './app.js';
import { connectDb } from './config/db.js';

// Checked at boot rather than on the first login, where a missing secret would
// surface as a confusing token error.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const PORT = process.env.PORT || 8000;

// Database first — if Mongo is unreachable we exit instead of listening.
await connectDb(process.env.MONGO_URI);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
