#!/bin/bash

# 🎨 UI 设计规范检查脚本
# 用于在提交前检查是否违反了 UI 设计规范

set -e

echo "🎨 开始检查 UI 设计规范..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查结果
violations=0

# 1. 检查是否使用了粗边框（border-width > 2rpx）
echo "📏 检查粗边框使用情况..."

# 检查 border-left
border_left_violations=$(grep -rn "border-left.*[3-9]rpx\|border-left.*[1-9][0-9]rpx" miniprogram --include="*.scss" --include="*.wxss" || true)

if [ -n "$border_left_violations" ]; then
  echo -e "${RED}❌ 发现违规：使用了粗左边框（border-left > 2rpx）${NC}"
  echo "$border_left_violations"
  violations=$((violations + 1))
  echo ""
fi

# 检查 border-right
border_right_violations=$(grep -rn "border-right.*[3-9]rpx\|border-right.*[1-9][0-9]rpx" miniprogram --include="*.scss" --include="*.wxss" || true)

if [ -n "$border_right_violations" ]; then
  echo -e "${RED}❌ 发现违规：使用了粗右边框（border-right > 2rpx）${NC}"
  echo "$border_right_violations"
  violations=$((violations + 1))
  echo ""
fi

# 检查 border-top
border_top_violations=$(grep -rn "border-top.*[3-9]rpx\|border-top.*[1-9][0-9]rpx" miniprogram --include="*.scss" --include="*.wxss" || true)

if [ -n "$border_top_violations" ]; then
  echo -e "${RED}❌ 发现违规：使用了粗上边框（border-top > 2rpx）${NC}"
  echo "$border_top_violations"
  violations=$((violations + 1))
  echo ""
fi

# 检查 border-bottom
border_bottom_violations=$(grep -rn "border-bottom.*[3-9]rpx\|border-bottom.*[1-9][0-9]rpx" miniprogram --include="*.scss" --include="*.wxss" || true)

if [ -n "$border_bottom_violations" ]; then
  echo -e "${RED}❌ 发现违规：使用了粗下边框（border-bottom > 2rpx）${NC}"
  echo "$border_bottom_violations"
  violations=$((violations + 1))
  echo ""
fi

# 2. 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $violations -eq 0 ]; then
  echo -e "${GREEN}✅ 恭喜！所有 UI 样式符合设计规范${NC}"
  echo ""
  echo "📖 查看完整规范：UI_DESIGN_GUIDELINES.md"
  exit 0
else
  echo -e "${RED}❌ 发现 $violations 处违反 UI 设计规范${NC}"
  echo ""
  echo "💡 建议："
  echo "   1. 移除粗边框（border-width > 2rpx）"
  echo "   2. 使用背景色、阴影、细边框等替代方案"
  echo ""
  echo "📖 查看详细规范和替代方案："
  echo "   ./UI_DESIGN_GUIDELINES.md"
  echo ""
  exit 1
fi

