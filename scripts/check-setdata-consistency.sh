#!/bin/bash

# SetData一致性检查脚本
# 用途：检查WXML中的字段是否在对应的TS文件的setData中设置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 开始检查setData一致性..."
echo ""

# 统计变量
total_pages=0
issues_found=0

# 查找所有页面目录
find miniprogram/pages miniprogram/package* -type d -maxdepth 3 2>/dev/null | while read -r dir; do
  # 检查是否同时存在wxml和ts文件
  wxml_file=$(find "$dir" -maxdepth 1 -name "*.wxml" 2>/dev/null | head -1)
  ts_file=$(find "$dir" -maxdepth 1 -name "*.ts" ! -name "*.d.ts" ! -name "*.backup" 2>/dev/null | head -1)
  
  if [[ -z "$wxml_file" ]] || [[ -z "$ts_file" ]]; then
    continue
  fi
  
  # 排除types.d.ts等类型定义文件
  if [[ "$ts_file" == *"types.d.ts"* ]] || [[ "$ts_file" == *".backup"* ]]; then
    continue
  fi
  
  total_pages=$((total_pages + 1))
  page_name=$(basename "$dir")
  
  echo "📄 检查页面: $page_name"
  echo "   WXML: $wxml_file"
  echo "   TS:   $ts_file"
  
  # 提取WXML中的所有字段（{{xxx}}）
  wxml_fields=$(grep -oE '\{\{[a-zA-Z0-9_.]+\}\}' "$wxml_file" 2>/dev/null | \
                sed 's/{{//g' | sed 's/}}//g' | \
                sort | uniq)
  
  if [[ -z "$wxml_fields" ]]; then
    echo "   ${YELLOW}⚠️  WXML中没有数据绑定${NC}"
    echo ""
    continue
  fi
  
  # 检查每个字段
  has_issue=false
  missing_fields=()
  
  while IFS= read -r field; do
    # 跳过方法调用和特殊字段
    if [[ "$field" == *"("* ]] || [[ "$field" == "item"* ]] || [[ "$field" == "index" ]]; then
      continue
    fi
    
    # 提取字段的根名称（如userInfo.name -> userInfo）
    root_field=$(echo "$field" | cut -d. -f1)
    
    # 在TS文件中搜索setData设置该字段
    # 支持两种形式：
    # 1. 'fieldName': value  （路径更新）
    # 2. fieldName: value    （普通更新）
    if ! grep -q "setData" "$ts_file" 2>/dev/null; then
      continue
    fi
    
    # 检查是否有设置该字段（路径更新或普通更新）
    if ! grep -E "(\'$field\'|\"$field\"|\'$root_field\'|\"$root_field\"|^\s+$root_field:)" "$ts_file" > /dev/null 2>&1; then
      missing_fields+=("$field")
      has_issue=true
    fi
  done <<< "$wxml_fields"
  
  if $has_issue; then
    issues_found=$((issues_found + 1))
    echo "   ${RED}❌ 发现问题：以下字段在WXML中使用但未在setData中设置${NC}"
    for missing in "${missing_fields[@]}"; do
      echo "      - $missing"
    done
  else
    echo "   ${GREEN}✅ 通过检查${NC}"
  fi
  
  echo ""
done

echo "📊 检查完成"
echo "   总页面数: $total_pages"
echo "   发现问题: $issues_found"

if [[ $issues_found -gt 0 ]]; then
  echo ""
  echo "${YELLOW}⚠️  建议：${NC}"
  echo "1. 检查WXML中使用的字段是否都在setData中设置"
  echo "2. 确保条件渲染（wx:if）的字段也要设置"
  echo "3. 不要依赖data中的初始值"
  exit 1
else
  echo ""
  echo "${GREEN}✅ 所有页面通过检查${NC}"
  exit 0
fi
