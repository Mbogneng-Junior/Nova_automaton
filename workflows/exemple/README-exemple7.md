# exemple7.json — WhatsApp AI Agent avec Google Docs

## Ce que fait ce workflow

Ce workflow est un **agent IA sur WhatsApp** qui répond aux messages des utilisateurs en se basant sur le contenu d'un **Google Doc** (base de connaissances), avec **mémoire de conversation**, **logging Google Sheets** et **gestion de la fenêtre 24h** de WhatsApp.

**Flux global :**
1. **Trigger** — `whatsAppTrigger` reçoit un message WhatsApp entrant
2. **Knowledge** — `googleDocs` lit le document de connaissances de l'entreprise
3. **Prompt** — `aiTransform` (Prepare Prompt) combine : date du jour + contenu du doc + question utilisateur
4. **Agent** — `agent` LangChain avec `memoryBufferWindow` et `lmChatGoogleGemini` (Gemini 2.5 Flash) génère la réponse
5. **Log** — `dateTime` + `googleSheets` enregistre la conversation (User, Message, Response, Timestamp)
6. **Vérification 24h** — `code` vérifie si le dernier message du contact date de moins de 24h
7. **Condition** — `if` (24-hour window check) :
   - **Vrai** (fenêtre active) → `cleanAnswer` nettoie la réponse → `whatsApp` envoie le message texte
   - **Faux** (fenêtre fermée) → `whatsApp` envoie un template pré-approuvé pour rouvrir la conversation

**Nœuds clés :**
- `whatsAppTrigger` — Réception des messages WhatsApp
- `googleDocs` — Lecture de la base de connaissances
- `aiTransform` — Préparation du prompt (nouveau nœud IA de n8n)
- `agent` (LangChain) — Agent avec instruction système personnalisée
- `lmChatGoogleGemini` — Modèle Gemini 2.5 Flash Thinking
- `memoryBufferWindow` — Mémoire de conversation par utilisateur (clé = `wa_id`)
- `dateTime` — Timestamp de la conversation
- `googleSheets` — Logging dans "Chat Logs"
- `code` (24-hour window check) — Vérification de la fenêtre WhatsApp
- `if` — Branchement conditionnel
- `cleanAnswer` — Nettoyage du markdown et des préambules
- `whatsApp` (x2) — Envoi message texte + template

## Comment l'utiliser

1. **Configurer les credentials :**
   - WhatsApp Cloud API (Meta Business)
   - Google Docs / Google Sheets OAuth
   - Google Gemini API key

2. **Créer le Google Doc** avec la base de connaissances et copier son ID dans le nœud `company's knowledge`

3. **Créer la Google Sheet "Chat Logs"** avec colonnes : Timestamp, User, Message, Response

4. **Configurer le template WhatsApp** dans Meta Business Manager et mettre à jour l'ID dans le nœud template

5. **Activer le workflow** — L'agent répondra automatiquement aux messages entrants

## Principes de syntaxe illustrés

### 1. WhatsApp Trigger — accès aux données de contact
```json
"recipientPhoneNumber": "={{ $('when message received').item.json.contacts[0].wa_id }}"
```
Accède au numéro WhatsApp du contact (`wa_id`) depuis le webhook entrant.

### 2. Mémoire par session utilisateur
```json
"sessionKey": "={{ $('when message received').item.json.contacts[0].wa_id }}",
"sessionIdType": "customKey"
```
Chaque utilisateur WhatsApp a sa propre mémoire de conversation grâce à son `wa_id` comme clé de session.

### 3. AI Transform (nouveau nœud n8n)
```json
"type": "n8n-nodes-base.aiTransform"
```
Nœud IA intégré qui permet d'écrire des instructions en langage naturel pour transformer les données. Il génère automatiquement le code JavaScript.

### 4. Code node — Manipulation de texte avancée
```javascript
let txt = $('AI Agent').first().json.output || '';
txt = txt.replace(/[*_~]+/g, '');                    // Supprime markdown
txt = txt.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 $2');  // Convertit les liens
txt = txt.replace(/^.*?based on the document you provided[,:]?\s*/i, '');  // Supprime préambule
return [{ json: { answer: txt } }];
```
Nettoie la sortie IA pour qu'elle soit compatible WhatsApp (pas de markdown, pas de préambules).

### 5. Gestion de la fenêtre 24h WhatsApp
```javascript
const lastTs = Number($('when message received').first().json.messages[0].timestamp) * 1000;
const withinWindow = Date.now() - lastTs < 24 * 60 * 60 * 1000;
return [{ json: { withinWindow, answer: $json.answer, userId: $json.userId } }];
```
Vérifie si le dernier message date de moins de 24h. Si non, on ne peut envoyer que des templates pré-approuvés.

### 6. Connexion AI memory
```json
"ai_memory": [[ { "node": "AI Agent", "type": "ai_memory", "index": 0 } ]]
```
Connecte la mémoire buffer à l'agent LangChain.

### 7. Référence croisée avec `.item.json`
```json
"textBody": "={{ $json.answer }}"
```
Dans un nœud `whatsApp`, utilise `.item.json` pour accéder à l'item courant dans le contexte d'une boucle.

### 8. If avec opérateur boolean
```json
"leftValue": "={{ $json.withinWindow }}",
"operator": { "type": "boolean", "operation": "true", "singleValue": true }
```
Vérifie si une valeur booléenne est `true` (pas de `rightValue` nécessaire).
