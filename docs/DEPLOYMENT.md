# Déploiement

## Prérequis

- Droplet DigitalOcean 4GB RAM / 2 vCPU / Ubuntu 24.04
- Nom de domaine pointé vers le droplet
- Accès SSH root
- Compte GitHub avec le repo `automaton`

## Étapes

### 1. Créer le repo GitHub

```bash
# Sur le workspace local
cd /home/mbogneng-junior/Documents/art/Creation_contenus/Automaton
git init
git add .
git commit -m "Initial commit: Automaton automation stack"
git branch -M main
git remote add origin https://github.com/TON_COMPTE/automaton.git
git push -u origin main
```

### 2. Configurer le serveur

```bash
ssh root@TON_IP
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TON_COMPTE/automaton/main/scripts/setup-server.sh)"
```

Ou copier le script manuellement :

```bash
scp scripts/setup-server.sh root@TON_IP:/tmp/
ssh root@TON_IP 'bash /tmp/setup-server.sh'
```

### 3. Cloner le repo sur le droplet

```bash
ssh automaton@TON_IP
git clone https://github.com/TON_COMPTE/automaton.git /home/automaton/automaton
cd /home/automaton/automaton
```

### 4. Configurer l'environnement

```bash
cp .env.example .env
nano .env
# Remplir tous les champs obligatoires
```

### 5. Générer le certificat SSL

```bash
docker run -it --rm \
  -v /home/automaton/automaton/data/certbot/conf:/etc/letsencrypt \
  -v /home/automaton/automaton/data/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --standalone \
  -d automaton.neurenova.tech -d n8n.automaton.neurenova.tech -d api.automaton.neurenova.tech
```

### 6. Lancer la stack

```bash
docker-compose up -d
```

### 7. Vérifier

```bash
# Health check
curl https://api.automaton.neurenova.tech/health

# n8n
# Ouvrir https://n8n.automaton.neurenova.tech
```

## Mise à jour

```bash
ssh automaton@TON_IP
cd /home/automaton/automaton
git pull
docker-compose up -d --build
```

## Backup

```bash
./scripts/backup.sh
```

Ajouter une crontab pour backup quotidien :

```bash
0 3 * * * /home/automaton/automaton/scripts/backup.sh >> /var/log/automaton-backup.log 2>&1
```
