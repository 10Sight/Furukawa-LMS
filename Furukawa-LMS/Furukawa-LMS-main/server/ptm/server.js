import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/database.js';
import authRoutes from './routes/authRoutes.js';
import ptmRoutes from './routes/ptmRoutes.js';
import sheetRoutes from './routes/sheetRoutes.js';
import apqpRoutes from './routes/apqpRoutes.js';

// Initialize SQLite database & tables
initDatabase();

export const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/ptm', ptmRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/apqp', apqpRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PTM Dashboard Backend API', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

// If started directly, listen on port
if (process.argv[1]?.replace(/\\/g, '/').endsWith('server/server.js')) {
  app.listen(PORT, () => {
    console.log(`[PTM Backend] SQLite Server listening on http://localhost:${PORT}`);
  });
}

export default app;

