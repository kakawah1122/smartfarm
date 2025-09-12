#!/bin/bash

# 健康管理模块云函数部署脚本
echo "🏥 开始部署健康管理模块云函数..."

# 检查当前目录
if [ ! -d "cloudfunctions" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 健康管理模块云函数列表
health_functions=("health-management" "ai-diagnosis" "setup-health-permissions")

echo "准备部署以下云函数："
for func in "${health_functions[@]}"; do
    echo "  - $func"
done
echo ""

for func in "${health_functions[@]}"; do
    echo "🔧 部署云函数: $func"
    
    # 检查目录是否存在
    if [ ! -d "cloudfunctions/$func" ]; then
        echo "⚠️  警告：云函数目录不存在 - cloudfunctions/$func"
        continue
    fi
    
    # 进入云函数目录
    cd "cloudfunctions/$func"
    
    # 检查是否有package.json
    if [ ! -f "package.json" ]; then
        echo "⚠️  警告：$func 缺少 package.json"
        cd "../.."
        continue
    fi
    
    echo "   📦 安装依赖..."
    # 安装依赖
    npm install --production
    
    if [ $? -eq 0 ]; then
        echo "   ✅ $func 依赖安装成功"
    else
        echo "   ❌ $func 依赖安装失败"
    fi
    
    # 返回项目根目录
    cd "../.."
done

echo ""
echo "🎉 健康管理模块云函数准备完成！"
echo ""
echo "📋 接下来的部署步骤："
echo "1. 打开微信开发者工具"
echo "2. 右键点击以下云函数，选择 '上传并部署：云端安装依赖'："
for func in "${health_functions[@]}"; do
    echo "   - cloudfunctions/$func"
done
echo "3. 等待所有云函数部署完成"
echo ""
echo "🔍 验证部署："
echo "- 在云开发控制台 -> 云函数中查看函数状态"
echo "- 确认所有函数显示为 '部署成功'"
echo ""
echo "💡 如需单独部署某个云函数，可以运行："
echo "   ./deploy_health_functions.sh health-management"
