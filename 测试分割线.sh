#!/bin/bash

echo "===================="
echo "🔍 检查分割线代码"
echo "===================="

echo ""
echo "📝 检查 WXML 中的分割线元素："
grep -n "divider-line" miniprogram/packageHealth/breeding-todo/breeding-todo.wxml | head -5

echo ""
echo "🎨 检查 SCSS 中的分割线样式："
grep -A 8 "\.divider-line" miniprogram/packageHealth/breeding-todo/breeding-todo.scss

echo ""
echo "===================="
echo "✅ 代码检查完成！"
echo "===================="
echo ""
echo "📱 请在微信开发者工具中："
echo "   1. 点击「工具」→「清除缓存」→ 勾选所有"
echo "   2. 点击「编译」"
echo "   3. 打开待办详情"
echo ""
echo "🔍 如果还看不到，请："
echo "   1. 右键点击弹窗"
echo "   2. 选择「审查元素」"
echo "   3. 查看是否有 .divider-line 元素"
echo "   4. 查看该元素的实际样式"
