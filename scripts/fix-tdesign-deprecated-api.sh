#!/bin/bash

# 修复 TDesign 中已弃用的 getSystemInfoSync API
# 此脚本应在构建 npm 后运行
# 使用方法：在微信开发者工具中执行 "工具 → 构建 npm" 后，运行此脚本

echo "🔧 修复 TDesign 中的已弃用 API..."

TARGET_FILE="miniprogram/miniprogram_npm/tdesign-miniprogram/common/wechat.js"

if [ ! -f "$TARGET_FILE" ]; then
    echo "⚠️  文件不存在: $TARGET_FILE"
    echo "   请先执行：工具 → 构建 npm"
    exit 0
fi

# 检查是否包含 getSystemInfoSync
if grep -q "getSystemInfoSync" "$TARGET_FILE"; then
    echo "📝 发现 getSystemInfoSync，正在修复..."
    
    # 备份原文件
    cp "$TARGET_FILE" "${TARGET_FILE}.bak"
    
    # 读取文件内容
    CONTENT=$(cat "$TARGET_FILE")
    
    # 替换 getWindowInfo 函数：移除 getSystemInfoSync fallback，使用新 API
    CONTENT=$(echo "$CONTENT" | sed 's/getWindowInfo=()=>wx\.getWindowInfo&&wx\.getWindowInfo()||wx\.getSystemInfoSync()/getWindowInfo=()=>{try{return wx.getWindowInfo()}catch(e){return{windowWidth:375,windowHeight:667,pixelRatio:2,statusBarHeight:44,screenWidth:375,screenHeight:667,safeArea:{left:0,right:375,top:44,bottom:667,width:375,height:623}}}}/g')
    
    # 替换 getAppBaseInfo 函数
    CONTENT=$(echo "$CONTENT" | sed 's/getAppBaseInfo=()=>wx\.getAppBaseInfo&&wx\.getAppBaseInfo()||wx\.getSystemInfoSync()/getAppBaseInfo=()=>{try{return wx.getAppBaseInfo()}catch(e){return{version:'\'''\'',language:'\''zh_CN'\'',SDKVersion:'\''2.0.0'\'',theme:'\''light'\''}}}/g')
    
    # 替换 getDeviceInfo 函数
    CONTENT=$(echo "$CONTENT" | sed 's/getDeviceInfo=()=>wx\.getDeviceInfo&&wx\.getDeviceInfo()||wx\.getSystemInfoSync()/getDeviceInfo=()=>{try{return wx.getDeviceInfo()}catch(e){return{brand:'\''unknown'\'',model:'\''unknown'\'',system:'\''unknown'\'',platform:'\''devtools'\''}}}/g')
    
    # 写回文件
    echo "$CONTENT" > "$TARGET_FILE"
    
    # 如果替换后文件为空或有问题，恢复备份
    if [ ! -s "$TARGET_FILE" ]; then
        echo "❌ 修复失败，恢复备份文件"
        mv "${TARGET_FILE}.bak" "$TARGET_FILE"
        exit 1
    fi
    
    # 检查是否成功移除
    if grep -q "getSystemInfoSync" "$TARGET_FILE"; then
        echo "⚠️  仍有 getSystemInfoSync 引用，需要手动检查"
        echo "   备份文件已保存为: ${TARGET_FILE}.bak"
    else
        echo "✅ 成功移除 getSystemInfoSync"
        rm -f "${TARGET_FILE}.bak"
    fi
else
    echo "✅ 未发现 getSystemInfoSync，无需修复"
fi

echo "✨ 修复完成！"

