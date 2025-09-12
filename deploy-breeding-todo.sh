#!/bin/bash
# deploy-breeding-todo.sh - 待办事项系统一键部署脚本

echo "🚀 开始部署待办事项系统..."
echo "========================================"

# 检查当前目录
if [ ! -d "cloudfunctions" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

echo "📂 检查项目结构..."

# 检查必要文件
required_files=(
    "cloudfunctions/production-entry/index.js"
    "cloudfunctions/production-entry/breeding-schedule.js"
    "cloudfunctions/breeding-todo/index.js"
    "miniprogram/pages/breeding-todo/breeding-todo.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 缺失"
        exit 1
    fi
done

echo ""
echo "📦 检查修改内容..."

# 检查关键修改点
echo "🔍 检查 production-entry 修改..."
if grep -q "createBatchTodos" cloudfunctions/production-entry/index.js; then
    echo "✅ production-entry 已包含 createBatchTodos 函数"
else
    echo "❌ production-entry 缺少 createBatchTodos 函数"
    exit 1
fi

echo "🔍 检查 breeding-todo 修改..."
if grep -q "getBatchTasks" cloudfunctions/breeding-todo/index.js; then
    echo "✅ breeding-todo 已包含新的任务查询接口"
else
    echo "❌ breeding-todo 缺少新的查询接口"
    exit 1
fi

echo "🔍 检查前端修改..."
if grep -q "getTodayTasks" miniprogram/pages/breeding-todo/breeding-todo.ts; then
    echo "✅ 前端已适配新的数据接口"
else
    echo "❌ 前端缺少数据接口适配"
    exit 1
fi

echo ""
echo "🎯 部署准备完成！接下来请手动执行以下步骤："
echo ""
echo "📱 在微信开发者工具中："
echo "1️⃣  右键 cloudfunctions/production-entry → 上传并部署"
echo "2️⃣  右键 cloudfunctions/breeding-todo → 上传并部署"
echo "3️⃣  点击"编译"按钮编译小程序"
echo ""
echo "🧪 部署完成后验证："
echo "4️⃣  在控制台运行 verify-todo-system.js 脚本"
echo "5️⃣  确保所有测试通过：✅ 通过: 5/5"
echo ""
echo "🎉 然后就可以测试新功能了："
echo "📝 入栏管理 → 新增入栏 → 查看自动生成的待办事项"
echo ""
echo "========================================"
echo "✅ 预检查完成，可以开始部署！"
