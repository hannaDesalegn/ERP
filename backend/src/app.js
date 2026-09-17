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

// Operations routes — products, suppliers, purchase orders.
import productRoutes from './routes/products.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import supplierRoutes from './routes/suppliers.js';

// Security middleware. See each file for why, and for the limits of what
// they do.
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
// though authentication is a Bearer header and no cookie is set today, so a
// cookie-based flow would work if one is ever added.
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Liveness check — confirms the server is up.
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

// Operations.
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
