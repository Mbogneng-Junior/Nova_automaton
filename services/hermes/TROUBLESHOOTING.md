# Hermes Agent — Journal des problèmes et solutions

## Problème 1 : Certificats SSL manquants lors du git clone (HCI)
**Symptôme :**
```
fatal: unable to access 'https://github.com/xaspx/hermes-control-interface.git/':
server certificate verification failed. CAfile: none CRLfile: none
```
**Cause :** L'image `node:20-slim` ne contient pas les certificats CA.
**Solution :** Ajouter `ca-certificates` dans le Dockerfile HCI.
```dockerfile
RUN apt-get update && apt-get install -y git ca-certificates --no-install-recommends
```
**Statut :** ✅ Résolu

---

## Problème 2 : Compilation de modules natifs Node.js échoue (node-gyp)
**Symptôme :**
```
npm error gyp ERR! find Python
npm error gyp ERR! find Python You need to install the latest version of Python.
```
**Cause :** `node-pty` et autres modules natifs nécessitent Python + build tools pour compiler.
**Solution :** Ajouter `python3`, `make`, `g++` et créer un symlink `python -> python3`.
```dockerfile
RUN apt-get install -y git ca-certificates python3 make g++ --no-install-recommends
RUN ln -sf /usr/bin/python3 /usr/local/bin/python
```
**Statut :** ✅ Résolu

---

## Problème 3 : `npm config set python` obsolète dans npm v10
**Symptôme :**
```
npm error `python` is not a valid npm option
```
**Cause :** `npm config set python` n'existe plus dans npm v10. `node-gyp` trouve Python via le PATH.
**Solution :** Remplacer par un symlink au lieu de `npm config`.
```dockerfile
RUN ln -sf /usr/bin/python3 /usr/local/bin/python
```
**Statut :** ✅ Résolu

---

## Problème 4 : Hermes binaire introuvable (`No such file or directory`)
**Symptôme :**
```bash
$ hermes model
/home/hermes/.local/bin/hermes: line 4:
/home/hermes/.hermes/hermes-agent/venv/bin/hermes: No such file or directory
```
**Cause :** L'installateur officiel `curl | bash` échoue silencieusement en environnement Docker non-interactif. Le venv n'est jamais créé.
**Solution :** Installation explicite étape par étape dans le Dockerfile :
1. Installer `uv` manuellement
2. Cloner le repo explicitement
3. Créer le venv avec `uv venv`
4. Installer les déps avec `uv pip install -e ".[all]"`
5. Créer le symlink `~/.local/bin/hermes`

```dockerfile
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git ~/.hermes/hermes-agent
RUN cd ~/.hermes/hermes-agent && \
    ~/.local/bin/uv venv venv --python python3 && \
    ~/.local/bin/uv pip install -e ".[all]"
RUN mkdir -p ~/.local/bin && \
    ln -sf ~/.hermes/hermes-agent/venv/bin/hermes ~/.local/bin/hermes
```
**Statut :** ✅ Résolu

---

## Problème 5 : Volume Docker masque le code installé
**Symptôme :** Container démarre mais `~/.hermes/hermes-agent` est vide.
**Cause :** Le volume mount `./data/hermes:/home/hermes/.hermes` écrase le contenu de l'image Docker par un dossier vide de l'hôte.
**Solution :** Supprimer le volume mount pour Hermes.
```yaml
# AVANT (problématique)
volumes:
  - ./data/hermes:/home/hermes/.hermes

# APRÈS (corrigé)
# Pas de volume mount — le code reste dans l'image
```
**Statut :** ✅ Résolu

---

## Problème 6 : `sudo` impossible dans container (user non-root)
**Symptôme :** (Potentiel) `sudo: command not found` ou permission denied.
**Cause :** Après `USER hermes`, on ne peut plus utiliser `sudo`.
**Solution :** Installer Node.js **en root** (avant `USER hermes`) dans le Dockerfile.
```dockerfile
# Avant USER hermes
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

USER hermes
```
**Statut :** ✅ Résolu

---

## Dernière solution proposée (résume tous les fixes)

### Rebuild complet from scratch
```bash
cd /home/automaton/automaton
git pull origin main

# Supprimer les anciens containers et images
docker compose rm -s -f hermes hermes-hci
docker rmi automaton-hermes automaton-hermes-hci

# Nettoyer le dossier data/hermes vide
sudo rm -rf ./data/hermes

# Rebuild sans cache
docker compose build --no-cache hermes hermes-hci

# Démarrer
docker compose up -d hermes hermes-hci

# Configurer Hermes (obligatoire premier run)
docker exec -it automaton_hermes bash
hermes --version    # vérifier l'installation
hermes model        # choisir le provider LLM
exit

# Redémarrer
docker compose restart hermes
```

### Fichiers modifiés
- `services/hermes/Dockerfile` — installation explicite + Node.js en root
- `services/hermes/entrypoint.sh` — chemins corrigés + auto-update
- `services/hermes-hci/Dockerfile` — python3 + ca-certificates + symlink
- `docker-compose.yml` — suppression du volume mount hermes

---

## Vérification finale
```bash
docker ps | grep hermes    # doit montrer 2 containers UP
curl http://127.0.0.1:8123  # Gateway doit répondre
```
