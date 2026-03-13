#!/bin/bash

# ==============================================================================
# ZeliCast Weather Server (Express/Node.js)
# Port: 5171
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_CAST_DIR="$SCRIPT_DIR/backend_cast"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   ZeliCast Weather Server (Express)                        ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed!${NC}"
    echo "Please install Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

echo -e "${GREEN}[OK] Node.js $(node --version)${NC}"

cd "$BACKEND_CAST_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] npm install failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Dependencies installed.${NC}"
else
    echo -e "${GREEN}[OK] Dependencies already installed.${NC}"
fi

echo ""
echo -e "${GREEN}Starting ZeliCast Server (Port 5171)...${NC}"
echo "  API: http://localhost:5171/api/cast/weather?lat=37.5665&lon=126.9780"
echo ""

node index.js
