#!/bin/bash

echo "========================================"
echo "  搜打撤游戏 - 本地开发服务器启动"
echo "========================================"
echo ""

cd "$(dirname "$0")"

echo "[1/2] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖，请稍候..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败！请检查网络连接或npm配置"
        exit 1
    fi
    echo "依赖安装完成！"
else
    echo "依赖已存在，跳过安装"
fi

echo ""
echo "[2/2] 启动开发服务器..."
echo ""
echo "游戏将在浏览器中自动打开"
echo "如果没有自动打开，请访问: http://localhost:3000"
echo ""
echo "按 Ctrl+C 可以停止服务器"
echo ""

npm run dev

