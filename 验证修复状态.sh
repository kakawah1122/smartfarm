#!/bin/bash

# 验证 getSystemInfoSync 修复状态脚本
# 作者：AI Assistant
# 日期：2025-10-24

echo "============================================"
echo "   getSystemInfoSync 修复状态验证脚本"
echo "============================================"
echo ""

PROJECT_DIR="/Users/kaka/Documents/Sync/小程序/鹅数通"
cd "$PROJECT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUCCESS_COUNT=0
FAIL_COUNT=0

# 检查函数
check_file() {
    local file_path=$1
    local file_desc=$2
    
    echo -n "检查 $file_desc... "
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}✗ 文件不存在${NC}"
        ((FAIL_COUNT++))
        return 1
    fi
    
    if grep -q "getSystemInfoSync" "$file_path"; then
        echo -e "${RED}✗ 仍包含 getSystemInfoSync${NC}"
        echo "  位置："
        grep -n "getSystemInfoSync" "$file_path" | head -3
        ((FAIL_COUNT++))
        return 1
    else
        echo -e "${GREEN}✓ 已修复${NC}"
        ((SUCCESS_COUNT++))
        return 0
    fi
}

echo "📋 第一步：检查用户代码"
echo "-------------------------------------------"
check_file "miniprogram/app.ts" "app.ts"
check_file "miniprogram/components/navigation-bar/navigation-bar.ts" "navigation-bar.ts"
check_file "miniprogram/pages/index/index.ts" "index.ts"
check_file "miniprogram/utils/navigation.ts" "navigation.ts"

echo ""
echo "📦 第二步：检查 TDesign 源文件"
echo "-------------------------------------------"
check_file "node_modules/tdesign-miniprogram/miniprogram_dist/common/wechat.js" "TDesign 源文件"

echo ""
echo "🔨 第三步：检查编译后的文件"
echo "-------------------------------------------"
check_file "miniprogram/miniprogram_npm/tdesign-miniprogram/common/wechat.js" "TDesign 编译文件"

echo ""
echo "🔍 第四步：全局搜索"
echo "-------------------------------------------"
echo -n "搜索所有 JS/TS 文件... "

SEARCH_RESULT=$(find miniprogram -name "*.js" -o -name "*.ts" | grep -v "node_modules" | grep -v ".d.ts" | xargs grep -l "getSystemInfoSync" 2>/dev/null | wc -l)

if [ "$SEARCH_RESULT" -eq 0 ]; then
    echo -e "${GREEN}✓ 无发现${NC}"
    ((SUCCESS_COUNT++))
else
    echo -e "${RED}✗ 发现 $SEARCH_RESULT 个文件仍使用${NC}"
    echo "  文件列表："
    find miniprogram -name "*.js" -o -name "*.ts" | grep -v "node_modules" | grep -v ".d.ts" | xargs grep -l "getSystemInfoSync" 2>/dev/null
    ((FAIL_COUNT++))
fi

echo ""
echo "============================================"
echo "              验证结果汇总"
echo "============================================"
echo -e "${GREEN}成功：$SUCCESS_COUNT 项${NC}"
echo -e "${RED}失败：$FAIL_COUNT 项${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！代码已完全修复！${NC}"
    echo ""
    echo "📌 下一步操作："
    echo "1. 打开微信开发者工具"
    echo "2. 执行：工具 → 构建 npm"
    echo "3. 执行：工具 → 清除缓存 → 全部清除"
    echo "4. 点击「编译」按钮"
    echo "5. 检查 Console 是否还有警告"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 发现问题！请检查失败的项目${NC}"
    echo ""
    echo "📌 建议操作："
    echo "1. 查看上面失败的检查项"
    echo "2. 手动修复相关文件"
    echo "3. 重新运行本验证脚本"
    echo ""
    exit 1
fi

