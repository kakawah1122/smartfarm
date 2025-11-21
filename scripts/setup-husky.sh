#!/bin/bash

echo "🐶 配置Git钩子（Husky）..."

# 安装husky
npm install --save-dev husky@^8.0.0

# 启用Git钩子
npx husky install

# 创建.husky目录
mkdir -p .husky

# 添加pre-commit钩子权限
chmod +x .husky/pre-commit

# 在package.json中添加prepare脚本
node -e "
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = {
  ...packageJson.scripts,
  'prepare': 'husky install'
};
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ package.json已更新');
"

echo "✅ Git钩子配置完成！"
echo ""
echo "钩子功能："
echo "  • 提交前自动检查代码规范"
echo "  • 提交前自动检查TypeScript"
echo "  • 提交前自动检查样式问题"
echo ""
echo "如需跳过检查，可使用: git commit --no-verify"
