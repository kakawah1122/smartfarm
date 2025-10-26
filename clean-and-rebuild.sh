#!/bin/bash

# 微信小程序清理和重建脚本
# 用于解决 API 弃用警告和缓存问题

echo "🧹 开始清理微信小程序项目..."

# 进入 miniprogram 目录
cd "$(dirname "$0")/miniprogram"

# 1. 清理 npm 相关
echo "📦 清理 npm 包..."
rm -rf miniprogram_npm
rm -rf node_modules
rm -f package-lock.json

# 2. 重新安装依赖
echo "📥 重新安装依赖..."
npm install

echo ""
echo "✅ 清理完成！"
echo ""
echo "📝 接下来请在微信开发者工具中执行："
echo "   1. 工具 -> 清除缓存 -> 清除全部缓存"
echo "   2. 工具 -> 构建 npm"
echo "   3. 点击 '编译' 按钮"
echo ""

