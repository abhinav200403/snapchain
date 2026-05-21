import 'express-async-errors'; // Must be first — patches Express to catch async errors
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import supplierRoutes from './routes/suppliers';
import inventoryRoutes from './routes/inventory';
import orderRoutes from './routes/orders';
import shipmentRoutes from './routes/shipments';
import analyticsRoutes from './routes/analytics';
import predictionsRoutes from './routes/predictions';
import auditRoutes from './routes/auditLog';
import companyRoutes from './routes/company';
import invoicesRoutes from './routes/invoices';
import attachmentsRoutes from './routes/attachments';
import slaRoutes from './routes/sla';
import approvalRulesRoutes from './routes/approvalRules';
import { errorHandler } from './middleware/errorHandler';
import { runMigrations } from './config/migrate';
import { initSocket } from './socket';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Security & logging
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// CORS — allow any localhost port in development
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing — increased limit for base64 uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/attachments', attachmentsRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/approval-rules', approvalRulesRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Initialize Socket.IO
initSocket(httpServer);

runMigrations().catch(err => console.error('Migration error:', err.message));

httpServer.listen(PORT, () => {
  console.log(`SynapChain API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

export default app;
