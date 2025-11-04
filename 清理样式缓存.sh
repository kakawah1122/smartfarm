#!/bin/bash

echo "🧹 开始清理微信小程序样式缓存..."

# 清理编译缓存
echo "📦 清理编译缓存..."
rm -rf .tea

# 清理 npm 缓存
echo "📦 清理 npm 缓存..."
rm -rf miniprogram/.tea

echo "✅ 缓存清理完成！"
echo ""
echo "📝 接下来请在微信开发者工具中："
echo "   1. 点击菜单栏「项目」→「重新构建 npm」"
echo "   2. 点击「编译」按钮"
echo "   3. 如果还不生效，点击「清缓存」→「清除文件缓存」→「清除授权数据」"
echo "   4. 重新打开待办详情弹窗查看效果"
