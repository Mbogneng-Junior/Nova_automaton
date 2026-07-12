require('dotenv').config();

const fs = require('fs').promises;
const { createReadStream } = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://postgres:postgres@postgres:5432/automaton';
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/app/projects';
const PROMPTS_DIR = process.env.PROMPTS_DIR || '/app/workflows/_shared/prompts';

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

let _bedrockClient = null;
function getBedrockClient() {
  if (_bedrockClient) return _bedrockClient;
  _bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
  return _bedrockClient;
}

const BEDROCK_MODELS = {
  script:   () => process.env.BEDROCK_SCRIPT_MODEL    || process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-opus-4-6-v1',
  factcheck:() => process.env.BEDROCK_FACTCHECK_MODEL || process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6',
  seo:      () => process.env.BEDROCK_SEO_MODEL       || process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6',
  chat:     () => process.env.BEDROCK_CHAT_MODEL      || process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  default:  () => process.env.BEDROCK_MODEL_ID                          || 'global.anthropic.claude-sonnet-4-6'
};

async function generateWithBedrock({ model, prompt, temperature = 0.7, max_tokens = 1024, task }) {
  const client = getBedrockClient();
  const modelId = model || (task && BEDROCK_MODELS[task] ? BEDROCK_MODELS[task]() : BEDROCK_MODELS.default());

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens,
    temperature,
    messages: [{ role: 'user', content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await client.send(command);
  const raw = await response.body.transformToString();
  const data = JSON.parse(raw);
  return data.content[0].text;
}

const aiProviders = {
  openai: generateWithOpenAI,
  anthropic: generateWithAnthropic,
  deepseek: generateWithDeepSeek,
  mistral: generateWithMistral,
  bedrock: generateWithBedrock
};

// === Generic script generation (multi-profile) ===

function resolveScriptModel(provider) {
  const p = String(provider || '').toLowerCase();
  if (p === 'openai') return 'gpt-4o-mini';
  if (p === 'anthropic') return 'claude-3-5-sonnet-20241022';
  if (p === 'mistral') return 'mistral-medium-latest';
  if (p === 'deepseek') return 'deepseek-chat';
  if (p === 'bedrock') return BEDROCK_MODELS.script();
  return process.env.DEFAULT_SCRIPT_MODEL || 'gpt-4o-mini';
}

async function loadProfilePrompt(profil, promptType = 'redacteur') {
  const safeProfil = String(profil || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const fileName = safeProfil ? `${safeProfil}-${promptType}.md` : `default-${promptType}.md`;
  const filePath = path.join(PROMPTS_DIR, fileName);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    if (safeProfil !== 'default') {
      return loadProfilePrompt('default', promptType);
    }
    throw new Error(`Prompt file not found: ${filePath}`);
  }
}

async function generateScript({ profil, topic, context, provider, model, promptType, max_tokens, temperature, outputFormat }) {
  const selectedProvider = String(provider || process.env.SCRIPT_PROVIDER || 'openai').toLowerCase();
  const generate = aiProviders[selectedProvider];
  if (!generate) throw new Error(`Unknown provider: ${selectedProvider}`);

  const systemPrompt = await loadProfilePrompt(profil, promptType || 'redacteur');
  const safeProfil = String(profil || 'default').toLowerCase();

  let userPrompt = `Profil: ${safeProfil}\n`;
  if (topic) userPrompt += `Sujet / titre: ${topic}\n`;
  if (context) userPrompt += `Contexte: ${context}\n`;
  if (outputFormat) userPrompt += `Format de sortie attendu: ${outputFormat}\n`;
  userPrompt += '\nRédige le script en respectant strictement la structure JSON demandée dans le prompt système.';

  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  const aiText = await generate({
    model: model || resolveScriptModel(selectedProvider),
    prompt: fullPrompt,
    temperature: temperature !== undefined ? Number(temperature) : 0.8,
    max_tokens: max_tokens !== undefined ? Number(max_tokens) : 8192,
    task: 'script'
  });

  let script = {};
  let raw = aiText;
  try {
    // Tentative d'extraction si le LLM a mis du JSON dans du markdown
    const jsonMatch = aiText.match(/```json\s*([\s\S]*?)```/);
    let jsonString;
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    } else {
      const firstBrace = aiText.indexOf('{');
      const lastBrace = aiText.lastIndexOf('}');
      jsonString = (firstBrace !== -1 && lastBrace !== -1) ? aiText.slice(firstBrace, lastBrace + 1) : aiText;
    }
    script = JSON.parse(jsonString.trim());
    raw = aiText;
  } catch (e) {
    script = { parse_error: true, raw: aiText };
  }

  return { provider: selectedProvider, profil: safeProfil, script, raw };
}

// === Cloudinary upload ===

async function uploadToCloudinary(filePath, folder) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const safeFolder = folder || 'automaton';
  const signature_str = `folder=${safeFolder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signature_str).digest('hex');

  const form = new FormData();
  form.append('file', new Blob([await fs.readFile(filePath)]), path.basename(filePath));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', safeFolder);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return { secure_url: data.secure_url, public_id: data.public_id };
}

// === Stock media search (Pexels, Pixabay, Unsplash) ===

async function searchPexels(query, perPage = 5) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY not configured');
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`, {
    headers: { Authorization: key }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Pexels search failed');
  return (data.photos || []).map(p => ({ source: 'pexels', id: String(p.id), url: p.src.original, thumb: p.src.medium, photographer: p.photographer }));
}

async function searchPixabay(query, perPage = 5) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error('PIXABAY_API_KEY not configured');
  const res = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${perPage}&safesearch=true`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Pixabay search failed');
  return (data.hits || []).map(h => ({ source: 'pixabay', id: String(h.id), url: h.largeImageURL, thumb: h.webformatURL, photographer: h.user }));
}

async function searchUnsplash(query, perPage = 5) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY not configured');
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${key}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0] || 'Unsplash search failed');
  return (data.results || []).map(p => ({ source: 'unsplash', id: p.id, url: p.urls.full, thumb: p.urls.small, photographer: p.user.name }));
}

async function searchStockMedia(query, sources, perPage = 5) {
  const enabled = sources || (process.env.STOCK_PROVIDERS_ENABLED || 'pexels,pixabay,unsplash').split(',').map(s => s.trim());
  const fns = { pexels: searchPexels, pixabay: searchPixabay, unsplash: searchUnsplash };
  const results = await Promise.allSettled(
    enabled.filter(s => fns[s]).map(s => fns[s](query, perPage))
  );
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// === ffprobe QA ===

function ffprobeInspect(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', filePath
    ], (err, stdout) => {
      if (err) return reject(new Error('ffprobe failed: ' + err.message));
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error('ffprobe output parse error')); }
    });
  });
}

async function qualityCheck(filePath, profile) {
  const probe = await ffprobeInspect(filePath);
  const fmt = probe.format || {};
  const streams = probe.streams || [];
  const video = streams.find(s => s.codec_type === 'video');
  const audio = streams.find(s => s.codec_type === 'audio');
  const issues = [];

  const durationSec = parseFloat(fmt.duration || 0);
  const profiles = {
    'actu-ia':       { minDur: 60,  maxDur: 360  },
    'dark-psychology': { minDur: 600, maxDur: 1500 },
    'documentaire':  { minDur: 1200, maxDur: 3000 },
    'sport':         { minDur: 60,  maxDur: 700  }
  };
  const bounds = profiles[profile] || { minDur: 10, maxDur: 7200 };
  if (durationSec < bounds.minDur) issues.push(`Durée trop courte: ${durationSec.toFixed(0)}s (min ${bounds.minDur}s)`);
  if (durationSec > bounds.maxDur) issues.push(`Durée trop longue: ${durationSec.toFixed(0)}s (max ${bounds.maxDur}s)`);
  if (!video) issues.push('Aucun flux vidéo détecté');
  if (!audio) issues.push('Aucun flux audio détecté');

  const bitrate = parseInt(fmt.bit_rate || 0);
  if (bitrate > 0 && bitrate < 100000) issues.push(`Bitrate très bas: ${bitrate} bps`);

  return {
    ok: issues.length === 0,
    issues,
    duration_sec: durationSec,
    bitrate_bps: bitrate,
    video: video ? { codec: video.codec_name, width: video.width, height: video.height, fps: video.r_frame_rate } : null,
    audio: audio ? { codec: audio.codec_name, sample_rate: audio.sample_rate, channels: audio.channels } : null
  };
}

// === Image generation providers (provider-agnostic) ===
// Each provider returns { imageUrl, ref }. Download + metadata handled by generateAndStoreImage.

async function generateImageLeonardo({ prompt, width, height }) {
  const leoKey = process.env.LEONARDO_API_KEY;
  if (!leoKey) throw new Error('LEONARDO_API_KEY not configured');
  const genRes = await fetch('https://cloud.leonardo.ai/api/v1/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${leoKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      modelId: process.env.LEONARDO_MODEL_ID || '6b645e2f-82f2-4b66-8f5e-c52983bda5e4',
      width,
      height,
      num_images: 1
    })
  });
  const genData = await genRes.json();
  if (!genRes.ok) throw new Error(genData.error || 'Leonardo generation failed');
  const generationId = genData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error('No generationId returned from Leonardo');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const statusRes = await fetch(`https://cloud.leonardo.ai/api/v1/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${leoKey}` }
    });
    const statusData = await statusRes.json();
    const generations = statusData.generations_by_pk;
    if (generations && generations.status === 'COMPLETE' && generations.generated_images?.length > 0) {
      return { imageUrl: generations.generated_images[0].url, ref: generationId };
    }
  }
  throw new Error('Leonardo generation timeout');
}

