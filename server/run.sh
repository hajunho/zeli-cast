#!/bin/bash

# ==============================================================================
# ZeliCast Weather Server — 단독 실행 스크립트
# Port: 5171
# Usage: chmod +x run.sh && ./run.sh
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ZeliCast Weather Server (5171)    ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Node.js 체크
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js not found.${NC}"
    echo "  Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node $(node --version)"

# 2. 의존성 설치
if [ ! -d "node_modules/express" ]; then
    echo -e "${YELLOW}[INSTALL]${NC} npm install..."
    npm install
else
    echo -e "${GREEN}[OK]${NC} Dependencies ready"
fi

# 3. 포트 충돌 체크
if lsof -i :5171 -t &> /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Port 5171 already in use. Killing..."
    kill $(lsof -i :5171 -t) 2>/dev/null
    sleep 1
fi

# 4. 서버 시작
echo ""
echo -e "${GREEN}[START]${NC} http://localhost:5171/api/cast/weather"
echo "  Press Ctrl+C to stop"
echo ""

node index.js
