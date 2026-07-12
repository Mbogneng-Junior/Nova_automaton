# exemple2.json — Génération Vidéo Sora 2 + Upload TikTok

## Ce que fait ce workflow

Ce workflow **génère une vidéo IA avec Sora 2 (via fal.ai)** puis la publie automatiquement sur **TikTok**.

**Flux global :**
1. **Trigger** — Formulaire n8n (`formTrigger`) où l'utilisateur entre un prompt vidéo
2. **Création** — Appel HTTP POST vers l'API fal.ai Sora 2 (`Create Video`)
3. **Attente** — Nœud `Wait` de 60 secondes (temps de génération)
4. **Polling** — Vérifie le statut de la génération (`Get status`)
5. **Condition** — Si `status !== "completed"`, reboucle sur l'attente
6. **Récupération** — Télécharge l'URL de la vidéo (`Get Url Video`) puis le fichier (`Get File Video`)
7. **Titre** — Génère un titre avec OpenAI (`Generate title`)
8. **Upload** — Envoie la vidéo vers Postiz (`Upload Video to Postiz`)
9. **Publication** — Publie sur TikTok via le nœud Postiz (`TikTok`)

**Nœuds clés :**
- `formTrigger` — Formulaire utilisateur intégré
- `httpRequest` (fal.ai) — Création + statut + download vidéo
- `wait` — Pause entre les polls
- `if` — Condition de rebouclage
- `openAi` (LangChain) — Génération du titre
- `postiz` (custom node) — Upload + publication TikTok

## Comment l'utiliser

1. **Configurer les credentials :**
   - fal.ai API key (dans `httpHeaderAuth`)
   - OpenAI API key
   - Postiz / TikTok credentials

2. **Remplir le formulaire** avec un prompt vidéo (ex: "a cat dancing in neon city")

3. **Le workflow attend et poll** automatiquement (~2-3 minutes)

4. **La vidéo est publiée** sur TikTok avec un titre généré par l'IA

## Principes de syntaxe illustrés

### 1. URL dynamique avec expression n8n
```json
"url": "=https://queue.fal.run/fal-ai/sora-2/requests/{{ $('Create Video').item.json.request_id }}/status"
```
Construit une URL en interpolant un `request_id` venant d'un autre nœud. **Le `=` initial est obligatoire** pour que n8n évalue l'expression dans une chaîne.

### 2. Authentication par header
```json
"authentication": "genericCredentialType",
"genericAuthType": "httpHeaderAuth"
```
Utilise un credential générique de type header (ex: `Authorization: Bearer xxx`) pour l'API fal.ai.

### 3. Polling loop avec Wait + If
```
Create Video → Wait 60s → Get status → If (completed?) → [non] → Wait 60s → Get status → ...
```
Pattern classique de **polling asynchrone** : on attend, on vérifie, on reboucle si pas prêt.

### 4. Expressions dans les conditions If
```json
"leftValue": "={{ $json.status }}",
"value": "completed"
```
Compare le champ `status` du JSON retourné avec la valeur attendue.

### 5. Expression dans body (form-urlencoded)
```json
"bodyParameters": {
  "parameters": [
    { "name": "prompt", "value": "={{ $json.prompt }}" }
  ]
}
```
Passe des paramètres dynamiques en mode `form-urlencoded`.
