# Tests du workflow Music AI Starter

Ce document liste les commandes `curl` pour tester le webhook `music-ai-starter` avec chaque fournisseur d'IA.

## Prérequis

- Le workflow `music-ai-starter` doit être importé et activé dans n8n.
- Les variables d'environnement du fournisseur utilisé doivent être renseignées dans `.env`.
- L'API doit être redémarrée après avoir ajouté une clé API.

## Test avec OpenAI (défaut)

```bash
curl -X POST https://n8n.automaton.neurenova.tech/webhook/music-ai-starter \
  -H "Content-Type: application/json" \
  -d '{"title": "My OpenAI Track", "genre": "electronic", "mood": "epic"}'
```

## Test avec Anthropic (Claude)

```bash
curl -X POST https://n8n.automaton.neurenova.tech/webhook/music-ai-starter \
  -H "Content-Type: application/json" \
  -d '{"title": "My Claude Track", "genre": "electronic", "mood": "epic", "provider": "anthropic"}'
```

## Test avec DeepSeek

```bash
curl -X POST https://n8n.automaton.neurenova.tech/webhook/music-ai-starter \
  -H "Content-Type: application/json" \
  -d '{"title": "My DeepSeek Track", "genre": "electronic", "mood": "epic", "provider": "deepseek"}'
```

## Test avec Mistral

```bash
curl -X POST https://n8n.automaton.neurenova.tech/webhook/music-ai-starter \
  -H "Content-Type: application/json" \
  -d '{"title": "My Mistral Track", "genre": "electronic", "mood": "epic", "provider": "mistral"}'
```

## Réponse attendue

```json
{"projectId":"track_...","status":"queued"}
```

## Vérifier le projet créé

```bash
curl https://api.automaton.neurenova.tech/projects/<projectId>
```

Exemple :

```bash
curl https://api.automaton.neurenova.tech/projects/track_1782287459774
```

## Vérifier les logs en cas d'erreur

```bash
cd /home/automaton/automaton
docker-compose logs api --tail 50
docker-compose logs n8n --tail 50
```
