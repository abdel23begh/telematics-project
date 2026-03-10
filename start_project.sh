#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Déterminer le répertoire du script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🚀 DÉMARRAGE DU PROJET TÉLÉMÉTRIE & FLOTTE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# --- 1. VÉRIFICATION ET DÉMARRAGE DE POSTGRESQL ---
echo -e "\n${YELLOW}[INFO]${NC} Vérification et démarrage de PostgreSQL..."
sudo systemctl start postgresql 2>/dev/null || true
sleep 2

if sudo systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}[SUCCESS]${NC} PostgreSQL est en cours d'exécution."
else
    echo -e "${RED}[ERROR]${NC} PostgreSQL n'a pas pu être démarré."
    exit 1
fi

# --- 2. CONFIGURATION DE LA BASE DE DONNÉES ---
echo -e "\n${YELLOW}[INFO]${NC} Configuration de l'utilisateur et de la base de données PostgreSQL..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '1234';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE telematics;" 2>/dev/null || true
echo -e "${GREEN}[SUCCESS]${NC} Base de données configurée."

# --- 3. INITIALISATION DES TABLES ---
echo -e "\n${YELLOW}[INFO]${NC} Initialisation des tables de la base de données..."
cd "$SCRIPT_DIR/middleware"
python3 database.py > ../logs/database.log 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}[SUCCESS]${NC} Base de données et tables initialisées."
else
    echo -e "${YELLOW}[WARNING]${NC} Vérifiez les logs: logs/database.log"
fi
cd "$SCRIPT_DIR"

# --- 4. LANCEMENT DU MIDDLEWARE PYTHON ---
echo -e "\n${YELLOW}[INFO]${NC} Lancement du Middleware Python sur le port 5027..."
cd "$SCRIPT_DIR/middleware"
python3 server.py > ../logs/middleware.log 2>&1 &
MIDDLEWARE_PID=$!
echo -e "${GREEN}[INFO]${NC} Middleware lancé avec PID $MIDDLEWARE_PID. Logs: logs/middleware.log"
cd "$SCRIPT_DIR"
sleep 2

# --- 5. LANCEMENT DU BACKEND NODE.JS ---
echo -e "\n${YELLOW}[INFO]${NC} Lancement du Backend Node.js sur le port 3000..."

# Créer package.json s'il n'existe pas
if [ ! -f "$SCRIPT_DIR/backend/package.json" ]; then
    echo -e "${YELLOW}[INFO]${NC} Création du fichier package.json pour le backend..."
    cat > "$SCRIPT_DIR/backend/package.json" << 'BACKEND_JSON'
{
  "name": "telemetrie-backend",
  "version": "1.0.0",
  "description": "Backend API pour suivi de flotte",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3"
  }
}
BACKEND_JSON
fi

# Installer les dépendances du backend
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
    echo -e "${YELLOW}[INFO]${NC} Installation des dépendances du backend..."
    cd "$SCRIPT_DIR/backend"
    npm install > ../logs/backend_install.log 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Échec de l'installation des dépendances du backend."
        cat ../logs/backend_install.log
        exit 1
    fi
    cd "$SCRIPT_DIR"
fi

# Lancer le backend
cd "$SCRIPT_DIR/backend"
node server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}[INFO]${NC} Backend lancé avec PID $BACKEND_PID. Logs: logs/backend.log"
cd "$SCRIPT_DIR"
sleep 3

# --- 6. LANCEMENT DU FRONTEND REACT (VITE) ---
echo -e "\n${YELLOW}[INFO]${NC} Lancement du Frontend React sur le port 5173..."

# Créer package.json s'il n'existe pas
if [ ! -f "$SCRIPT_DIR/frontend/package.json" ]; then
    echo -e "${YELLOW}[INFO]${NC} Création du fichier package.json pour le frontend..."
    cat > "$SCRIPT_DIR/frontend/package.json" << 'FRONTEND_JSON'
{
  "name": "telemetrie-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173 --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
FRONTEND_JSON
fi

# Installer les dépendances du frontend
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}[INFO]${NC} Installation des dépendances du frontend..."
    cd "$SCRIPT_DIR/frontend"
    npm install > ../logs/frontend_install.log 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Échec de l'installation des dépendances du frontend."
        cat ../logs/frontend_install.log
        exit 1
    fi
    cd "$SCRIPT_DIR"
fi

# Lancer le frontend en mode développement
cd "$SCRIPT_DIR/frontend"
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}[INFO]${NC} Frontend lancé avec PID $FRONTEND_PID. Logs: logs/frontend.log"
cd "$SCRIPT_DIR"
sleep 3

# --- 7. AFFICHAGE DES INFORMATIONS DE DÉMARRAGE ---
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TOUS LES SERVICES ONT ÉTÉ LANCÉS !${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "\n${BLUE}📱 Accès au Frontend:${NC}     ${YELLOW}http://localhost:5173${NC}"
echo -e "${BLUE}🔌 API Backend:${NC}          ${YELLOW}http://localhost:3000${NC}"
echo -e "${BLUE}📡 Middleware Teltonika:${NC} ${YELLOW}Port 5027${NC}"
echo -e "${BLUE}🗄️  PostgreSQL:${NC}          ${YELLOW}localhost:5432${NC}"
echo -e "\n${BLUE}📋 Logs disponibles:${NC}"
echo -e "   - Frontend:  logs/frontend.log"
echo -e "   - Backend:   logs/backend.log"
echo -e "   - Middleware: logs/middleware.log"
echo -e "\n${YELLOW}⏹️  Pour arrêter tous les services, appuyez sur Ctrl+C${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"

# Stocker les PIDs pour l'arrêt propre
echo "$MIDDLEWARE_PID" > /tmp/middleware.pid
echo "$BACKEND_PID" > /tmp/backend.pid
echo "$FRONTEND_PID" > /tmp/frontend.pid

# Fonction pour arrêter proprement tous les services
cleanup() {
    echo -e "\n\n${YELLOW}[INFO]${NC} Arrêt des services..."
    
    [ -f /tmp/middleware.pid ] && kill $(cat /tmp/middleware.pid) 2>/dev/null || true
    [ -f /tmp/backend.pid ] && kill $(cat /tmp/backend.pid) 2>/dev/null || true
    [ -f /tmp/frontend.pid ] && kill $(cat /tmp/frontend.pid) 2>/dev/null || true
    
    rm -f /tmp/middleware.pid /tmp/backend.pid /tmp/frontend.pid
    
    echo -e "${GREEN}[SUCCESS]${NC} Tous les services ont été arrêtés."
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT SIGTERM

# Attendre indéfiniment
wait
