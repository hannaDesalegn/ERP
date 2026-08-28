import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();

app.disable('x-powered-by');

// Exact origin, never "*" — see security-notes.md §4. Credentials stay on even
// though the token is a Bearer header today (backend-plan.md §4 puts refresh
// cookies out of scope), so the contract's cookie flow works if it ever lands.
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Temporary — confirms the server is up before any real routes exist.
app.get('/api/health', (req, res) => {
  res.json({ data: { ok: true } });
});

// Routes mount above this line.
app.use(notFoundHandler);
app.use(errorHandler); // must stay last

export default app;
