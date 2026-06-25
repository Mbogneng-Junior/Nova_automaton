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

async function generateWithMistral({ model, prompt, temperature = 0.7, max_tokens = 1024 }) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'mistral-medium-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Mistral error');
  return data.choices[0].message.content;
}

const aiProviders = {
  openai: generateWithOpenAI,
  anthropic: generateWithAnthropic,
  deepseek: generateWithDeepSeek,
  mistral: generateWithMistral
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
    res.json({ status: 'stored', project_id: req.params.id, projectId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/jobs/ffmpeg', async (req, res) => {
  try {
    const job = await ffmpegQueue.add('render', req.body, { attempts: 3, backoff: 5000 });
    res.json({ id: job.id, status: 'queued', schema: req.body.schema || 'public', projectId: req.body.project_id });
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

// Orchestration endpoint: AI generate + store project + queue render in one call
app.post('/workflow/music-ai', async (req, res) => {
  try {
    const { title, genre, mood, provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'provider is required' });
    }

    // 1. Create metadata
    const projectId = 'track_' + Date.now();
    const selectedProvider = provider.toLowerCase();
    const metadata = {
      project_id: projectId,
      provider: selectedProvider,
      title: title || 'Untitled Track',
      genre: genre || 'electronic',
      mood: mood || 'epic',
      concept: {},
      assets: {},
      timestamps: [],
      uploads: {
        youtube: false,
        tiktok: false,
        instagram: false
      },
      analytics: {},
      created_at: new Date().toISOString()
    };

    // 2. Generate prompt
    const prompt = `You are a music marketing expert. Create a detailed concept for a ${metadata.genre} track titled "${metadata.title}" with a ${metadata.mood} mood.\n\nReturn ONLY a JSON object with these keys:\nsuno_prompt: a detailed prompt for Suno AI to generate the track\nleonardo_prompt: a prompt for Leonardo AI to generate cover art\nyoutube_title: title for YouTube\nyoutube_description: description for YouTube (include hashtags)\ntiktok_caption: caption for TikTok (include hashtags)\ninstagram_caption: caption for Instagram (include hashtags)\nhook: the main viral hook of the song (1 sentence)\n`;

    // 3. Call AI
    const model = selectedProvider === 'openai' ? 'gpt-4o-mini' : selectedProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : selectedProvider === 'mistral' ? 'mistral-medium-latest' : 'deepseek-chat';
    const generate = aiProviders[selectedProvider];
    if (!generate) {
      return res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });
    }
    const aiText = await generate({ model, prompt, temperature: 0.8, max_tokens: 1024 });

    // 4. Parse concept
    let concept = {};
    try {
      concept = JSON.parse(aiText);
    } catch (e) {
      concept = { raw: aiText };
    }
    metadata.concept = concept;
    metadata.concept.provider = selectedProvider;

    // 5. Store project
    const dir = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'metadata.json');
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf8');

    // 6. Queue FFmpeg
    await ffmpegQueue.add('render', {
      project_id: projectId,
      task: 'render_long',
      schema: 'music_ai',
      cover_path: 'assets/cover.png',
      audio_path: 'assets/audio.mp3',
      output_path: 'outputs/video_long.mp4'
    }, { attempts: 3, backoff: 5000 });

    res.json({ projectId, status: 'queued', provider: selectedProvider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate concept only (interactive agent step 1)
app.post('/ai/generate-concept', async (req, res) => {
  try {
    const { title, genre, mood, provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'provider is required' });
    }

    const projectId = 'track_' + Date.now();
    const selectedProvider = provider.toLowerCase();
    const metadata = {
      project_id: projectId,
      provider: selectedProvider,
      title: title || 'Untitled Track',
      genre: genre || 'electronic',
      mood: mood || 'epic',
      concept: {},
      assets: {},
      timestamps: [],
      uploads: { youtube: false, tiktok: false, instagram: false },
      analytics: {},
      created_at: new Date().toISOString()
    };

    const prompt = `You are a music marketing expert. Create a detailed concept for a ${metadata.genre} track titled "${metadata.title}" with a ${metadata.mood} mood.\n\nReturn ONLY a JSON object with these keys:\nsuno_prompt: a detailed prompt for Suno AI to generate the track\nleonardo_prompt: a prompt for Leonardo AI to generate cover art\nyoutube_title: title for YouTube\nyoutube_description: description for YouTube (include hashtags)\ntiktok_caption: caption for TikTok (include hashtags)\ninstagram_caption: caption for Instagram (include hashtags)\nhook: the main viral hook of the song (1 sentence)\n`;

    const model = selectedProvider === 'openai' ? 'gpt-4o-mini' : selectedProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : selectedProvider === 'mistral' ? 'mistral-medium-latest' : 'deepseek-chat';
    const generate = aiProviders[selectedProvider];
    if (!generate) {
      return res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });
    }
    const aiText = await generate({ model, prompt, temperature: 0.8, max_tokens: 1024 });

    let concept = {};
    try {
      concept = JSON.parse(aiText);
    } catch (e) {
      concept = { raw: aiText };
    }
    metadata.concept = concept;
    metadata.concept.provider = selectedProvider;

    const dir = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    res.json({ projectId, status: 'concept_generated', concept, metadata });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get project status and assets
app.get('/projects/:id/status', async (req, res) => {
  try {
    const projectId = req.params.id;
    const dir = path.join(PROJECTS_DIR, projectId);
    const metaPath = path.join(dir, 'metadata.json');

    let metadata = {};
    try {
      metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch (e) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const assetsDir = path.join(dir, 'assets');
    const outputsDir = path.join(dir, 'outputs');
    const audioPath = path.join(assetsDir, 'audio.mp3');
    const coverPath = path.join(assetsDir, 'cover.png');
    const videoPath = path.join(outputsDir, 'video_long.mp4');

    let audioExists = false, coverExists = false, videoExists = false;
    try {
      await fs.access(audioPath);
      audioExists = true;
    } catch (e) {}
    try {
      await fs.access(coverPath);
      coverExists = true;
    } catch (e) {}
    try {
      await fs.access(videoPath);
      videoExists = true;
    } catch (e) {}

    res.json({
      projectId,
      metadata,
      assets: {
        audio: audioExists ? metadata.assets?.audio || 'assets/audio.mp3' : null,
        cover: coverExists ? metadata.assets?.cover || 'assets/cover.png' : null,
        video: videoExists ? 'outputs/video_long.mp4' : null
      },
      ready_for_music: true,
      ready_for_cover: audioExists,
      ready_for_video: audioExists && coverExists
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate music with Suno AI
app.post('/ai/generate-music', async (req, res) => {
  try {
    const { project_id, prompt, model_version = 'V4' } = req.body;
    if (!project_id || !prompt) {
      return res.status(400).json({ error: 'project_id and prompt are required' });
    }

    const sunoKey = process.env.SUNO_API_KEY;
    if (!sunoKey) {
      return res.status(500).json({ error: 'SUNO_API_KEY not configured' });
    }

    // 1. Call Suno API
    const genRes = await fetch('https://api.sunoapi.org/api/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sunoKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model_version,
        make_instrumental: false
      })
    });
    const genData = await genRes.json();
    if (!genRes.ok) {
      return res.status(500).json({ error: genData.error || 'Suno generation failed' });
    }

    const taskId = genData.task_id || genData.id;
    if (!taskId) {
      return res.status(500).json({ error: 'No task_id returned from Suno', raw: genData });
    }

    // 2. Poll for completion (max 120s)
    let musicUrl = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusRes = await fetch(`https://api.sunoapi.org/api/v1/status/${taskId}`, {
        headers: { 'Authorization': `Bearer ${sunoKey}` }
      });
      const statusData = await statusRes.json();
      if (statusData.status === 'completed' || statusData.status === 'done') {
        musicUrl = statusData.audio_url || statusData.url || statusData.download_url;
        if (musicUrl) break;
      }
      if (statusData.status === 'failed' || statusData.status === 'error') {
        return res.status(500).json({ error: 'Suno generation failed', details: statusData });
      }
    }

    if (!musicUrl) {
      return res.status(500).json({ error: 'Suno generation timeout', task_id: taskId });
    }

    // 3. Download MP3
    const dir = path.join(PROJECTS_DIR, project_id, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const audioPath = path.join(dir, 'audio.mp3');

    const audioRes = await fetch(musicUrl);
    if (!audioRes.ok) throw new Error('Failed to download audio');
    const buffer = await audioRes.arrayBuffer();
    await fs.writeFile(audioPath, Buffer.from(buffer));

    // 4. Update metadata
    const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
    let metadata = {};
    try {
      metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch (e) {}
    metadata.assets = metadata.assets || {};
    metadata.assets.audio = 'assets/audio.mp3';
    metadata.assets.audio_url = musicUrl;
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    res.json({ status: 'completed', path: 'assets/audio.mp3', task_id: taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate cover art with Leonardo AI
app.post('/ai/generate-cover', async (req, res) => {
  try {
    const { project_id, prompt, width = 1024, height = 1024 } = req.body;
    if (!project_id || !prompt) {
      return res.status(400).json({ error: 'project_id and prompt are required' });
    }

    const leoKey = process.env.LEONARDO_API_KEY;
    if (!leoKey) {
      return res.status(500).json({ error: 'LEONARDO_API_KEY not configured' });
    }

    // 1. Call Leonardo API
    const genRes = await fetch('https://cloud.leonardo.ai/api/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${leoKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        modelId: '6b645e2f-82f2-4b66-8f5e-c52983bda5e4',
        width,
        height,
        num_images: 1
      })
    });
    const genData = await genRes.json();
    if (!genRes.ok) {
      return res.status(500).json({ error: genData.error || 'Leonardo generation failed' });
    }

    const generationId = genData.sdGenerationJob?.generationId;
    if (!generationId) {
      return res.status(500).json({ error: 'No generationId returned from Leonardo', raw: genData });
    }

    // 2. Poll for completion (max 60s)
    let imageUrl = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusRes = await fetch(`https://cloud.leonardo.ai/api/v1/generations/${generationId}`, {
        headers: { 'Authorization': `Bearer ${leoKey}` }
      });
      const statusData = await statusRes.json();
      const generations = statusData.generations_by_pk;
      if (generations && generations.status === 'COMPLETE' && generations.generated_images?.length > 0) {
        imageUrl = generations.generated_images[0].url;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'Leonardo generation timeout', generation_id: generationId });
    }

    // 3. Download image
    const dir = path.join(PROJECTS_DIR, project_id, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const coverPath = path.join(dir, 'cover.png');

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error('Failed to download image');
    const buffer = await imgRes.arrayBuffer();
    await fs.writeFile(coverPath, Buffer.from(buffer));

    // 4. Update metadata
    const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
    let metadata = {};
    try {
      metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch (e) {}
    metadata.assets = metadata.assets || {};
    metadata.assets.cover = 'assets/cover.png';
    metadata.assets.cover_url = imageUrl;
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    res.json({ status: 'completed', path: 'assets/cover.png', generation_id: generationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Automaton API running on port ${PORT}`);
});
