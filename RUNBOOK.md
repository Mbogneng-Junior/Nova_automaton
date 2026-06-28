# 🛠️ RUNBOOK — Infrastructure Automaton

## 📦 Déploiement sur un nouveau droplet

### 1. Prérequis (une seule fois sur le serveur)

```bash
# Installer Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin git

# Créer l'utilisateur applicatif
useradd -m -s /bin/bash automaton
usermod -aG docker automaton
su - automaton
```

### 2. Cloner le dépôt

```bash
cd /home/automaton
git clone https://github.com/Mbogneng-Junior/Nova_automaton.git automaton
cd automaton
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
nano .env   # Remplir toutes les valeurs (voir section Variables clés)
```

**Variables critiques à renseigner :**

| Variable | Description |
|---|---|
| `HERMES_HCI_PASSWORD` | Mot de passe pour l'interface HCI (ex: `neurenovahermes`) |
| `HERMES_HCI_SECRET` | Clé secrète JWT HCI (chaîne aléatoire longue) |
| `AWS_ACCESS_KEY_ID` | Clé AWS pour Bedrock |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS pour Bedrock |
| `AWS_DEFAULT_REGION` | Région AWS (ex: `us-east-1`) |
| `N8N_ENCRYPTION_KEY` | Clé de chiffrement n8n |

### 4. Lancer l'infrastructure

```bash
docker compose up -d --build
```

### 5. Obtenir les certificats SSL (Certbot)

```bash
# S'assurer que les DNS pointent vers ce serveur avant cette étape
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d automaton.neurenova.tech \
  -d n8n.automaton.neurenova.tech \
  -d hermes.automaton.neurenova.tech \
  --email votre@email.com --agree-tos --non-interactive

docker compose restart nginx
```

---

## 🤖 Configuration post-démarrage de Hermes

### Étape A — Configurer le modèle IA (une seule fois)

```bash
docker exec -it automaton_hermes bash
hermes model
# Choisir : IAM (1) → us-east-1 → Claude (1)
exit
```

### Étape B — Activer l'API Server Gateway

```bash
docker exec -it automaton_hermes bash
hermes config set platforms.api_server.enabled true
hermes config set platforms.api_server.extra.port 8123
hermes config set GATEWAY_ALLOW_ALL_USERS true
exit
```

### Étape C — Redémarrer pour appliquer

```bash
docker compose restart hermes
```

### Étape D — Créer le compte admin HCI (à chaque rebuild du container)

```bash
docker exec automaton_hermes curl -s -X POST http://127.0.0.1:10274/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"neurenovahermes"}'
```

---

## 🔄 Mise à jour de l'infrastructure

```bash
cd /home/automaton/automaton
git pull
docker compose up -d --build
```

> ⚠️ Après un rebuild de `hermes`, refaire l'**Étape D** (recréer le compte admin HCI).

---

## 🌐 URLs des services

| Service | URL |
|---|---|
| Interface HCI Hermes | https://hermes.automaton.neurenova.tech |
| n8n Workflows | https://n8n.automaton.neurenova.tech |
| API générale | https://automaton.neurenova.tech |

---

## 🧹 Commandes utiles

```bash
# Voir les logs en direct
docker compose logs -f hermes
docker compose logs -f hermes --tail=30

# Redémarrer un service
docker compose restart hermes
docker compose restart nginx

# Entrer dans un container
docker exec -it automaton_hermes bash

# Voir les logs HCI (à l'intérieur du container hermes)
docker exec automaton_hermes cat /tmp/hci.log

# Vérifier que HCI répond
docker exec automaton_hermes curl -I http://127.0.0.1:10274
```

---

## ⚠️ Notes importantes

- Le fichier `.env` **n'est pas versionné** — le copier/sauvegarder séparément
- La config Hermes (`auth.json`) est dans `/home/hermes/.hermes/` **à l'intérieur du container** — non persistée → refaire l'Étape A après rebuild complet
- `hermes` ne s'installe **que dans le container**, jamais sur le serveur hôte