async function generateImageOpenAI({ prompt, width, height }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  // DALL-E 3 supports a fixed set of sizes; pick by aspect ratio.
  let size = '1024x1024';
  if (width && height) {
    if (width > height) size = '1792x1024';
    else if (height > width) size = '1024x1792';
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'dall-e-3',
      prompt,
      n: 1,
      size,
      response_format: 'url'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI image generation failed');
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL returned from OpenAI');
  return { imageUrl, ref: null };
}

const imageProviders = {
  leonardo: generateImageLeonardo,
  openai: generateImageOpenAI
};

// Providers activables via .env: IMAGE_PROVIDERS_ENABLED="leonardo,openai" (defaut: tous).
function getEnabledImageProviders() {
  const all = Object.keys(imageProviders);
  const env = process.env.IMAGE_PROVIDERS_ENABLED;
  if (!env) return all;
  const list = env.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const enabled = list.filter(p => all.includes(p));
  return enabled.length ? enabled : all;
}

// Choisit le provider: param d'appel > IMAGE_PROVIDER (.env) > premier activé. Fallback si désactivé.
function resolveImageProvider(requested) {
  const enabled = getEnabledImageProviders();
  const want = (requested || process.env.IMAGE_PROVIDER || enabled[0] || '').toLowerCase();
  if (enabled.includes(want)) return want;
  return enabled[0];
}

async function generateAndStoreImage({ project_id, prompt, width = 1024, height = 1024, provider, output_name = 'cover.png', stock_first = false, cloudinary_upload = false, cloudinary_folder }) {
  let imageUrl, ref, imageSource;

  // Essai stock libre en priorité si demandé
  if (stock_first && prompt) {
    try {
      const stockResults = await searchStockMedia(prompt, null, 1);
      if (stockResults.length > 0) {
        imageUrl = stockResults[0].url;
        ref = stockResults[0].id;
        imageSource = stockResults[0].source;
      }
    } catch (e) { /* fallback vers génération IA */ }
  }

  // Génération IA si pas de résultat stock
  if (!imageUrl) {
    const selected = resolveImageProvider(provider);
    const generate = imageProviders[selected];
    if (!generate) throw new Error(`No image provider available (requested: ${provider || 'default'})`);
    const result = await generate({ prompt, width, height });
    imageUrl = result.imageUrl;
    ref = result.ref;
    imageSource = selected;
  }

  const safeName = String(output_name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = path.join(PROJECTS_DIR, project_id, 'assets');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, safeName);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('Failed to download image');
  const buffer = await imgRes.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(buffer));

  let cloudinaryResult = null;
  if (cloudinary_upload) {
    try {
      cloudinaryResult = await uploadToCloudinary(filePath, cloudinary_folder || `automaton/${project_id}`);
    } catch (e) { console.warn('[cloudinary] upload skipped:', e.message); }
  }

  const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
  let metadata = {};
  try { metadata = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch (e) {}
  metadata.assets = metadata.assets || {};
  const key = safeName.replace(/\.[^.]+$/, '');
  metadata.assets[key] = `assets/${safeName}`;
  metadata.assets[`${key}_url`] = cloudinaryResult?.secure_url || imageUrl;
  metadata.assets[`${key}_provider`] = imageSource;
  if (cloudinaryResult) metadata.assets[`${key}_cloudinary`] = cloudinaryResult.secure_url;
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

  return {
    provider: imageSource,
    path: `assets/${safeName}`,
    image_url: cloudinaryResult?.secure_url || imageUrl,
    origin_url: imageUrl,
    ref,
    cloudinary: cloudinaryResult
  };
}

// === Publishing providers (multi-platform) ===
// Chaque provider publie un fichier et retourne { id, url, raw }. Activation par .env.
// Sécurité: dry_run par défaut (PUBLISH_DRY_RUN), rien ne part en ligne sans désactivation explicite.

function getYouTubeAuthClient() {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error('YouTube OAuth not configured (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN)');
  }
  const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });
  return oauth2Client;
}

