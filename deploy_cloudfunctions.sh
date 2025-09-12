#!/bin/bash

# 部署云函数脚本
echo "开始部署云函数..."

# 检查当前目录
if [ ! -d "cloudfunctions" ]; then
    echo "错误：请在项目根目录运行此脚本"
    exit 1
fi

# 要部署的云函数列表
if [ $# -eq 0 ]; then
    # 默认部署的云函数列表（包含健康管理模块）
    functions=("employee-invite-management" "user-management" "login" "notification-management" "health-management" "ai-diagnosis" "setup-health-permissions")
else
    # 使用命令行参数指定的云函数
    functions=("$@")
fi

for func in "${functions[@]}"; do
    echo "部署云函数: $func"
    
    # 检查目录是否存在
    if [ ! -d "cloudfunctions/$func" ]; then
        echo "警告：云函数目录不存在 - cloudfunctions/$func"
        continue
    fi
    
    # 进入云函数目录
    cd "cloudfunctions/$func"
    
    # 检查是否有package.json
    if [ ! -f "package.json" ]; then
        echo "警告：$func 缺少 package.json"
        cd "../.."
        continue
    fi
    
    # 安装依赖
    echo "安装 $func 的依赖..."
    npm install
    
    # 返回项目根目录
    cd "../.."
    
    echo "✅ $func 准备就绪"
done

echo ""
echo "所有云函数准备完成！"
echo "请使用微信开发者工具的云函数上传功能完成部署。"
echo ""
echo "部署步骤："
echo "1. 打开微信开发者工具"
echo "2. 右键点击 cloudfunctions 文件夹"
echo "3. 选择 '上传并部署：云端安装依赖'"
echo "4. 等待部署完成"
