#!/bin/bash
# 启动 Cloudflare Tunnel 暴露本地 3000 端口

echo "Starting Cloudflare Tunnel..."
echo "Public URL will be shown below:"
echo ""
cloudflared tunnel --url http://localhost:3000
