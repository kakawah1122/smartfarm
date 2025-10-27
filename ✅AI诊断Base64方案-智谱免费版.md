# ✅ AI诊断Base64方案 - 智谱免费版

## 🎯 问题分析

### 1. 根本原因
- **智谱AI GLM-4V-Flash 要求使用Base64 Data URI格式**
- 不支持外部HTTPS URL（腾讯云存储临时链接）
- 错误代码：1210 "API调用参数有误"

### 2. 官方文档确认
```python
# 智谱AI官方示例
"image_url": {
    "url": f"data:image/jpeg;base64,{img_base64}"  # ✅ 必须是Data URI
}
# 不支持：
"image_url": {
    "url": "https://example.com/image.jpg"  # ❌ 不支持外部URL
}
```

## 🔧 解决方案

### 核心策略
**智能图片格式选择**：根据不同的AI模型provider自动选择最佳格式

```javascript
// 智谱AI（provider: '智谱AI'）
→ 使用 Base64 Data URI

// 其他API（OpenAI、SiliconFlow等）
→ 使用 HTTPS URL
```

### 关键优化
1. **限制图片数量**：智谱AI最多处理2张图片（控制请求体大小）
2. **保留高效方案**：其他API继续使用URL方式（请求体小）
3. **自动检测**：根据`modelId`自动选择格式

## 📝 代码修改

### 1. 修改 `processMessagesWithImages` 方法

```javascript
// ✅ 智能方案：智谱AI使用Base64，其他API使用URL
async processMessagesWithImages(messages, imageFileIDs = [], modelId = '') {
  const modelConfig = MODEL_CONFIGS[modelId]
  const useBase64 = modelConfig?.provider === '智谱AI'  // 智谱AI必须用Base64
  
  if (useBase64) {
    // 智谱AI：下载并转换为Base64
    for (let i = 0; i < Math.min(imageFileIDs.length, 2); i++) {  // 限制2张
      const dataUrl = await this.downloadImageToBase64(imageFileIDs[i])
      imageData.push(dataUrl)
    }
  } else {
    // 其他API：获取HTTPS临时URL（高效方案）
    const tempResult = await cloud.getTempFileURL({ fileList: imageFileIDs })
    // ...
  }
}
```

### 2. 更新调用位置

```javascript
// 传入模型ID以选择正确的格式
processedMessages = await manager.processMessagesWithImages(
  messages, 
  images, 
  modelsToTry[0]  // ✅ 传入第一个要尝试的模型ID
)
```

### 3. 移除不可用模型

```javascript
// ❌ qwen-vl模型在SiliconFlow不存在（错误码20012）
// 已注释禁用

'health_diagnosis_vision': {
  primary: 'glm-4v-flash',  // ✅ 智谱AI永久免费
  // 暂无可用的免费fallback模型
  timeout: 30000
}
```

## 🚀 部署步骤

### 1. 上传云函数
在微信开发者工具中：

1. **打开项目** `/Users/kakawah/Documents/鹅数通`

2. **部署 ai-multi-model 云函数**：
   - 右键点击 `cloudfunctions/ai-multi-model` 文件夹
   - 选择 **"上传并部署：云端安装依赖"**
   - 等待上传完成（约1-2分钟）

3. **确认部署成功**：
   - 查看微信开发者工具的控制台
   - 应该显示 "ai-multi-model 部署成功"

### 2. 测试AI诊断

1. **进入AI诊断页面**
2. **选择批次** - 1日龄批次
3. **输入症状**："雏鹅出现死亡，请分析死因"
4. **上传图片**：1-2张症状图片（建议图片大小<500KB）
5. **点击"提交诊断"**
6. **查看结果**：应该在10-15秒内返回诊断结果

### 3. 查看云函数日志

如果出现问题，在微信开发者工具中：
1. 点击 "云开发" → "云函数"
2. 找到 `ai-multi-model` 云函数
3. 点击 "日志" 查看详细错误信息

## 📊 预期效果

### 成功日志示例
```
====== 开始处理图片 ======
图片数量: 2
目标模型: glm-4v-flash
图片格式策略: Base64 Data URI（智谱AI要求）
开始下载并转换图片为Base64...
✅ 图片1 转换成功，大小: 245.6KB
✅ 图片2 转换成功，大小: 312.8KB
✅ 成功处理2张图片
====== 消息处理完成 ======
请求体大小: 约550KB

====== 调用智谱AI ======
模型: glm-4v-flash
包含图片: true
智谱AI调用成功!
```

### 请求体大小对比
- **Base64方式（2张图片）**：约500-800KB ✅ 可接受
- **Base64方式（3张图片）**：约1200KB+ ⚠️ 可能超限
- **URL方式**（如果支持）：约10KB 🚀 最佳

## ⚠️ 注意事项

### 1. 图片限制
- **智谱AI**：最多2张图片（自动限制）
- **建议图片大小**：每张<500KB
- **建议图片尺寸**：<1920x1080

### 2. 用户提示
如果用户上传了3张以上图片：
```
⚠️ 为控制请求大小，仅处理前2张图片（共3张）
```

### 3. 前端优化建议
**可选的未来优化**：在小程序端上传前压缩图片
```javascript
// 在 ai-diagnosis.ts 中添加图片压缩
wx.compressImage({
  src: tempFilePath,
  quality: 70,  // 压缩质量70%
  success: (res) => {
    // 上传压缩后的图片
  }
})
```

## 🎉 完成标志

- [x] 修复`hasImages is not defined`错误
- [x] 实现智能图片格式选择
- [x] 限制智谱AI图片数量为2张
- [x] 移除不可用的qwen-vl模型
- [x] 保留URL方式用于未来的其他API
- [ ] **待办**：在微信开发者工具中上传云函数
- [ ] **待办**：测试AI诊断功能

## 🔍 问题排查

### 如果仍然报错1210
1. 检查图片是否成功转换为Base64
2. 检查请求体大小是否<10MB
3. 查看云函数日志中的完整请求结构

### 如果诊断超时
1. 可能是图片太大，建议压缩
2. 可能是网络问题，重试一次
3. 查看云函数日志确认实际错误

## 📚 参考文档

- [智谱AI官方文档 - GLM-4V-Flash](https://docs.bigmodel.cn)
- [微信云开发文档 - 云函数](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html)
- [Base64 Data URI 格式](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs)

