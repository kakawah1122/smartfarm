#!/bin/bash

# 云函数清理脚本
# 清理确认无用的云函数

echo "========================================="
echo "云函数清理脚本"
echo "========================================="
echo ""

# 备份目录
BACKUP_DIR="cloudfunctions-backup-$(date +%Y%m%d-%H%M%S)"

echo "1. 创建备份目录: $BACKUP_DIR"
mkdir -p $BACKUP_DIR

# 需要删除的云函数列表
FUNCTIONS_TO_DELETE=(
  "notification-management"
  "process-ai-diagnosis"
  "production-management"
  "production-upload"
)

echo "2. 备份即将删除的云函数..."
for func in "${FUNCTIONS_TO_DELETE[@]}"; do
  if [ -d "cloudfunctions/$func" ]; then
    echo "   备份: $func"
    cp -r "cloudfunctions/$func" "$BACKUP_DIR/"
  fi
done

echo ""
echo "3. 确认删除以下云函数："
echo "   - notification-management (通知功能未实现)"
echo "   - process-ai-diagnosis (功能已合并)"
echo "   - production-management (功能已拆分)"
echo "   - production-upload (功能已废弃)"
echo ""
read -p "确认删除？(y/n): " confirm

if [ "$confirm" = "y" ]; then
  echo ""
  echo "4. 开始删除云函数..."
  for func in "${FUNCTIONS_TO_DELETE[@]}"; do
    if [ -d "cloudfunctions/$func" ]; then
      echo "   删除: $func"
      rm -rf "cloudfunctions/$func"
    fi
  done
  echo ""
  echo "✅ 清理完成！"
  echo "备份保存在: $BACKUP_DIR"
else
  echo ""
  echo "❌ 已取消删除"
fi

echo ""
echo "========================================="
echo "云函数统计："
echo "========================================="
echo "剩余云函数数量: $(ls -d cloudfunctions/*/ 2>/dev/null | wc -l)"
echo ""
ls -d cloudfunctions/*/ 2>/dev/null | sed 's|cloudfunctions/||' | sed 's|/||'
