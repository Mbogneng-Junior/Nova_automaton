# Music AI Workflow - Troubleshooting Guide

## Lessons Learned from Implementation

### 1. n8n HTTP Request Node - JSON Body Configuration

**PROBLEM:** Using `={{ }}` expressions inside JSON body fields causes "not valid JSON" errors.

**WHY:** n8n validates the JSON BEFORE evaluating expressions. If the expression contains quotes, newlines, or special characters, the JSON parser breaks.

**SOLUTION - Pattern A (Simple bodies):**
Use "Using Fields Below" mode with key-value parameters:
```json
"specifyBody": "usingFieldsBelow",
"bodyParameters": {
  "parameters": [
    { "name": "project_id", "value": "={{ $json.projectId }}" },
    { "name": "task", "value": "render_long" }
  ]
}
```
**WARNING:** This works ONLY for simple string values. Does NOT work reliably for complex objects or strings with quotes/newlines.

**SOLUTION - Pattern B (Complex bodies - RECOMMENDED):**
Pre-stringify the JSON body in a Code node upstream, then reference it:
```javascript
// In Code node (Create Metadata or Merge Concept)
const bodyJson = JSON.stringify({
  provider: provider,
  prompt: prompt,  // Can contain quotes, newlines, etc.
  model: model,
  temperature: 0.8
});
return [{ json: { bodyJson } }];
```

```json
// In HTTP Request node
"specifyBody": "json",
"jsonBody": "={{ $json.bodyJson }}"
```

**WHY THIS WORKS:** The Code node handles JSON escaping properly. The HTTP node just sends the already-valid JSON string.

---

### 2. n8n Expression Syntax in JSON Fields

**PROBLEM:** Confusion between `={{ }}` (expression wrapper) and `{{ }}` (template interpolation).

**RULES:**
- For field VALUES (url, single string values): Use `={{ $json.field }}`
- For INSIDE JSON strings: Use `"{{ $json.field }}"` (without outer `=`)
- When the ENTIRE field is an expression: Use `={{ expression }}`

**EXAMPLES:**
```json
// URL field - entire value is expression
"url": "=https://api.automaton.neurenova.tech/projects/{{ $json.projectId }}"

// JSON body using template syntax (from exemple2.json)
"jsonBody": "={\"prompt\":\"{{ $json.PROMPT }}\"}"

// Referencing another node's output
"jsonBody": "={{ $('Merge Concept').first().json.metadataJson }}"
```

---

### 3. Data Propagation Between Nodes

**PROBLEM:** Nodes only receive output from the IMMEDIATELY preceding node. If Node A generates data, Node B transforms it, and Node C needs data from Node A - it won't be available.

**SOLUTION:** Use `$('Node Name').first().json.field` syntax to access any previous node's output:
```json
"jsonBody": "={{ $('Merge Concept').first().json.ffmpegBody }}"
```

**WHY NEEDED:** In our workflow, "Queue FFmpeg" needed `ffmpegBody` from "Merge Concept", but the intermediate "Store Project" node (HTTP Request) returned a different structure. Without explicit referencing, `$json.ffmpegBody` was `undefined`.

---

### 4. Workflow Import/Export Gotchas

**PROBLEM:** Workflows exported from n8n UI sometimes don't re-import correctly via CLI.

**SYMPTOMS:**
- HTTP Request nodes lose body configuration
- Code nodes get corrupted (newlines split across lines)
- Expressions become literal strings

**SOLUTIONS:**
1. **Always validate JSON** after manual edits:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('workflow.json')); console.log('Valid')"
   ```

2. **Keep jsCode on single lines** in JSON - never let newlines split the string:
   ```json
   // BAD - newlines in middle of string
   "jsCode": "const x = 1;\nconst y = 2;\nreturn x;"
   // This often gets corrupted during edit operations
   ```

3. **Prefer pre-stringified bodies** (Pattern B above) over inline JSON expressions.

4. **Test immediately after import** - don't assume it works.

---

### 5. API Endpoint Deployment

**PROBLEM:** `Cannot POST /workflow/music-ai` - endpoint not found.

**WHY:** Docker container was restarted but not rebuilt. Changes to source code weren't applied.

**SOLUTION:**
```bash
# Must rebuild the container, not just restart
docker compose up -d --build api

# Verify endpoint exists
curl -X POST https://api.automaton.neurenova.tech/workflow/music-ai \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","provider":"mistral"}'
```

---

### 6. Complete Working Workflow Structure

**Nodes:**
1. **Webhook** - Receives POST with `{title, genre, mood, provider}`
2. **Create Metadata** (Code) - Generates `projectId`, `prompt`, `model`, `metadata`, **pre-stringifies `bodyJson`**
3. **AI Generate** (HTTP) - Sends `bodyJson` to `/ai/generate`
4. **Merge Concept** (Code) - Parses AI response, merges into metadata, **pre-stringifies `metadataJson` and `ffmpegBody`**
5. **Store Project** (HTTP) - Sends `metadataJson` to `/projects/:id`
6. **Queue FFmpeg** (HTTP) - Sends `ffmpegBody` to `/jobs/ffmpeg`
7. **Respond to Webhook** - Returns final response

**Key insight:** Every HTTP Request node that sends complex JSON should receive a PRE-STRINGIFIED body from a Code node.

---

## Quick Test Command

```bash
curl -X POST https://n8n.automaton.neurenova.tech/webhook/music-ai-starter \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","genre":"electronic","mood":"epic","provider":"mistral"}'
```

Expected response:
```json
{"projectId":"track_...","status":"queued","provider":"mistral"}
```
