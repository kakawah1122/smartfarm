#!/bin/bash

echo "🔄 开始刷新弹窗样式..."

# 进入项目目录
cd "$(dirname "$0")"

# 1. 清理样式缓存
echo "📝 清理样式缓存..."
rm -f miniprogram/components/bottom-popup/bottom-popup.wxss 2>/dev/null

# 2. 强制触发重新编译（修改时间戳）
echo "⚡ 强制重新编译..."
touch miniprogram/components/bottom-popup/bottom-popup.scss
touch miniprogram/components/bottom-popup/bottom-popup.wxml
touch miniprogram/components/bottom-popup/bottom-popup.ts

# 3. 显示当前的关键样式配置
echo ""
echo "✅ 当前弹窗按钮底部安全间距配置："
grep -A 2 "padding-bottom: calc" miniprogram/components/bottom-popup/bottom-popup.scss

echo ""
echo "🎯 完成！请在微信开发者工具中："
echo "   1. 点击「编译」按钮重新编译"
echo "   2. 或点击「清缓存」->「清除文件缓存」"
echo "   3. 然后重新上传到真机预览"
echo ""
echo "当前安全间距 = 133rpx(TabBar高度) + 80rpx(安全间距) + 设备底部安全区域"
echo "总计约 213rpx + 设备底部安全区域（iPhone X 等设备会更多）"

