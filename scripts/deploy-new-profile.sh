#!/bin/bash
# 部署新个人中心页面脚本
# 
# 功能：
# 1. 备份现有profile页面
# 2. 启用新的profile页面
# 3. 验证文件完整性

set -e  # 遇到错误立即退出

echo "========================================="
echo "  部署新个人中心页面"
echo "========================================="
echo ""

# 定义路径
PROFILE_DIR="miniprogram/pages/profile"
BACKUP_DIR="${PROFILE_DIR}/backup_$(date +%Y%m%d_%H%M%S)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "步骤 1/4: 检查文件是否存在..."

# 检查新文件是否存在
if [ ! -f "${PROFILE_DIR}/profile-new.wxml" ]; then
    echo -e "${RED}错误: profile-new.wxml 文件不存在${NC}"
    exit 1
fi

if [ ! -f "${PROFILE_DIR}/profile-new.scss" ]; then
    echo -e "${RED}错误: profile-new.scss 文件不存在${NC}"
    exit 1
fi

if [ ! -f "${PROFILE_DIR}/profile-new.ts" ]; then
    echo -e "${RED}错误: profile-new.ts 文件不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 新文件检查通过${NC}"
echo ""

echo "步骤 2/4: 备份现有文件..."

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 备份现有文件
if [ -f "${PROFILE_DIR}/profile.wxml" ]; then
    cp "${PROFILE_DIR}/profile.wxml" "${BACKUP_DIR}/profile.wxml.bak"
    echo "  - 备份 profile.wxml"
fi

if [ -f "${PROFILE_DIR}/profile.scss" ]; then
    cp "${PROFILE_DIR}/profile.scss" "${BACKUP_DIR}/profile.scss.bak"
    echo "  - 备份 profile.scss"
fi

if [ -f "${PROFILE_DIR}/profile.ts" ]; then
    cp "${PROFILE_DIR}/profile.ts" "${BACKUP_DIR}/profile.ts.bak"
    echo "  - 备份 profile.ts"
fi

echo -e "${GREEN}✓ 备份完成: ${BACKUP_DIR}${NC}"
echo ""

echo "步骤 3/4: 替换为新文件..."

# 替换文件
cp "${PROFILE_DIR}/profile-new.wxml" "${PROFILE_DIR}/profile.wxml"
echo "  - 替换 profile.wxml"

cp "${PROFILE_DIR}/profile-new.scss" "${PROFILE_DIR}/profile.scss"
echo "  - 替换 profile.scss"

cp "${PROFILE_DIR}/profile-new.ts" "${PROFILE_DIR}/profile.ts"
echo "  - 替换 profile.ts"

echo -e "${GREEN}✓ 文件替换完成${NC}"
echo ""

echo "步骤 4/4: 验证文件完整性..."

# 验证文件存在
if [ ! -f "${PROFILE_DIR}/profile.wxml" ] || \
   [ ! -f "${PROFILE_DIR}/profile.scss" ] || \
   [ ! -f "${PROFILE_DIR}/profile.ts" ]; then
    echo -e "${RED}错误: 文件替换后验证失败${NC}"
    echo "正在恢复备份..."
    
    # 恢复备份
    if [ -f "${BACKUP_DIR}/profile.wxml.bak" ]; then
        cp "${BACKUP_DIR}/profile.wxml.bak" "${PROFILE_DIR}/profile.wxml"
    fi
    if [ -f "${BACKUP_DIR}/profile.scss.bak" ]; then
        cp "${BACKUP_DIR}/profile.scss.bak" "${PROFILE_DIR}/profile.scss"
    fi
    if [ -f "${BACKUP_DIR}/profile.ts.bak" ]; then
        cp "${BACKUP_DIR}/profile.ts.bak" "${PROFILE_DIR}/profile.ts"
    fi
    
    echo -e "${YELLOW}已恢复原文件${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 文件验证通过${NC}"
echo ""

echo "========================================="
echo -e "${GREEN}部署成功！${NC}"
echo "========================================="
echo ""
echo "后续步骤："
echo "1. 在微信开发者工具中编译小程序"
echo "2. 测试个人中心功能"
echo "3. 如有问题，备份文件位于: ${BACKUP_DIR}"
echo ""
echo "恢复备份命令："
echo "  cp ${BACKUP_DIR}/profile.wxml.bak ${PROFILE_DIR}/profile.wxml"
echo "  cp ${BACKUP_DIR}/profile.scss.bak ${PROFILE_DIR}/profile.scss"
echo "  cp ${BACKUP_DIR}/profile.ts.bak ${PROFILE_DIR}/profile.ts"
echo ""

