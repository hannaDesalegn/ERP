import customerRoutes from './routes/customers.js';
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import roleRoutes from './routes/roles.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/users.js';
import orderRoutes from './routes/orders.js';
import invoiceRoutes from './routes/invoices.js';

// C's routes — products, suppliers, purchase orders.
import productRoutes from './routes/products.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import supplierRoutes from './routes/suppliers.js';

// Added by C ahead of the external security review. See each file for why, and
// for the limits of what they do.
import { auditLog } from './middleware/auditLog.js';
import { loginRateLimit } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import auditRoutes from './routes/audit.js';

const app = express();

app.disable('x-powered-by');

// Render terminates TLS in front of us, so without this every request appears
// to come from the proxy: req.ip would be one address for the whole internet
// and req.secure would always be false. One hop, not `true`, which would let a
// client spoof its own address through X-Forwarded-For.
app.set('trust proxy', 1);

app.use(securityHeaders);

// Exact origin, never "*" — see security-notes.md §4. Credentials stay on even
// though the token is a Bearer header today (backend-plan.md §4 puts refresh
// cookies out of scope), so the contract's cookie flow works if it ever lands.
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Temporary — confirms the server is up before any real routes exist.
app.get('/api/health', (req, res) => {
  res.json({ data: { ok: true } });
});

// Throttles sign-in attempts by address and by account. Mounted on the path
// rather than inside routes/auth.js so that file is untouched; it must sit
// after express.json(), because it reads the email from the parsed body.
app.use('/api/auth/login', loginRateLimit);

// Records every state-changing request once its response is sent. Mounted in
// front of the routers rather than called inside each handler, so a route added
// later is covered without anyone remembering to add a line. See the file for
// what this approach cannot capture.
app.use(auditLog);

app.use('/api/audit-logs', auditRoutes);

app.use('/api/invoices', invoiceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers',customerRoutes);

// C — Operations.
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Routes mount above this line.
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler); // must stay last

export default app;
