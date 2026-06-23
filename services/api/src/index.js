require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const ffmpegQueue = new Queue('ffmpeg', { connection: redisConnection });
const uploadQueue = new Queue('upload', { connection: redisConnection });
const analyticsQueue = new Queue('analytics', { connection: redisConnection });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/jobs/ffmpeg', async (req, res) => {
  try {
    const job = await ffmpegQueue.add('render', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/upload', async (req, res) => {
  try {
    const job = await uploadQueue.add('upload', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/analytics', async (req, res) => {
  try {
    const job = await analyticsQueue.add('collect', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Automaton API running on port ${PORT}`);
});
