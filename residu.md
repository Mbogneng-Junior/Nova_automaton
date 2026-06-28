# 1. SWAP (obligatoire si pas fait)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

# 2. Sur ton PC local, pousser les modifs
git add .
git commit -m "Add Hermes Agent + HCI stack"
git push origin main

# 3. Sur le serveur, pull et setup
cd /home/automaton/automaton
git pull origin main

# 4. Ajouter les variables dans .env
nano .env
# HERMES_PROVIDER=nous
# HERMES_HCI_PASSWORD=ton_mdp

# 5. Lancer le script
./scripts/setup-hermes.sh

# 6. CONFIGURER Hermes (obligatoire, interactif)
docker exec -it automaton_hermes bash
hermes model
# → Choisir Nous Portal ou OpenAI/Claude
exit

# 7. Redémarrer
docker compose restart hermes

# 8. Accès
# Dashboard : https://hermes.automaton.neurenova.tech
# Gateway   : http://127.0.0.1:8123




cd /home/automaton/automaton && git pull origin main
docker compose rm -s -f hermes hermes-hci
docker rmi automaton-hermes automaton-hermes-hci
sudo rm -rf ./data/hermes
docker compose build --no-cache hermes hermes-hci
docker compose up -d hermes hermes-hci
docker exec -it automaton_hermes bash
hermes --version && hermes model && exit
docker compose restart hermes