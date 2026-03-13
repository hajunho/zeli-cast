#!/bin/bash

# ==============================================================================
# ZeliCast Weather Server — 단독 실행 스크립트
# Port: 5171 (Backend) + 5172 (Frontend)
# Usage: chmod +x run.sh && ./run.sh
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ZeliCast Weather App              ${NC}"
echo -e "${GREEN}  BE: 5171 / FE: 5172               ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Node.js 체크
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js not found.${NC}"
    echo "  Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node $(node --version)"

# 2. 프론트엔드 의존성 설치
if [ ! -d "node_modules/react" ]; then
    echo -e "${YELLOW}[INSTALL]${NC} npm install (frontend)..."
    npm install
else
    echo -e "${GREEN}[OK]${NC} Frontend dependencies ready"
fi

# 3. 백엔드 의존성 설치
if [ ! -d "server/node_modules/express" ]; then
    echo -e "${YELLOW}[INSTALL]${NC} npm install (server)..."
    cd server && npm install && cd ..
else
    echo -e "${GREEN}[OK]${NC} Backend dependencies ready"
fi

# 4. 포트 충돌 체크
for PORT in 5171 5172; do
    if lsof -i :$PORT -t &> /dev/null; then
        echo -e "${YELLOW}[WARN]${NC} Port $PORT already in use. Killing..."
        kill $(lsof -i :$PORT -t) 2>/dev/null
        sleep 1
    fi
done

# 5. 서버 시작
echo ""
echo -e "${GREEN}[START]${NC} Backend : http://localhost:5171/api/weather"
echo -e "${GREEN}[START]${NC} Frontend: http://localhost:5172"
echo "  Press Ctrl+C to stop"
echo ""

npm run dev
