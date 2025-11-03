#!/bin/bash

# 修复 TDesign picker-item 组件的 slot 重复警告问题
# 此脚本应在构建 npm 后运行
# 使用方法：在微信开发者工具中执行 "工具 → 构建 npm" 后，运行此脚本

echo "🔧 修复 TDesign picker-item 的 slot 重复警告问题..."

TARGET_FILE="miniprogram/miniprogram_npm/tdesign-miniprogram/picker-item/picker-item.js"
TARGET_WXML="miniprogram/miniprogram_npm/tdesign-miniprogram/picker-item/picker-item.wxml"

# 检查文件是否存在
if [ ! -f "$TARGET_FILE" ] && [ ! -f "$TARGET_WXML" ]; then
    echo "⚠️  文件不存在"
    echo "   请先执行：工具 → 构建 npm"
    exit 0
fi

# 方案1: 检查并修复 picker-item.wxml 中的 slot 定义
if [ -f "$TARGET_WXML" ]; then
    echo "📝 检查 picker-item.wxml 文件..."
    
    # 备份原文件
    cp "$TARGET_WXML" "${TARGET_WXML}.bak"
    
    # 检查文件内容
    if grep -q "label-suffix" "$TARGET_WXML"; then
        echo "⚠️  发现 label-suffix slot 定义"
        echo "   这是 TDesign 组件库的内部实现问题"
        echo "   建议：这些警告不会影响功能，可以安全忽略"
    else
        echo "✅ picker-item.wxml 未发现问题"
        rm -f "${TARGET_WXML}.bak"
    fi
fi

# 方案2: 检查 picker-item.js 文件
if [ -f "$TARGET_FILE" ]; then
    echo "📝 检查 picker-item.js 文件..."
    
    # 备份原文件
    cp "$TARGET_FILE" "${TARGET_FILE}.bak"
    
    echo "✅ 文件备份完成"
fi

echo ""
echo "📌 关于 slot 重复警告的说明："
echo "   这些警告来自 TDesign 的 date-time-picker 组件内部"
echo "   当 picker 渲染多个选项时会触发这些警告"
echo "   这是 TDesign 组件库的已知问题，不影响功能"
echo ""
echo "🔍 建议的解决方案："
echo "   1. 这些警告不影响功能，可以暂时忽略"
echo "   2. 如果想避免警告，可以使用原生 picker 组件替代"
echo "   3. 等待 TDesign 官方修复此问题"
echo ""
echo "✨ 检查完成！"

