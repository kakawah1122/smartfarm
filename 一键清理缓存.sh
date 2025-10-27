#!/bin/bash

# 一键清理微信开发者工具缓存脚本
# 警告：会清除所有本地缓存数据

echo "============================================"
echo "    一键清理微信开发者工具缓存"
echo "============================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="/Users/kaka/Documents/Sync/小程序/鹅数通"

echo -e "${YELLOW}警告：此操作将清除以下内容：${NC}"
echo "  • 项目编译缓存"
echo "  • npm 构建文件"
echo "  • 开发者工具缓存（可选）"
echo ""
echo -e "${RED}注意：清除后需要重新登录小程序！${NC}"
echo ""
read -p "确认继续吗？(y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消操作"
    exit 0
fi

echo ""
echo "开始清理..."
echo ""

# 1. 清理项目缓存
echo "1️⃣  清理项目缓存文件..."
cd "$PROJECT_DIR"
rm -rf .DS_Store
rm -rf miniprogram/.DS_Store
echo -e "${GREEN}✓ 项目缓存已清理${NC}"

# 2. 删除 npm 构建文件（将强制重新构建）
echo ""
echo "2️⃣  删除 npm 构建文件..."
if [ -d "miniprogram/miniprogram_npm" ]; then
    rm -rf miniprogram/miniprogram_npm
    echo -e "${GREEN}✓ npm 构建文件已删除（需要重新构建）${NC}"
else
    echo -e "${YELLOW}⚠ npm 构建文件不存在${NC}"
fi

# 3. 询问是否清理开发者工具缓存
echo ""
echo "3️⃣  清理微信开发者工具缓存..."
echo -e "${YELLOW}注意：这会影响所有项目，不仅是当前项目${NC}"
read -p "是否清理开发者工具缓存？(y/N): " clear_devtools

if [[ "$clear_devtools" =~ ^[Yy]$ ]]; then
    DEVTOOLS_CACHE="$HOME/Library/Application Support/微信开发者工具"
    
    if [ -d "$DEVTOOLS_CACHE" ]; then
        # 清理缓存目录
        if [ -d "$DEVTOOLS_CACHE/Default/Cache" ]; then
            rm -rf "$DEVTOOLS_CACHE/Default/Cache"/*
            echo -e "${GREEN}✓ 开发者工具缓存已清理${NC}"
        fi
        
        # 清理代码缓存
        if [ -d "$DEVTOOLS_CACHE/Default/Code Cache" ]; then
            rm -rf "$DEVTOOLS_CACHE/Default/Code Cache"/*
            echo -e "${GREEN}✓ 代码缓存已清理${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ 未找到开发者工具缓存目录${NC}"
    fi
else
    echo -e "${YELLOW}⊘ 跳过开发者工具缓存清理${NC}"
fi

echo ""
echo "============================================"
echo "              清理完成！"
echo "============================================"
echo ""
echo -e "${GREEN}✓ 所有缓存已清理${NC}"
echo ""
echo "📌 接下来请按以下步骤操作："
echo ""
echo "1️⃣  ${YELLOW}关闭${NC}微信开发者工具（完全退出）"
echo ""
echo "2️⃣  ${YELLOW}重新打开${NC}微信开发者工具"
echo ""
echo "3️⃣  打开项目后，点击：${GREEN}工具 → 构建 npm${NC}"
echo "    （必须执行，因为我们删除了 miniprogram_npm）"
echo ""
echo "4️⃣  构建完成后，点击：${GREEN}工具 → 清除缓存 → 全部清除${NC}"
echo ""
echo "5️⃣  点击${GREEN}「编译」${NC}按钮"
echo ""
echo "6️⃣  打开 ${GREEN}Console${NC}，检查是否还有警告"
echo ""
echo "如果还有警告，请运行验证脚本："
echo "  ./验证修复状态.sh"
echo ""

