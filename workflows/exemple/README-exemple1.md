# exemple.json — AI Social Media Content Factory

## Ce que fait ce workflow

Ce workflow est une **usine de contenu social media complète et automatisée** alimentée par l'IA. Il génère du contenu texte + image pour **LinkedIn, Instagram, Facebook, X (Twitter), TikTok, Threads et YouTube Shorts**.

**Flux global :**
1. **Input** — L'utilisateur fournit un sujet/topic via un formulaire ou un trigger
2. **Génération IA** — Un agent LangChain génère le contenu structuré (titre, description, hashtags, etc.)
3. **Génération image** — Une image est créée via pollinations.ai ou OpenAI DALL-E
4. **Upload image** — L'image est hébergée sur imgbb.com
5. **Approbation** — Un email Gmail est envoyé pour approbation manuelle
6. **Publication** — Si approuvé, le contenu est publié simultanément sur toutes les plateformes

**Nœuds clés :**
- `outputParserStructured` — Parse la sortie IA en JSON structuré
- `lmChatOpenAi` / `lmChatGoogleGemini` — Modèles de langage
- `pollinations.ai` (`httpRequest`) — Génération d'images gratuite
- `imgbb.com` (`httpRequest`) — Hébergement d'images
- `facebookGraphApi` — Posts Instagram & Facebook
- `twitter` — Posts X
- `linkedIn` — Posts LinkedIn
- `gmail` — Emails d'approbation
- `aggregate` — Agrège plusieurs résultats

## Comment l'utiliser

1. **Configurer les credentials :**
   - OpenAI API key (pour GPT-4o-mini)
   - Gmail OAuth (pour l'approbation)
   - Facebook/Instagram Graph API
   - Twitter/X API
   - LinkedIn API
   - imgbb API key

2. **Activer le workflow** et déclencher via le trigger manuel ou un webhook

3. **Vérifier l'email d'approbation** et répondre pour valider la publication

4. **Résultat** — Le post est publié sur toutes les plateformes configurées

## Principes de syntaxe illustrés

### 1. Expressions n8n de base (`$json`)
```json
"value": "={{ $json.topic }}"
```
Accède au champ `topic` de l'output JSON du nœud précédent.

### 2. Expressions avec référence croisée (`$()`)
```json
"value": "={{ $('Generate Image').item.json.url }}"
```
Accède à un champ d'un nœud spécifique par son nom. **Crucial** quand on fusionne des branches parallèles.

### 3. Mode `onError: "continueRegularOutput"`
```json
"onError": "continueRegularOutput"
```
Sur les nœuds de publication sociale — si une plateforme échoue, le workflow continue quand même pour les autres.

### 4. Output Parser Structuré
```json
"type": "@n8n/n8n-nodes-langchain.outputParserStructured"
```
Force l'IA à retourner un JSON avec des champs précis (title, description, hashtags, etc.).

### 5. Nœud Merge (fusion de branches)
```json
"type": "n8n-nodes-base.merge"
```
Combine les outputs de plusieurs nœuds parallèles en un seul flux.

### 6. Aggregate
```json
"type": "n8n-nodes-base.aggregate"
```
Agrège une liste d'items en un seul item (utile pour résumer les résultats de publication).