function getYouTubeDataApi() {
  return google.youtube({ version: 'v3', auth: getYouTubeAuthClient() });
}

async function publishYouTube({ filePath, title, description, tags, visibility }) {
  const youtube = getYouTubeDataApi();
  const stat = await fs.stat(filePath);
  const res = await youtube.videos.insert({
    part: 'snippet,status',
    notifySubscribers: false,
    requestBody: {
      snippet: {
        title: title || 'Untitled',
        description: description || '',
        tags: tags || []
      },
      status: {
        privacyStatus: visibility || 'private',
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: createReadStream(filePath),
      mimeType: 'video/*'
    }
  }, {
    // Upload progress / retry config
    onUploadProgress: (evt) => {
      const pct = stat.size ? Math.round((evt.bytesRead / stat.size) * 100) : 0;
      console.log(`YouTube upload progress: ${pct}%`);
    }
  });
  const id = res.data.id;
  return {
    id,
    url: `https://youtu.be/${id}`,
    raw: { privacyStatus: res.data.status?.privacyStatus, status: res.data.status }
  };
}

// TikTok Content Posting API v2 — access_token à durée de vie courte (24h), à rafraîchir côté n8n.
async function publishTikTok({ filePath, video_url, title, description, visibility }) {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!accessToken || !clientKey) {
    throw new Error('TikTok not configured (TIKTOK_ACCESS_TOKEN / TIKTOK_CLIENT_KEY)');
  }

  const privacyLevel = (visibility === 'public') ? 'PUBLIC_TO_EVERYONE'
    : (visibility === 'friends') ? 'MUTUAL_FOLLOW_FRIENDS' : 'SELF_ONLY';

  // Préférer une URL publique (Cloudinary/S3) à un upload direct pour éviter les timeouts
  if (video_url) {
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: {
          title: (description || title || '').slice(0, 150),
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false
        },
        source_info: { source: 'PULL_FROM_URL', video_url }
      })
    });
    const initData = await initRes.json();
    if (!initRes.ok || initData.error?.code !== 'ok') {
      throw new Error(initData.error?.message || 'TikTok init failed');
    }
    const publishId = initData.data?.publish_id;
    return { id: publishId, url: `https://www.tiktok.com/`, raw: initData.data };
  }

  // Upload direct (FILE_UPLOAD) si pas d'URL publique
  const stat = await fs.stat(filePath);
  const fileSize = stat.size;
  const chunkSize = 10 * 1024 * 1024; // 10MB chunks
  const totalChunks = Math.ceil(fileSize / chunkSize);

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: (description || title || '').slice(0, 150),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      },
      source_info: { source: 'FILE_UPLOAD', video_size: fileSize, chunk_size: chunkSize, total_chunk_count: totalChunks }
    })
  });
  const initData = await initRes.json();
  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(initData.error?.message || 'TikTok init failed');
  }
  const { upload_url, publish_id } = initData.data;

  const fileBuffer = await fs.readFile(filePath);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    const chunk = fileBuffer.subarray(start, end);
    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
        'Content-Length': String(chunk.length)
      },
      body: chunk
    });
    if (!uploadRes.ok) throw new Error(`TikTok chunk upload failed (chunk ${i})`);
  }

  return { id: publish_id, url: `https://www.tiktok.com/`, raw: initData.data };
}

