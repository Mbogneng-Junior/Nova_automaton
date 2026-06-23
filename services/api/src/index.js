require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
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
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/app/projects';

const redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const pgPool = new Pool({ connectionString: POSTGRES_URL });

const ffmpegQueue = new Queue('ffmpeg', { connection: redisConnection });
const uploadQueue = new Queue('upload', { connection: redisConnection });
const analyticsQueue = new Queue('analytics', { connection: redisConnection });

async function generateWithOpenAI({ model, prompt, temperature = 0.7, max_tokens = 1024 }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'OpenAI error');
  return data.choices[0].message.content;
}

async function generateWithAnthropic({ model, prompt, temperature = 0.7, max_tokens = 1024 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens,
      temperature,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Anthropic error');
  return data.content[0].text;
}

async function generateWithDeepSeek({ model, prompt, temperature = 0.7, max_tokens = 1024 }) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'DeepSeek error');
  return data.choices[0].message.content;
}

const aiProviders = {
  openai: generateWithOpenAI,
  anthropic: generateWithAnthropic,
  deepseek: generateWithDeepSeek
};

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

app.post('/ai/generate', async (req, res) => {
  try {
    const { provider, prompt, model, temperature, max_tokens } = req.body;
    if (!provider || !prompt) {
      return res.status(400).json({ error: 'provider and prompt are required' });
    }
    const generate = aiProviders[provider.toLowerCase()];
    if (!generate) {
      return res.status(400).json({ error: `Unknown provider: ${provider}. Supported: ${Object.keys(aiProviders).join(', ')}` });
    }
    const text = await generate({ model, prompt, temperature, max_tokens });
    res.json({ provider, prompt, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/projects/:id', async (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, req.params.id, 'metadata.json');
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Project not found' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/projects/:id', async (req, res) => {
  try {
    const dir = path.join(PROJECTS_DIR, req.params.id);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'metadata.json');
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ status: 'stored', project_id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
