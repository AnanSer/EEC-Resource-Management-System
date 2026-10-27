import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Configure development CORS with credentials support
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in development
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'EEC-RMS-Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root informational endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Ethiopian Engineering Corporation (EEC) Resource Management System API',
    healthCheck: '/api/health',
    version: '1.0.0',
  });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`[EEC-RMS] Backend server running on port ${PORT}`);
  console.log(`[EEC-RMS] Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`[EEC-RMS] Trusted Frontend origin: ${FRONTEND_URL}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[EEC-RMS] Gracefully shutting down backend server...');
  server.close(() => {
    console.log('[EEC-RMS] Backend server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
