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

### 2. Cloner le dépôt et créer les données persistantes

```bash
cd /home/automaton
git clone https://github.com/Mbogneng-Junior/Nova_automaton.git automaton
cd automaton
mkdir -p data/hermes-home

# TRÈS IMPORTANT : Donner les bonnes permissions au volume pour le container
sudo chown -R 1000:1000 data/hermes-home
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
nano .env
```

**Variables critiques à renseigner :**

| Variable | Description |
|---|---|
| `HERMES_HCI_PASSWORD` | Mot de passe pour l'interface HCI (ex: `neurenovahermes`) |
| `HERMES_HCI_SECRET` | Clé secrète JWT HCI (chaîne aléatoire longue) |
| `AWS_ACCESS_KEY_ID` | Clé AWS pour Bedrock |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS pour Bedrock |
| `AWS_DEFAULT_REGION` | Région AWS (ex: `us-east-1`) |

### 4. Lancer l'infrastructure

```bash
docker compose up -d --build
```

### 5. Obtenir les certificats SSL (Certbot)

```bash
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

### Étape A — Configurer le modèle IA (à faire une fois sur un serveur vierge)

```bash
docker exec -it automaton_hermes bash
hermes model
# Choisir : IAM (1) → us-east-1 → Claude (1)
exit
```

### Étape B — Créer le compte admin HCI (première fois)

```bash
docker exec automaton_hermes curl -s -X POST http://127.0.0.1:10274/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"neurenovahermes"}'
```

### Étape C — Redémarrer pour appliquer la configuration

```bash
docker compose restart hermes
```

> **Note :** Le Gateway API est activé et configuré automatiquement au démarrage grâce à `entrypoint.sh`. Vous n'avez plus besoin de le configurer manuellement via le CLI ou le dashboard.

---

## 🔄 Mise à jour de l'infrastructure

Grâce au montage de volume, toutes les données (base de données HCI, modèles, configurations) persisteront. 

```bash
cd /home/automaton/automaton
git pull
docker compose up -d --build
```

---

## 🌐 URLs des services

| Service | URL |
|---|---|
| Interface HCI Hermes | https://hermes.automaton.neurenova.tech |
| n8n Workflows | https://n8n.automaton.neurenova.tech |

---

## 🐛 Bilan des problèmes résolus (Historique de Troubleshooting)

Si vous devez débugger une installation future, voici les obstacles historiques que nous avons franchis :

**1. "Connection Error" sur l'interface HCI / Nginx 502 Bad Gateway**
- **Symptôme :** Impossible de se connecter, Nginx renvoyait une erreur `502`.
- **Explication & Solution :** Nginx proxyait les appels de connexion de HCI vers la requête `/api/auth/login`. Malheureusement, Nginx avait aussi un bloc `location /api/` visant le *Gateway* `hermes`, ce qui interceptait la requête. De plus, `hermes` et HCI étaient dans deux containers séparés, alors que HCI dépend du fait d'être exécuté dans le même environnement que le CLI `hermes` via le même réseau localhost `127.0.0.1`.
- **Correctif :** HCI a été fusionné au sein du container Hermes principal. La route `/api/` de Nginx a été modifiée en `/v1/` visant exclusivement le Gateway.

**2. La configuration de Hermes disparaissait à chaque redémarrage**
- **Symptôme :** La configuration `hermes model` etc. s'évaporait après un `docker compose restart`.
- **Explication & Solution :** Le dossier `/home/hermes/.hermes/` n'était pas persisté sur disque. Un volume Docker `./data/hermes-home:/home/hermes/.hermes` a été ajouté au `docker-compose.yml`. 

**3. Le volume persistant écrasait les fichiers d'installation de Hermes !**
- **Symptôme :** L'erreur `Command 'hermes' not found` ou des boucles de crash de permission de lien symbolique (symlinks).
- **Explication & Solution :** Dès qu'on monte un dossier host (`/data/hermes-home`), Docker supprime/écrase le contenu du dossier d'image. Et comme on installait le dépôt github de hermes dans ce dossier `.hermes`, il disparaissait. De plus le dossier monté appartenait à `root` bloquant l'accès du container. 
- **Correctif :** Le `Dockerfile` installe désormais `hermes-agent` et `hci` dans le dossier `/opt/` (un endroit safe du système, non couvert par les volumes docker). Ensuite, `entrypoint.sh` fait un `ln -sf` pour les relier au dossier `.hermes/` lors du boot. Ajout de l'instruction `chown -R 1000:1000 data/hermes-home`.

**4. Le Gateway API crashait ("api_server failed to connect")**
- **Symptôme :** Le ❌ *Gateway API* restait "unreachable" dans le dashboard HCI.
- **Explication & Solution :** L'Agent Hermes force l'utilisation sécurisée d'une clé API (`API_SERVER_KEY`) dès l'activation du réseau localhost `api_server`, même si ce n'est testable que soi-même. 
- **Correctif :** Enregistrement en dur dans le `entrypoint.sh` de la clef auto-générée à chaque démarrage par `hermes config set platforms.api_server.extra.api_server_key "hsk_default"`.
