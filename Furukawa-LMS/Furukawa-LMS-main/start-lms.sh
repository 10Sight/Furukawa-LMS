#!/usr/bin/env bash

# Resolve directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LAN_IP="192.168.90.19"
FRONTEND_PORT="5174"
BACKEND_PORT="3000"
APP_URL="http://${LAN_IP}:${FRONTEND_PORT}"

echo "========================================================"
echo "          FURUKAWA LMS - SHELL LAUNCHER"
echo "========================================================"
echo ""

# Check if PM2 is available
if ! command -v pm2 &> /dev/null; then
    echo "[WARNING] PM2 not found in PATH, trying npx pm2..."
    PM2_CMD="npx pm2"
else
    PM2_CMD="pm2"
fi

echo "[INFO] Working directory: $SCRIPT_DIR"
echo "[INFO] LAN IP:            $LAN_IP"

# Start or restart PM2
if $PM2_CMD describe lms-backend > /dev/null 2>&1; then
    echo "[INFO] Apps already registered. Restarting via ecosystem.config.js..."
    $PM2_CMD restart ecosystem.config.js --update-env
else
    echo "[INFO] Starting apps via ecosystem.config.js..."
    $PM2_CMD start ecosystem.config.js
fi

$PM2_CMD save
echo ""
$PM2_CMD list

echo ""
echo "========================================================"
echo "  LMS Started Successfully!"
echo "  - LAN Access:  $APP_URL"
echo "  - Local:       http://localhost:${FRONTEND_PORT}"
echo "  - Backend API: http://${LAN_IP}:${BACKEND_PORT}"
echo "========================================================"
echo ""

# Launch browser
if command -v start &> /dev/null; then
    start "$APP_URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$APP_URL" > /dev/null 2>&1 &
elif command -v open &> /dev/null; then
    open "$APP_URL"
fi
