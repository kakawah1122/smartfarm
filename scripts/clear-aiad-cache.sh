#!/bin/bash

echo "======================================"
echo "开始清理 AIAD 性能分析缓存"
echo "======================================"
echo ""

# 1. 关闭微信开发者工具
echo "步骤 1/5: 检查微信开发者工具进程..."
if pgrep -f "wechatwebdevtools" > /dev/null; then
    echo "正在关闭微信开发者工具..."
    killall -9 wechatwebdevtools 2>/dev/null || true
    sleep 2
    echo "✅ 已关闭微信开发者工具"
else
    echo "✅ 微信开发者工具未运行"
fi
echo ""

# 2. 清理项目缓存
echo "步骤 2/5: 清理项目缓存..."
rm -rf miniprogram/.DS_Store
rm -rf miniprogram/**/.DS_Store
rm -rf .wxcache 2>/dev/null || true
rm -rf miniprogram/.wxcache 2>/dev/null || true
rm -rf .aiad 2>/dev/null || true
rm -rf miniprogram/.aiad 2>/dev/null || true
echo "✅ 项目缓存已清理"
echo ""

# 3. 清理开发者工具缓存
echo "步骤 3/5: 清理开发者工具缓存..."
WECHAT_CACHE_DIR="$HOME/Library/Application Support/微信web开发者工具"
if [ -d "$WECHAT_CACHE_DIR" ]; then
    rm -rf "$WECHAT_CACHE_DIR/Default/Cache" 2>/dev/null || true
    rm -rf "$WECHAT_CACHE_DIR/Default/Code Cache" 2>/dev/null || true
    rm -rf "$WECHAT_CACHE_DIR/Default/GPUCache" 2>/dev/null || true
    rm -rf "$WECHAT_CACHE_DIR/Default/DawnCache" 2>/dev/null || true
    rm -rf "$WECHAT_CACHE_DIR/Default/Service Worker" 2>/dev/null || true
    echo "✅ 开发者工具缓存已清理"
else
    echo "⚠️  未找到开发者工具缓存目录"
fi
echo ""

# 4. 清理编译缓存
echo "步骤 4/5: 清理编译缓存..."
rm -rf miniprogram/miniprogram_npm 2>/dev/null || true
rm -rf .tea 2>/dev/null || true
echo "✅ 编译缓存已清理"
echo ""

# 5. 验证配置
echo "步骤 5/5: 验证配置..."
if grep -q '"disableAIPerformanceAnalysis": true' project.config.json && \
   grep -q '"disablePerformanceMonitor": true' project.config.json; then
    echo "✅ project.config.json 配置正确"
else
    echo "⚠️  project.config.json 配置可能不完整"
fi

if grep -q '"disableAIPerformanceAnalysis": true' project.private.config.json && \
   grep -q '"disablePerformanceMonitor": true' project.private.config.json; then
    echo "✅ project.private.config.json 配置正确"
else
    echo "⚠️  project.private.config.json 配置可能不完整"
fi
echo ""

echo "======================================"
echo "✅ 清理完成！"
echo "======================================"
echo ""
echo "接下来请按以下步骤操作："
echo "1. 打开微信开发者工具"
echo "2. 点击「工具」→「清除缓存」→「清除全部缓存」"
echo "3. 点击「工具」→「构建 npm」"
echo "4. 关闭并重新打开项目"
echo "5. 如果还有错误，请在开发者工具中：设置 → 通用 → 关闭「启用性能监控」"
echo ""