// Meta (Instagram) Graph API — Reels via container publish (2-step).
async function publishMeta({ video_url, title, description }) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!accessToken || !igAccountId) {
    throw new Error('Meta not configured (META_ACCESS_TOKEN / INSTAGRAM_ACCOUNT_ID)');
  }
  if (!video_url) {
    throw new Error('Meta publish requires video_url (public URL from Cloudinary or S3)');
  }

  const caption = [title, description].filter(Boolean).join('\n').slice(0, 2200);

  // Step 1 — créer le container Reels
  const createRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url,
        caption,
        share_to_feed: true
      })
    }
  );
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) throw new Error(createData.error?.message || 'Meta container creation failed');
  const containerId = createData.id;

  // Attendre que le container soit traité (polling jusqu'à 60s)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    if (statusData.status_code === 'FINISHED') break;
    if (statusData.status_code === 'ERROR') throw new Error('Meta video processing failed');
  }

  // Step 2 — publier le container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId })
    }
  );
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.error) throw new Error(publishData.error?.message || 'Meta publish failed');

  // Step 3 — récupérer le permalink pour avoir une URL utilisable
  let permalink = `https://www.instagram.com/`;
  try {
    const permalinkRes = await fetch(
      `https://graph.facebook.com/v19.0/${publishData.id}?fields=permalink&access_token=${accessToken}`
    );
    const permalinkData = await permalinkRes.json();
    if (permalinkData.permalink) permalink = permalinkData.permalink;
  } catch (e) {
    console.warn('[publishMeta] permalink fetch failed:', e.message);
  }

  return {
    id: publishData.id,
    url: permalink,
    raw: publishData
  };
}

const publishProviders = {
  youtube: publishYouTube,
  tiktok: publishTikTok,
  meta: publishMeta
};

function getEnabledPlatforms() {
  const all = Object.keys(publishProviders);
  const env = process.env.PUBLISH_PLATFORMS_ENABLED;
  if (!env) return all;
  const list = env.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const enabled = list.filter(p => all.includes(p));
  return enabled.length ? enabled : all;
}

