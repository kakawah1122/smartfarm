#!/bin/bash

# 图片优化脚本
# 需要先安装: brew install imagemagick

echo "🖼️ 开始优化图片资源..."
echo "=============================="

# 设置路径
ASSETS_DIR="miniprogram/assets"
BACKUP_DIR="miniprogram/assets_backup_$(date +%Y%m%d_%H%M%S)"

# 创建备份
echo "📦 备份原始图片到: $BACKUP_DIR"
cp -r "$ASSETS_DIR" "$BACKUP_DIR"

# 统计原始大小
ORIGINAL_SIZE=$(du -sh "$ASSETS_DIR" | cut -f1)
echo "📊 原始大小: $ORIGINAL_SIZE"
echo ""

# 优化PNG图片
echo "🔧 优化PNG图片..."
find "$ASSETS_DIR" -type f -name "*.png" | while read file; do
    filename=$(basename "$file")
    echo "  处理: $filename"
    
    # 获取原始大小
    original_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    
    # 压缩图片 (保持质量85%，最大宽度128px for icons)
    if [[ $filename == *"icon"* ]]; then
        # 图标：128x128
        convert "$file" -resize 128x128\> -quality 85 -strip "$file.tmp"
    else
        # Logo: 200x200
        convert "$file" -resize 200x200\> -quality 85 -strip "$file.tmp"
    fi
    
    # 使用pngquant进一步压缩（如果已安装）
    if command -v pngquant &> /dev/null; then
        pngquant --quality=65-80 --force "$file.tmp" -o "$file"
        rm "$file.tmp"
    else
        mv "$file.tmp" "$file"
    fi
    
    # 获取新大小
    new_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    
    # 计算压缩率
    if [ $original_size -gt 0 ]; then
        reduction=$((100 - (new_size * 100 / original_size)))
        echo "    ✅ 压缩率: ${reduction}% (${original_size} -> ${new_size} bytes)"
    fi
done

echo ""

# 考虑转换为WebP（需要微信基础库2.9.0+）
echo "💡 建议："
echo "1. 考虑使用WebP格式（需要基础库2.9.0+）"
echo "2. 对于纯色图标，考虑使用字体图标或SVG"
echo "3. 使用CDN加速图片加载"
echo ""

# 统计优化后大小
NEW_SIZE=$(du -sh "$ASSETS_DIR" | cut -f1)
echo "=============================="
echo "✅ 优化完成！"
echo "📊 原始大小: $ORIGINAL_SIZE"
echo "📊 优化后: $NEW_SIZE"
echo "💾 备份位置: $BACKUP_DIR"
echo ""
echo "⚠️ 请测试小程序确保图片显示正常"
