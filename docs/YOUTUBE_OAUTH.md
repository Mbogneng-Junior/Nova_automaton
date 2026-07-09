# Obtenir un refresh token YouTube pour Automaton

Ce guide explique comment créer un projet Google Cloud, activer l'API YouTube, et obtenir un `refresh_token` OAuth 2.0 utilisable par le provider `publishYouTube` d'Automaton.

> Le `refresh_token` est permanent (tant que tu ne révoques pas l'accès). Il permet à l'API de publier des vidéos sur ta chaîne sans intervention manuelle.

---

## 1. Créer un projet Google Cloud

1. Va sur [Google Cloud Console](https://console.cloud.google.com/).
2. Clique sur le sélecteur de projet en haut → **New Project**.
3. Donne un nom, ex : `Automaton YouTube`.
4. Clique sur **Create**.

---

## 2. Activer l'API YouTube Data v3

1. Dans le menu hamburger, va dans **APIs & Services** → **Library**.
2. Cherche **YouTube Data API v3**.
3. Clique sur **Enable**.

---

## 3. Configurer l'écran de consentement OAuth

1. Va dans **APIs & Services** → **OAuth consent screen**.
2. Choisis **External** (ou **Internal** si tu as Google Workspace).
3. Remplis :
   - **App name** : `neurenova-automaton`
   - **User support email** : ton email
   - **Developer contact email** : ton email
4. Dans **Scopes**, ajoute :
   ```
   https://www.googleapis.com/auth/youtube.upload
   ```
5. Finalise l'écran de consentement.

> L'application restera en mode **Testing** tant que Google ne l'aura pas validée. C'est suffisant pour un usage personnel en ajoutant des testeurs.

---

## 4. Créer un client OAuth de type Web application

1. Va dans **APIs & Services** → **Credentials**.
2. Clique **Create Credentials** → **OAuth client ID**.
3. Dans **Application type**, choisis **Web application**.
4. Nomme-le, ex : `Automaton YouTube Web`.
5. Dans **Authorized redirect URIs**, ajoute exactement :
   ```
   https://developers.google.com/oauthplayground
   ```
6. Clique **Create**.
7. Copie immédiatement :
   - **Client ID** → `YOUTUBE_CLIENT_ID`
   - **Client Secret** → `YOUTUBE_CLIENT_SECRET`

---

## 5. Ajouter un testeur (mode Testing)

Si l'application est en mode Testing, ajoute l'email du compte YouTube cible comme testeur :

1. Va dans **APIs & Services** → **OAuth consent screen**.
2. Dans le menu de gauche, clique sur **Audience**.
3. Descends jusqu'à **Test users**.
4. Clique **Add users**.
5. Ajoute l'email du compte Google qui gère la chaîne YouTube cible.
6. Clique **Save**.
7. Attends 1-2 minutes que la propagation soit effective.

---

## 6. Obtenir le refresh_token via Google OAuth Playground

### 6.1 Configurer le Playground

1. Va sur [Google OAuth Playground](https://developers.google.com/oauthplayground).
2. Clique sur l'**engrenage** (Settings) en haut à droite.
3. Coche **Use your own OAuth credentials**.
4. Renseigne :
   - **OAuth Client ID** : ton Client ID
   - **OAuth Client secret** : ton Client Secret

### 6.2 Sélectionner le scope

1. Dans le panneau de gauche, cherche **YouTube Data API v3**.
2. Clique sur le scope :
   ```
   https://www.googleapis.com/auth/youtube.upload
   ```

### 6.3 Autoriser l'API

1. Clique sur **Authorize APIs**.
2. Connecte-toi avec le compte Google gérant la chaîne YouTube cible.
3. Si tu vois un message indiquant que l'app est en test, clique sur **Continuer** (ou **Advanced** → **Go to neurenova-automaton (unsafe)**).
4. Autorise l'accès à YouTube.

### 6.4 Échanger le code contre un token

1. De retour dans le Playground, va dans **Step 2 : Exchange authorization code for tokens**.
2. Clique sur **Exchange authorization code for tokens**.
3. Copie la valeur de **Refresh token**.

> Le `refresh_token` est très long et sensible. Ne le partage pas.

---

## 7. Configurer le `.env` du droplet

Connecte-toi au droplet et ajoute les variables :

```bash
ssh root@TON_DROPLET_IP
cd /home/automaton/automaton
nano .env
```

Ajoute :

```env
YOUTUBE_CLIENT_ID=ton_client_id
YOUTUBE_CLIENT_SECRET=ton_client_secret
YOUTUBE_REFRESH_TOKEN=ton_refresh_token
PUBLISH_PLATFORMS_ENABLED=youtube,tiktok,meta
PUBLISH_DRY_RUN=true
```

Puis redémarre l'API :

```bash
docker compose up -d --build api
```

---

## 8. Tester la publication

### Vérifier les plateformes activées

```bash
curl http://api:3000/publish/platforms
```

Résultat attendu :

```json
{
  "supported": ["youtube", "tiktok", "meta"],
  "enabled": ["youtube", "tiktok", "meta"],
  "dry_run_default": true
}
```

### Tester en dry_run

```bash
curl -X POST http://api:3000/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "project_id": "test-project",
    "file_path": "outputs/video_long.mp4",
    "title": "Test dry run",
    "description": "Description test",
    "tags": ["test", "automaton"],
    "visibility": "private",
    "dry_run": true
  }'
```

### Passer en vrai publish

Pour publier réellement, soit :

- Envoie `"dry_run": false` dans l'appel API, **et** mets `PUBLISH_DRY_RUN=false` dans `.env`, ou
- Envoie `"dry_run": false` dans l'appel et laisse `PUBLISH_DRY_RUN=true` (l'appel override le global).

---

## 9. Publier plusieurs chaînes YouTube

Le `refresh_token` est lié au compte Google / chaîne YouTube choisi pendant l'autorisation.

### Option recommandée : un refresh_token par chaîne

- Crée un projet Google Cloud (ou un client OAuth) par chaîne YouTube.
- Répète la procédure ci-dessus pour chaque chaîne.
- Stocke chaque `refresh_token` dans la configuration de la chaîne correspondante (ex: dans le `channel-registry.json` ou dans des variables d'environnement spécifiques).

### Option avancée : compte de marque (brand account)

Si plusieurs chaînes sont des comptes de marque gérés par le même compte Google, il est possible de switcher de chaîne via l'API, mais cette méthode est plus fragile. L'option "un refresh_token par chaîne" est plus robuste.

---

## Dépannage

### Erreur `redirect_uri_mismatch`

L'URI `https://developers.google.com/oauthplayground` n'est pas autorisée dans ton client OAuth. Crée un client de type **Web application** et ajoute cette URI dans **Authorized redirect URIs**.

### Erreur `403 : access_denied`

L'application est en mode Testing et l'email utilisé n'est pas dans la liste des testeurs. Ajoute l'email dans **OAuth consent screen** → **Audience** → **Test users**.

### Pas de `refresh_token` retourné

L'OAuth Playground demande automatiquement `access_type=offline`. Si tu utilises un script Node.js personnalisé, assure-toi d'ajouter :

```js
access_type: 'offline',
prompt: 'consent'
```

---

## Référence

- [YouTube Data API Overview](https://developers.google.com/youtube/v3/getting-started)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
