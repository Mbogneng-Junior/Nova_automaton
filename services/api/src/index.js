require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://postgres:postgres@postgres:5432/automaton';

const redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const pgPool = new Pool({ connectionString: POSTGRES_URL });

const ffmpegQueue = new Queue('ffmpeg', { connection: redisConnection });
const uploadQueue = new Queue('upload', { connection: redisConnection });
const analyticsQueue = new Queue('analytics', { connection: redisConnection });

async function withSchema(schema, callback) {
  const client = await pgPool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);
    return await callback(client);
  } finally {
    client.release();
  }
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', async (req, res) => {
  try {
    const pgResult = await pgPool.query('SELECT current_database(), current_schema()');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: pgResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/schemas/:schema/health', async (req, res) => {
  try {
    const result = await withSchema(req.params.schema, (client) =>
      client.query('SELECT current_schema()')
    );
    res.json({ status: 'ok', schema: result.rows[0].current_schema });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.post('/jobs/ffmpeg', async (req, res) => {
  try {
    const job = await ffmpegQueue.add('render', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued', schema: req.body.schema || 'public' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/upload', async (req, res) => {
  try {
    const job = await uploadQueue.add('upload', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued', schema: req.body.schema || 'public' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/analytics', async (req, res) => {
  try {
    const job = await analyticsQueue.add('collect', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued', schema: req.body.schema || 'public' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example: store analytics event in a workflow schema
app.post('/analytics/:schema/events', async (req, res) => {
  try {
    const { schema } = req.params;
    const { project_id, event_type, payload } = req.body;
    await withSchema(schema, (client) =>
      client.query(
        'INSERT INTO analytics_events (project_id, event_type, payload, created_at) VALUES ($1, $2, $3, NOW())',
        [project_id, event_type, JSON.stringify(payload)]
      )
    );
    res.json({ status: 'stored', schema });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Automaton API running on port ${PORT}`);
});
