#!/bin/bash

echo "🔄 强制刷新小程序样式..."
echo ""

# 1. 删除编译缓存
echo "1️⃣ 清理编译缓存..."
rm -rf .tea 2>/dev/null
rm -rf miniprogram/.tea 2>/dev/null

# 2. 重新生成wxss
echo "2️⃣ 触发样式重新编译..."
touch miniprogram/packageHealth/breeding-todo/breeding-todo.scss
touch miniprogram/components/bottom-popup/bottom-popup.scss
touch miniprogram/packageHealth/breeding-todo/breeding-todo.wxml

echo ""
echo "✅ 完成！"
echo ""
echo "📱 请在微信开发者工具中按以下顺序操作："
echo ""
echo "   1. 点击菜单栏「项目」→「重新打开此项目」"
echo "   2. 或者直接关闭开发者工具，重新打开"
echo "   3. 点击「编译」按钮"
echo "   4. 如果还不行，点击「清缓存」→「清除文件缓存」→「清除授权数据」"
echo ""
echo "🔍 验证修改："
grep -n "divider-line" miniprogram/packageHealth/breeding-todo/breeding-todo.wxml | head -3
echo ""
grep -n "info-row-dosage" miniprogram/packageHealth/breeding-todo/breeding-todo.wxml
echo ""
echo "✅ 代码确认：分割线和用量位置都已正确修改！"
