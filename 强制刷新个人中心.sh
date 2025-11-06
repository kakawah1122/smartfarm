#!/bin/bash

# 个人中心样式强制刷新脚本
echo "🔄 开始强制刷新个人中心样式..."

cd "$(dirname "$0")"

# 1. 清理小程序缓存文件
echo "📦 清理缓存文件..."
find miniprogram/pages/profile -name "*.wxss" -delete
echo "✅ 已删除编译后的 wxss 文件"

# 2. 显示当前使用的文件
echo ""
echo "📄 当前个人中心文件状态:"
echo "-----------------------------------"
ls -lh miniprogram/pages/profile/*.scss 2>/dev/null || echo "❌ 未找到 scss 文件"
ls -lh miniprogram/pages/profile/*.ts 2>/dev/null || echo "❌ 未找到 ts 文件"
ls -lh miniprogram/pages/profile/*.wxml 2>/dev/null || echo "❌ 未找到 wxml 文件"

# 3. 显示修改内容摘要
echo ""
echo "✨ 已完成的样式修改:"
echo "-----------------------------------"
echo "1️⃣  个人信息卡片顶部边距: -80rpx → 120rpx (避免被导航栏遮挡)"
echo "2️⃣  养殖场概况布局: 4列 → 2x2四宫格"
echo "3️⃣  四宫格卡片样式: 添加渐变色背景"
echo "    • 第1个(当前存栏): 蓝色渐变"
echo "    • 第2个(存活率): 绿色渐变"
echo "    • 第3个(健康数量): 青色渐变"
echo "    • 第4个(低库存): 橙色渐变"
echo "4️⃣  卡片文字颜色: 改为白色,提高可读性"
echo "5️⃣  添加卡片阴影: 增强视觉层次"

echo ""
echo "🎯 接下来的操作:"
echo "-----------------------------------"
echo "1. 在微信开发者工具中点击【编译】按钮"
echo "2. 如果样式仍未生效,请点击【清缓存】→【清除文件缓存】"
echo "3. 再次点击【编译】按钮"
echo "4. 如果还是不行,请重启微信开发者工具"
echo ""
echo "✅ 脚本执行完成!"

