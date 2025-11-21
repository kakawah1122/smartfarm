#!/bin/bash

echo "📦 安装ESLint及相关依赖..."

# 安装ESLint核心包
npm install --save-dev eslint@^8.0.0

# 安装TypeScript相关
npm install --save-dev @typescript-eslint/parser@^5.0.0
npm install --save-dev @typescript-eslint/eslint-plugin@^5.0.0

# 安装其他可能需要的插件
npm install --save-dev eslint-plugin-import@^2.26.0

echo "✅ ESLint依赖安装完成"

# 添加lint命令到package.json
echo "📝 更新package.json中的scripts..."
node -e "
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = {
  ...packageJson.scripts,
  'lint': 'eslint miniprogram --ext .ts,.js',
  'lint:fix': 'eslint miniprogram --ext .ts,.js --fix'
};
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ package.json已更新');
"

echo "🎉 ESLint配置完成！"
echo ""
echo "使用方法："
echo "  npm run lint      # 检查代码"
echo "  npm run lint:fix  # 自动修复问题"
