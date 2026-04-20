#!/bin/bash

# Asset Manager Dev Environment Starter Script
# Works on: macOS, Linux, WSL, Git Bash

echo "🚀 Starting Asset Manager Dev Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill process on a port
kill_port() {
    local port=$1
    local pname=$2
    
    echo -e "${YELLOW}[1/4]${NC} Checking for existing $pname on port $port..."
    
    # Try different methods to find and kill process
    if command -v lsof &> /dev/null; then
        # macOS/Linux with lsof
        pid=$(lsof -t -i:$port 2>/dev/null)
        if [ ! -z "$pid" ]; then
            echo "  → Killing process $pid on port $port..."
            kill -9 $pid 2>/dev/null
        fi
    elif command -v fuser &> /dev/null; then
        # Linux with fuser
        fuser -k $port/tcp 2>/dev/null
    elif command -v netstat &> /dev/null; then
        # Windows Git Bash
        pid=$(netstat -ano 2>/dev/null | grep ":$port" | grep LISTENING | awk '{print $5}' | head -1)
        if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
            echo "  → Killing process $pid on port $port..."
            taskkill //F //PID $pid 2>/dev/null || true
        fi
    fi
}

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Kill existing servers
kill_port 5000 "API Server"
kill_port 5173 "Dashboard"

# Give ports time to release
sleep 2

echo ""
echo -e "${YELLOW}[3/4]${NC} Starting API Server on http://localhost:5000..."
cd "$SCRIPT_DIR/artifacts/api-server"
if command -v gnome-terminal &> /dev/null; then
    # Linux with gnome-terminal
    gnome-terminal -- bash -c "corepack pnpm run dev; read -p 'Press Enter to close...'"
elif command -v osascript &> /dev/null; then
    # macOS
    osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/artifacts/api-server' && corepack pnpm run dev\""
elif command -v start &> /dev/null; then
    # Windows Git Bash
    start "API Server" cmd //k "cd /d \"$SCRIPT_DIR\\artifacts\\api-server\" && corepack pnpm run dev"
else
    # Fallback - run in background
    corepack pnpm run dev &
fi

# Wait for API to start
sleep 5

echo -e "${YELLOW}[4/4]${NC} Starting Dashboard on http://localhost:5173..."
cd "$SCRIPT_DIR/artifacts/dashboard"
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal -- bash -c "corepack pnpm run dev; read -p 'Press Enter to close...'"
elif command -v osascript &> /dev/null; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/artifacts/dashboard' && corepack pnpm run dev\""
elif command -v start &> /dev/null; then
    start "Dashboard" cmd //k "cd /d \"$SCRIPT_DIR\\artifacts\\dashboard\" && corepack pnpm run dev"
else
    corepack pnpm run dev &
fi

echo ""
echo -e "${GREEN}✅ Servers starting...${NC}"
echo "   API Server:   http://localhost:5000"
echo "   Dashboard:    http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop this script (servers will keep running in their windows)"
read -p "Press Enter to exit..."
