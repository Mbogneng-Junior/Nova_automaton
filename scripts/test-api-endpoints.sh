#!/bin/bash
# Script de test des endpoints de l'API Automaton
# Usage: ./scripts/test-api-endpoints.sh [local|droplet]

set -e

MODE=${1:-local}

if [ "$MODE" = "droplet" ]; then
    # Tests sur le droplet (via docker exec)
    API_CMD="docker exec automaton_api curl -s"
    BASE_URL="http://localhost:3000"
else
    # Tests en local
    API_CMD="curl -s"
    BASE_URL="http://localhost:3000"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Tests des endpoints API Automaton (mode: $MODE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fonction pour afficher les résultats
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo "📍 Test: $name"
    echo "   Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$($API_CMD "$BASE_URL$endpoint")
    else
        response=$($API_CMD -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Réponse reçue"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        echo "   ❌ Erreur de connexion"
    fi
    echo ""
}

# Test 1: Health check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Health Check" "GET" "/health" ""

# Test 2: Plateformes de publication
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Plateformes de publication"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Liste des plateformes" "GET" "/publish/platforms" ""

# Test 3: Publication YouTube (dry run)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Publication YouTube (dry run)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Publish YouTube" "POST" "/publish" '{
  "platform": "youtube",
  "video_path": "/app/projects/test/video.mp4",
  "metadata": {
    "title": "Test Video - Automaton",
    "description": "Test de publication automatique",
    "tags": ["test", "automaton", "ai"],
    "category": "22",
    "privacy": "private"
  },
  "dry_run": true
}'

# Test 4: Génération d'image Leonardo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Génération d'image (Leonardo)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Generate Image Leonardo" "POST" "/ai/generate-image" '{
  "prompt": "A futuristic AI music studio with neon lights and holographic displays",
  "provider": "leonardo",
  "style": "cinematic",
  "aspect_ratio": "16:9",
  "negative_prompt": "blurry, low quality"
}'

# Test 5: Génération d'image OpenAI
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Génération d'image (OpenAI)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Generate Image OpenAI" "POST" "/ai/generate-image" '{
  "prompt": "A minimalist music production workspace with AI elements",
  "provider": "openai",
  "style": "vivid",
  "size": "1792x1024"
}'

# Test 6: Rendu vidéo FFmpeg
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Rendu vidéo FFmpeg"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Render Video" "POST" "/ffmpeg/render" '{
  "project_id": "test-project-001",
  "audio_path": "/app/projects/test/audio.mp3",
  "image_path": "/app/projects/test/cover.jpg",
  "output_format": "mp4",
  "resolution": "1920x1080",
  "fps": 30
}'

# Test 7: Statut FFmpeg
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  Statut FFmpeg Worker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "FFmpeg Status" "GET" "/ffmpeg/status" ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests terminés"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Notes:"
echo "   - Les erreurs de clés API manquantes sont normales si tu n'as pas"
echo "     encore configuré toutes les variables d'environnement"
echo "   - Les tests en dry_run ne publient rien réellement"
echo "   - Vérifie les logs de l'API pour plus de détails:"
echo "     docker logs --tail 100 automaton_api"
echo ""

# Made with Bob