async function publishContent({ platform, project_id, file_path, video_url, title, description, tags, visibility, channel_id, dry_run }) {
  const plat = String(platform || '').toLowerCase();
  if (!plat) throw new Error('platform is required');
  if (!publishProviders[plat]) {
    throw new Error(`Unknown platform: ${platform}. Supported: ${Object.keys(publishProviders).join(', ')}`);
  }
  if (!getEnabledPlatforms().includes(plat)) {
    throw new Error(`Platform disabled: ${platform} (voir PUBLISH_PLATFORMS_ENABLED)`);
  }

  const globalDry = (process.env.PUBLISH_DRY_RUN || 'true').toLowerCase() !== 'false';
  const isDry = (dry_run === undefined || dry_run === null) ? globalDry : !!dry_run;

  let result;
  if (isDry) {
    result = {
      dry_run: true,
      platform: plat,
      channel_id: channel_id || null,
      would_publish: { title: title || '', visibility: visibility || 'private', file_path, video_url }
    };
  } else {
    const absPath = file_path
      ? (path.isAbsolute(file_path) ? file_path : path.join(PROJECTS_DIR, project_id || '', file_path))
      : null;
    const r = await publishProviders[plat]({ filePath: absPath, video_url, title, description, tags, visibility });
    result = { dry_run: false, platform: plat, channel_id: channel_id || null, ...r };
  }

  // Met à jour metadata.uploads[platform] (non bloquant)
  if (project_id) {
    try {
      const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
      let metadata = {};
      try { metadata = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch (e) {}
      metadata.uploads = metadata.uploads || {};
      metadata.uploads[plat] = { ...result, at: new Date().toISOString() };
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    } catch (e) { /* ignore */ }
  }

  return result;
}

// Worker asynchrone pour queue:upload — traitement des publications (YouTube/TikTok/Meta).
function startUploadWorker() {
  const worker = new Worker('upload', async (job) => {
    const { platform, project_id, file_path, video_url, title, description, tags, visibility, channel_id, dry_run } = job.data;
    console.log(`[upload worker] job ${job.id} started: ${platform} / ${file_path || video_url}`);
    const result = await publishContent({
      platform, project_id, file_path, video_url, title, description, tags, visibility, channel_id, dry_run
    });
    console.log(`[upload worker] job ${job.id} done: ${result.url || result.would_publish?.title}`);
    return result;
  }, {
    connection: redisConnection,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  });

  worker.on('completed', (job, result) => {
    console.log(`[upload worker] completed job ${job.id}`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`[upload worker] failed job ${job.id}`, err.message);
  });

  return worker;
}

// Worker asynchrone pour queue:analytics — collecte des métriques YouTube ~48h après publication.
function startAnalyticsWorker() {
  const worker = new Worker('analytics', async (job) => {
    const { project_id, video_id, profil } = job.data;
    console.log(`[analytics worker] job ${job.id} started: video_id=${video_id}`);

    const youtube = getYouTubeDataApi();

    // Métriques de base via videos.list
    const videoRes = await youtube.videos.list({
      part: 'statistics,snippet',
      id: video_id
    });
    const videoItem = videoRes.data.items?.[0];
    if (!videoItem) throw new Error(`YouTube video not found: ${video_id}`);
    const stats = videoItem.statistics;

    // Métriques analytiques via youtubeAnalytics.reports (si credentials disponibles)
    let analyticsData = null;
    let avgDuration = null;
    let avgPercentage = null;
    try {
      const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: getYouTubeAuthClient() });
      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];
      const analyticsRes = await youtubeAnalytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views,likes,comments,averageViewDuration,averageViewPercentage',
        filters: `video==${video_id}`
      });
      analyticsData = analyticsRes.data;
      const row = analyticsData.rows?.[0];
      if (row && analyticsData.columnHeaders) {
        // row order matches columnHeaders order
        analyticsData.columnHeaders.forEach((h, i) => {
          if (h.name === 'averageViewDuration') avgDuration = parseFloat(row[i]);
          if (h.name === 'averageViewPercentage') avgPercentage = parseFloat(row[i]);
        });
      }
    } catch (e) {
      console.warn('[analytics worker] youtubeAnalytics skipped:', e.message);
    }

    const result = {
      video_id,
      project_id,
      profil: profil || null,
      platform: 'youtube',
      collected_at: new Date().toISOString(),
      views: parseInt(stats.viewCount || 0),
      likes: parseInt(stats.likeCount || 0),
      comments: parseInt(stats.commentCount || 0),
      favorites: parseInt(stats.favoriteCount || 0),
      avg_view_duration_sec: avgDuration,
      avg_view_percentage: avgPercentage,
      analytics: analyticsData
    };

    // Stocker dans shared.video_analytics
    await pgPool.query(
      `INSERT INTO shared.video_analytics
         (video_id, project_id, profil, platform, views, likes, comments, favorites,
          avg_view_duration_sec, avg_view_percentage, analytics_raw, collected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (video_id) DO UPDATE SET
         views=$5, likes=$6, comments=$7, favorites=$8,
         avg_view_duration_sec=$9, avg_view_percentage=$10,
         analytics_raw=$11, collected_at=$12`,
      [video_id, project_id || null, profil || null, result.platform,
        result.views, result.likes, result.comments, result.favorites,
        result.avg_view_duration_sec, result.avg_view_percentage,
        JSON.stringify(analyticsData), result.collected_at]
    );

    // Mettre à jour metadata.json du projet
    if (project_id) {
      try {
        const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
        let metadata = {};
        try { metadata = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch (e) {}
        metadata.analytics = metadata.analytics || {};
        metadata.analytics.youtube = result;
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
      } catch (e) { /* ignore */ }
    }

    console.log(`[analytics worker] job ${job.id} done: ${result.views} views`);
    return result;
  }, {
    connection: redisConnection,
    concurrency: 3,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 }
  });

  worker.on('failed', (job, err) => {
    console.error(`[analytics worker] failed job ${job.id}`, err.message);
  });

  return worker;
}

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

