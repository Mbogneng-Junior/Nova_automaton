#!/bin/bash
# Script de vérification de l'état complet du système Automaton
# Usage: ./scripts/check-system-status.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Vérification de l'état du système Automaton"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fonction pour vérifier un service
check_service() {
    local service=$1
    local container=$2
    
    echo "📦 Service: $service"
    
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        status=$(docker inspect --format='{{.State.Status}}' "$container")
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        
        if [ "$status" = "running" ]; then
            echo "   ✅ Status: Running"
            if [ "$health" != "none" ]; then
                if [ "$health" = "healthy" ]; then
                    echo "   ✅ Health: Healthy"
                else
                    echo "   ⚠️  Health: $health"
                fi
            fi
        else
            echo "   ❌ Status: $status"
        fi
    else
        echo "   ❌ Container not found"
    fi
    echo ""
}

# Vérifier tous les services
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Services Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_service "Nginx" "automaton_nginx"
check_service "n8n" "automaton_n8n"
check_service "PostgreSQL" "automaton_postgres"
check_service "Redis" "automaton_redis"
check_service "API" "automaton_api"
check_service "FFmpeg Worker" "automaton_ffmpeg_worker"
check_service "Hermes" "automaton_hermes"

# Vérifier la base de données
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Base de données PostgreSQL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if docker exec automaton_postgres psql -U postgres -d automaton -c "\l" > /dev/null 2>&1; then
    echo "✅ Connexion PostgreSQL OK"
    
    # Vérifier les schémas
    echo ""
    echo "📊 Schémas disponibles:"
    docker exec automaton_postgres psql -U postgres -d automaton -c "\dn" | grep -E "music_ai|shared_hitl|workflow_template" || echo "   ⚠️  Aucun schéma métier trouvé"
    
    # Vérifier les tables HITL
    echo ""
    echo "📋 Tables HITL:"
    if docker exec automaton_postgres psql -U postgres -d automaton -c "\dt shared_hitl.*" 2>/dev/null | grep -q "approval_states"; then
        echo "   ✅ shared_hitl.approval_states"
        echo "   ✅ shared_hitl.approval_logs"
    else
        echo "   ❌ Tables HITL non créées (exécute: docker exec -i automaton_postgres psql -U postgres -d automaton < services/postgres/init/03-shared-hitl.sql)"
    fi
else
    echo "❌ Impossible de se connecter à PostgreSQL"
fi
echo ""

# Vérifier Redis
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Redis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if docker exec automaton_redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis répond"
    
    # Vérifier les queues
    echo ""
    echo "📊 Queues BullMQ:"
    queues=$(docker exec automaton_redis redis-cli KEYS "bull:*" 2>/dev/null | wc -l)
    echo "   Nombre de queues: $queues"
else
    echo "❌ Redis ne répond pas"
fi
echo ""

# Vérifier l'API
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  API Métier"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if docker exec automaton_api curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API répond"
    
    # Vérifier les endpoints
    echo ""
    echo "📡 Endpoints disponibles:"
    
    if docker exec automaton_api curl -s http://localhost:3000/publish/platforms > /dev/null 2>&1; then
        echo "   ✅ /publish/platforms"
    else
        echo "   ❌ /publish/platforms"
    fi
    
    if docker exec automaton_api curl -s -X POST http://localhost:3000/ai/generate-image -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
        echo "   ✅ /ai/generate-image"
    else
        echo "   ❌ /ai/generate-image"
    fi
    
    if docker exec automaton_api curl -s http://localhost:3000/ffmpeg/status > /dev/null 2>&1; then
        echo "   ✅ /ffmpeg/status"
    else
        echo "   ❌ /ffmpeg/status"
    fi
else
    echo "❌ API ne répond pas"
    echo ""
    echo "📋 Derniers logs de l'API:"
    docker logs --tail 20 automaton_api
fi
echo ""

# Vérifier Hermes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Hermes Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if docker exec automaton_hermes curl -s http://localhost:8123/v1/health > /dev/null 2>&1; then
    echo "✅ Hermes Gateway répond"
else
    echo "⚠️  Hermes Gateway ne répond pas (normal si pas encore configuré)"
fi

if docker exec automaton_hermes curl -s http://localhost:10274/api/health > /dev/null 2>&1; then
    echo "✅ Hermes HCI répond"
else
    echo "⚠️  Hermes HCI ne répond pas"
fi
echo ""

# Vérifier n8n
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  n8n Workflows"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if docker exec automaton_n8n wget -q --spider http://localhost:5678/healthz; then
    echo "✅ n8n répond"
    echo ""
    echo "🌐 Interface: https://n8n.automaton.neurenova.tech"
else
    echo "❌ n8n ne répond pas"
fi
echo ""

# Résumé des variables d'environnement critiques
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  Variables d'environnement critiques"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_env_var() {
    local var=$1
    local container=$2
    
    if docker exec "$container" env | grep -q "^${var}="; then
        value=$(docker exec "$container" env | grep "^${var}=" | cut -d'=' -f2)
        if [ -n "$value" ] && [ "$value" != "" ]; then
            echo "   ✅ $var (défini)"
        else
            echo "   ⚠️  $var (vide)"
        fi
    else
        echo "   ❌ $var (non défini)"
    fi
}

echo "API:"
check_env_var "OPENAI_API_KEY" "automaton_api"
check_env_var "LEONARDO_API_KEY" "automaton_api"
check_env_var "YOUTUBE_CLIENT_ID" "automaton_api"
check_env_var "YOUTUBE_CLIENT_SECRET" "automaton_api"
check_env_var "YOUTUBE_REFRESH_TOKEN" "automaton_api"
check_env_var "PUBLISH_DRY_RUN" "automaton_api"

echo ""
echo "Hermes:"
check_env_var "AWS_ACCESS_KEY_ID" "automaton_hermes"
check_env_var "AWS_SECRET_ACCESS_KEY" "automaton_hermes"
check_env_var "HERMES_PROVIDER" "automaton_hermes"

echo ""

# Résumé final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Résumé"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

running=$(docker ps --filter "name=automaton_" --format '{{.Names}}' | wc -l)
total=7

echo "Services actifs: $running/$total"
echo ""

if [ "$running" -eq "$total" ]; then
    echo "✅ Tous les services sont opérationnels"
else
    echo "⚠️  Certains services ne sont pas démarrés"
    echo ""
    echo "Pour démarrer tous les services:"
    echo "  docker compose up -d"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Prochaines étapes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Si l'API ne répond pas: docker compose up -d --build api"
echo "2. Si les tables HITL manquent: voir DEPLOYMENT_GUIDE.md Phase 4"
echo "3. Pour tester les endpoints: ./scripts/test-api-endpoints.sh droplet"
echo "4. Pour obtenir le token YouTube: node scripts/get-youtube-token.js"
echo ""

# Made with Bob