// Génération de script générique multi-profil.
// Charge un prompt système depuis workflows/_shared/prompts/<profil>-redacteur.md
app.post('/ai/generate-script', async (req, res) => {
  try {
    const { profil, topic, context, provider, model, promptType, max_tokens, temperature, outputFormat, project_id } = req.body;
    if (!profil) {
      return res.status(400).json({ error: 'profil is required' });
    }

    const result = await generateScript({ profil, topic, context, provider, model, promptType, max_tokens, temperature, outputFormat });

    // Stockage optionnel dans metadata.json
    const projectId = project_id || `${profil}_${Date.now()}`;
    const metadata = {
      project_id: projectId,
      profil: result.profil,
      provider: result.provider,
      topic: topic || null,
      context: context || null,
      script: result.script,
      script_raw: result.raw,
      created_at: new Date().toISOString()
    };

    const dir = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    res.json({ project_id: projectId, status: 'script_generated', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Génération de concept music-ai (legacy) — refactoré pour utiliser generateScript.
// Garde le même contrat d'entrée/sortie pour ne pas casser le workflow existant.
app.post('/ai/generate-concept', async (req, res) => {
  try {
    const { title, genre, mood, provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'provider is required' });
    }

    const projectId = 'track_' + Date.now();
    const context = `Genre: ${genre || 'electronic'}, Mood: ${mood || 'epic'}`;
    const result = await generateScript({
      profil: 'music-ai',
      topic: title || 'Untitled Track',
      context,
      provider,
      max_tokens: 1024,
      temperature: 0.8
    });

    const metadata = {
      project_id: projectId,
      provider: result.provider,
      title: title || 'Untitled Track',
      genre: genre || 'electronic',
      mood: mood || 'epic',
      concept: result.script,
      assets: {},
      timestamps: [],
      uploads: { youtube: false, tiktok: false, instagram: false },
      analytics: {},
      created_at: new Date().toISOString()
    };

    const dir = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    res.json({ projectId, status: 'concept_generated', concept: result.script, metadata });
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

// Provider-agnostic image generation (cover, thumbnail, ...). Choix du provider par appel ou via .env.
app.post('/ai/generate-image', async (req, res) => {
  try {
    const { project_id, prompt, width, height, provider, output_name } = req.body;
    if (!project_id || !prompt) {
      return res.status(400).json({ error: 'project_id and prompt are required' });
    }
    const result = await generateAndStoreImage({ project_id, prompt, width, height, provider, output_name });
    res.json({ status: 'completed', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste les fournisseurs d'images supportés et ceux actuellement activés.
app.get('/ai/image-providers', (req, res) => {
  res.json({
    supported: Object.keys(imageProviders),
    enabled: getEnabledImageProviders(),
    default: resolveImageProvider()
  });
});

// Génération de voix via ElevenLabs.
app.post('/ai/generate-speech', async (req, res) => {
  try {
    const { project_id, text, voice_id, model_id, output_name } = req.body;
    if (!project_id || !text) {
      return res.status(400).json({ error: 'project_id and text are required' });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
    }

    const safeVoice = voice_id || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const safeModel = model_id || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    const safeName = (output_name || 'voiceover').replace(/[^a-zA-Z0-9._-]/g, '_');

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${safeVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: safeModel,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      throw new Error('ElevenLabs error: ' + errText);
    }

    const dir = path.join(PROJECTS_DIR, project_id, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, `${safeName}.mp3`);
    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    await fs.writeFile(outPath, buffer);

    const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
    let metadata = {};
    try { metadata = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch (e) {}
    metadata.assets = metadata.assets || {};
    metadata.assets[safeName] = `assets/${safeName}.mp3`;
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    res.json({ status: 'completed', path: `assets/${safeName}.mp3`, voice_id: safeVoice, model_id: safeModel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Génération de sous-titres .srt via OpenAI Whisper.
app.post('/ai/generate-subtitles', async (req, res) => {
  try {
    const { project_id, audio_path, language, output_name } = req.body;
    if (!project_id || !audio_path) {
      return res.status(400).json({ error: 'project_id and audio_path are required' });
    }
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const absAudio = path.isAbsolute(audio_path)
      ? audio_path
      : path.join(PROJECTS_DIR, project_id, audio_path);

    const audioBuffer = await fs.readFile(absAudio);
    const safeName = (output_name || 'subtitles').replace(/[^a-zA-Z0-9._-]/g, '_');

    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), path.basename(absAudio));
    form.append('model', process.env.WHISPER_MODEL || 'whisper-1');
    form.append('response_format', 'srt');
    if (language) form.append('language', language);

    const whRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form
    });

    const srt = await whRes.text();
    if (!whRes.ok) throw new Error('Whisper error: ' + srt);

    const dir = path.join(PROJECTS_DIR, project_id, 'assets');
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, `${safeName}.srt`);
    await fs.writeFile(outPath, srt);

    res.json({ status: 'completed', path: `assets/${safeName}.srt`, language: language || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publication multi-plateforme. dry_run par défaut (voir PUBLISH_DRY_RUN).
// Si async=true, le job est poussé dans queue:upload et traité par le worker upload.
// video_url: URL publique (Cloudinary/S3) — obligatoire pour TikTok et Meta.
app.post('/publish', async (req, res) => {
  try {
    const { platform, project_id, file_path, video_url, title, description, tags, visibility, channel_id, dry_run, async: asyncMode } = req.body;
    if (!platform || (!file_path && !video_url)) {
      return res.status(400).json({ error: 'platform and file_path or video_url are required' });
    }

    const isAsync = asyncMode === true || asyncMode === 'true';
    if (isAsync) {
      const job = await uploadQueue.add('publish', {
        platform, project_id, file_path, video_url, title, description, tags, visibility, channel_id, dry_run
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100
      });
      return res.json({ status: 'queued', job_id: job.id, platform, dry_run: dry_run ?? null });
    }

    const result = await publishContent({ platform, project_id, file_path, video_url, title, description, tags, visibility, channel_id, dry_run });
    res.json({ status: result.dry_run ? 'dry_run' : 'published', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Fact-checking ---
// Vérifie les affirmations d'un script contre ≥2 sources via LLM + recherche web optionnelle.
app.post('/ai/fact-check', async (req, res) => {
  try {
    const { claims, script, profil, provider, model, sources_required = 2 } = req.body;
    if (!claims && !script) {
      return res.status(400).json({ error: 'claims (array) or script (text) is required' });
    }

    const selectedProvider = String(provider || process.env.FACT_CHECK_PROVIDER || 'anthropic').toLowerCase();
    const generate = aiProviders[selectedProvider];
    if (!generate) return res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });

    const claimList = claims || [script];
    const results = [];

    for (const claim of claimList) {
      const prompt = `Tu es un fact-checker rigoureux. Analyse l'affirmation suivante et évalue sa véracité.
Profil de contenu: ${profil || 'général'}
Nombre de sources indépendantes requises: ${sources_required}

Affirmation à vérifier:
"${claim}"

Réponds UNIQUEMENT avec un objet JSON ayant ces clés:
- status: "confirmed" | "unconfirmed" | "false" | "needs_review"
- confidence: nombre entre 0 et 1
- reasoning: explication courte (max 3 phrases)
- sources_needed: liste des types de sources à consulter pour confirmer
- block_publication: true si le statut est "false" ou si le profil est "documentaire" et status != "confirmed"`;

      const aiText = await generate({
        model: model || (selectedProvider === 'bedrock' ? BEDROCK_MODELS.factcheck() : selectedProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o'),
        prompt,
        temperature: 0.1,
        task: 'factcheck',
        max_tokens: 512
      });

      let parsed = {};
      try {
        const m = aiText.match(/```json\s*([\s\S]*?)```/);
        let jsonStr;
        if (m) {
          jsonStr = m[1];
        } else {
          const firstBrace = aiText.indexOf('{');
          const lastBrace = aiText.lastIndexOf('}');
          jsonStr = (firstBrace !== -1 && lastBrace !== -1) ? aiText.slice(firstBrace, lastBrace + 1) : aiText;
        }
        parsed = JSON.parse(jsonStr.trim());
      } catch (e) {
        parsed = { status: 'needs_review', confidence: 0, reasoning: aiText, block_publication: false };
      }
      results.push({ claim, ...parsed });
    }

    const blockPublication = results.some(r => r.block_publication);
    res.json({ status: 'ok', provider: selectedProvider, profil: profil || null, results, block_publication: blockPublication });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SEO ---
// Génère titres, descriptions et tags par plateforme à partir d'un sujet/script.
app.post('/ai/seo', async (req, res) => {
  try {
    const { topic, script, profil, platforms, language, provider, model } = req.body;
    if (!topic && !script) {
      return res.status(400).json({ error: 'topic or script is required' });
    }

    const selectedProvider = String(provider || process.env.SEO_PROVIDER || 'openai').toLowerCase();
    const generate = aiProviders[selectedProvider];
    if (!generate) return res.status(400).json({ error: `Unknown provider: ${selectedProvider}` });

    const targetPlatforms = platforms || ['youtube', 'tiktok', 'instagram'];
    const lang = language || 'fr';
    const content = script ? script.slice(0, 1000) : topic;

    const prompt = `Tu es un expert SEO et marketing de contenu vidéo. Génère des métadonnées optimisées.
Profil de contenu: ${profil || 'général'}
Langue: ${lang}
Plateformes cibles: ${targetPlatforms.join(', ')}

Sujet / extrait de script:
${content}

Réponds UNIQUEMENT avec un objet JSON structuré ainsi:
{
  "titles": ["titre1 (max 100 chars)", "titre2", "titre3"],
  "youtube": {
    "title": "titre YouTube optimisé (max 100 chars)",
    "description": "description YouTube (max 5000 chars, inclure hashtags)",
    "tags": ["tag1", "tag2", ...] (max 500 chars total)
  },
  "tiktok": {
    "caption": "caption TikTok (max 2200 chars, hashtags inclus)"
  },
  "instagram": {
    "caption": "caption Instagram (max 2200 chars, hashtags inclus)"
  },
  "hashtags": ["hashtag1", "hashtag2", ...] (top 10 universels)
}`;

    const aiText = await generate({
      model: model || (selectedProvider === 'bedrock' ? BEDROCK_MODELS.seo() : 'gpt-4o-mini'),
      prompt,
      temperature: 0.7,
      max_tokens: 4096,
      task: 'seo'
    });

    let seo = {};
    try {
      const m = aiText.match(/```json\s*([\s\S]*?)```/);
      if (m) {
        seo = JSON.parse(m[1].trim());
      } else {
        const firstBrace = aiText.indexOf('{');
        const lastBrace = aiText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          seo = JSON.parse(aiText.slice(firstBrace, lastBrace + 1));
        } else {
          seo = JSON.parse(aiText.trim());
        }
      }
    } catch (e) {
      seo = { raw: aiText };
    }

    res.json({ status: 'ok', provider: selectedProvider, profil: profil || null, platforms: targetPlatforms, seo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Contrôle Qualité ---
// Inspecte une vidéo avec ffprobe et retourne un rapport de conformité.
app.post('/ai/quality-check', async (req, res) => {
  try {
    const { project_id, file_path, profil } = req.body;
    if (!project_id || !file_path) {
      return res.status(400).json({ error: 'project_id and file_path are required' });
    }

    const absPath = path.isAbsolute(file_path)
      ? file_path
      : path.join(PROJECTS_DIR, project_id, file_path);

    const report = await qualityCheck(absPath, profil || 'default');

    if (project_id) {
      try {
        const metaPath = path.join(PROJECTS_DIR, project_id, 'metadata.json');
        let metadata = {};
        try { metadata = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch (e) {}
        metadata.quality_check = { ...report, checked_at: new Date().toISOString(), file_path };
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
      } catch (e) { /* ignore */ }
    }

    res.json({ status: report.ok ? 'ok' : 'issues_found', project_id, file_path, profil: profil || null, ...report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Stock media search ---
// Recherche des visuels libres de droits sur Pexels, Pixabay, Unsplash.
app.get('/media/stock', async (req, res) => {
  try {
    const { query, sources, per_page } = req.query;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const sourceList = sources ? String(sources).split(',').map(s => s.trim()) : null;
    const perPage = Math.min(parseInt(per_page || 5), 20);

    const results = await searchStockMedia(query, sourceList, perPage);
    res.json({ status: 'ok', query, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Content tracking (veille + thèmes traités) ---

// Insère ou met à jour un item de veille.
app.post('/content/raw-items', async (req, res) => {
  try {
    const { profil, source, source_url, external_id, title, summary, content, language, published_at, metadata, status, score } = req.body;
    if (!profil || !source) {
      return res.status(400).json({ error: 'profil and source are required' });
    }
    const result = await pgPool.query(
      `INSERT INTO shared.raw_items (profil, source, source_url, external_id, title, summary, content, language, published_at, metadata, status, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'fr'), $9, COALESCE($10, '{}'), COALESCE($11, 'pending'), $12)
       ON CONFLICT (profil, source, COALESCE(external_id, source_url))
       DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         content = EXCLUDED.content,
         language = EXCLUDED.language,
         published_at = EXCLUDED.published_at,
         metadata = EXCLUDED.metadata,
         status = EXCLUDED.status,
         score = EXCLUDED.score,
         collected_at = now()
       RETURNING id`,
      [profil, source, source_url || null, external_id || null, title || null, summary || null, content || null, language, published_at || null, metadata || '{}', status || 'pending', score || null]
    );
    res.json({ status: 'ok', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste les items de veille (optionnellement filtrés par profil et status).
app.get('/content/raw-items', async (req, res) => {
  try {
    const { profil, status, limit = 50, offset = 0 } = req.query;
    let where = [];
    let params = [];
    if (profil) { params.push(profil); where.push(`profil = $${params.length}`); }
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    params.push(Number(limit) || 50);
    params.push(Number(offset) || 0);
    const sql = `SELECT * FROM shared.raw_items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY collected_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await pgPool.query(sql, params);
    res.json({ items: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marque un item comme selected/rejected/used.
app.patch('/content/raw-items/:id', async (req, res) => {
  try {
    const { status, project_id } = req.body;
    const result = await pgPool.query(
      `UPDATE shared.raw_items SET status = $1, project_id = $2, selected_at = now() WHERE id = $3 RETURNING *`,
      [status, project_id || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'raw item not found' });
    res.json({ status: 'ok', item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enregistre ou met à jour un thème traité.
app.post('/content/themes', async (req, res) => {
  try {
    const { profil, theme, label, project_id, metadata } = req.body;
    if (!profil || !theme) {
      return res.status(400).json({ error: 'profil and theme are required' });
    }
    const result = await pgPool.query(
      `INSERT INTO shared.themes_traites (profil, theme, label, project_id, metadata)
       VALUES ($1, $2, $3, $4, COALESCE($5, '{}'))
       ON CONFLICT (profil, theme)
       DO UPDATE SET
         label = EXCLUDED.label,
         project_id = EXCLUDED.project_id,
         metadata = EXCLUDED.metadata,
         last_used_at = now(),
         use_count = shared.themes_traites.use_count + 1
       RETURNING id`,
      [profil, theme, label || theme, project_id || null, metadata || '{}']
    );
    res.json({ status: 'ok', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste les thèmes traités pour un profil.
app.get('/content/themes', async (req, res) => {
  try {
    const { profil } = req.query;
    if (!profil) return res.status(400).json({ error: 'profil query param is required' });
    const result = await pgPool.query(
      `SELECT * FROM shared.themes_traites WHERE profil = $1 ORDER BY last_used_at DESC`,
      [profil]
    );
    res.json({ items: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste les plateformes supportées/activées et le mode dry_run par défaut.
app.get('/publish/platforms', (req, res) => {
  res.json({
    supported: Object.keys(publishProviders),
    enabled: getEnabledPlatforms(),
    dry_run_default: (process.env.PUBLISH_DRY_RUN || 'true').toLowerCase() !== 'false'
  });
});

app.listen(PORT, () => {
  console.log(`Automaton API running on port ${PORT}`);
});

startUploadWorker();
console.log('Upload worker started (queue:upload)');

startAnalyticsWorker();
console.log('Analytics worker started (queue:analytics)');
