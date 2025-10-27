# 🔧 GEMINI配置验证和排错指南

## 🎯 您当前的问题分析

根据您提供的日志，**问题不是GEMINI配置错误**！

### 实际情况

```
❌ 图片下载失败（旧图片已过期）
   ↓
⚠️ 自动降级为纯文本诊断
   ↓
✅ 使用siliconflow-qwen成功诊断
```

**结论**：GEMINI根本没有被调用，所以无法验证配置是否正确。

---

## ✅ 解决方案

### 方案1：重新上传图片测试（推荐）

这是最直接的方法，可以真正测试GEMINI的多模态能力。

**详细步骤**：

1. **进入AI诊断页面**
   ```
   打开小程序 → 点击"AI诊断"
   ```

2. **清除旧图片**
   ```
   如果页面上还显示之前的图片
   点击每张图片右上角的❌删除按钮
   ```

3. **上传新图片**
   ```
   点击"选择图片"按钮
   从相册选择2-3张清晰的症状图片
   或点击"拍摄照片"现场拍摄
   ```

4. **填写症状描述**
   ```
   输入详细的症状信息，例如：
   "1日龄雏鹅出现死亡，粪便呈白色，精神萎靡"
   ```

5. **立即提交诊断**
   ```
   上传完成后，不要等待
   立即点击"提交诊断"按钮
   ```

6. **查看日志验证**
   ```
   在微信开发者工具中查看云函数日志
   应该看到：
   
   ====== 调用 Google Gemini API ======
   模型: gemini-2.5-pro
   包含图片: true
   图片统计: 2张
   API URL: https://your-api.com/v1beta/models/gemini-2.5-pro:generateContent
   Gemini API调用成功!
   ```

**预期时间**：15-30秒

---

### 方案2：纯文本测试（快速验证配置）

如果您想快速验证GEMINI配置是否正确，可以先测试纯文本模式。

#### 步骤A：创建测试云函数

1. **创建测试文件**
   
   在 `cloudfunctions/` 目录下创建新文件夹 `test-gemini/`
   
   创建 `index.js`：
   ```javascript
   // 见 test-gemini-config.js 文件
   ```

2. **创建 package.json**
   ```json
   {
     "name": "test-gemini",
     "version": "1.0.0",
     "dependencies": {
       "wx-server-sdk": "latest",
       "axios": "^0.27.2"
     }
   }
   ```

3. **上传测试云函数**
   ```
   右键 test-gemini 文件夹
   → 上传并部署：云端安装依赖
   ```

4. **运行测试**
   ```
   在云函数控制台
   → 选择 test-gemini
   → 点击"测试"按钮
   ```

#### 步骤B：直接测试（简单方式）

**临时修改配置**（测试完记得改回来）：

```javascript
// 在 ai-multi-model/index.js 中临时修改
'health_diagnosis': {
  primary: 'gemini-2.5-pro',  // 临时改为GEMINI
  fallback: ['siliconflow-qwen', 'glm-4-free'],
  timeout: 15000
}
```

然后在小程序中**不上传图片**，只输入症状描述提交诊断。

---

## 🔍 配置验证清单

### 1. 环境变量检查

**在云开发控制台**：

- [ ] `GEMINI_API_KEY` 已配置
- [ ] `GEMINI_BASE_URL` 已配置
- [ ] API Key格式正确（通常以 `AIzaSy` 开头或您的轮询项目密钥）
- [ ] Base URL格式正确（`https://your-api.com`，无末尾斜杠）

**验证方法**：

在任意云函数中添加：
```javascript
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY?.substring(0, 10) + '...')
console.log('GEMINI_BASE_URL:', process.env.GEMINI_BASE_URL)
```

### 2. API格式检查

**您的轮询项目应该支持以下格式**：

```bash
POST {GEMINI_BASE_URL}/v1beta/models/gemini-2.5-pro:generateContent

Headers:
  Content-Type: application/json
  x-goog-api-key: {GEMINI_API_KEY}

Body:
{
  "contents": [
    {
      "parts": [
        {"text": "提示词"},
        {
          "inline_data": {
            "mime_type": "image/jpeg",
            "data": "base64数据..."
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "maxOutputTokens": 8192,
    "temperature": 0.7
  }
}
```

**确认事项**：

- [ ] 您的轮询项目使用GEMINI原生格式（不是OpenAI格式）
- [ ] endpoint路径是 `/v1beta/models/{model}:generateContent`
- [ ] 支持 `x-goog-api-key` header
- [ ] 支持 `inline_data` 格式的图片

### 3. 网络和权限检查

- [ ] 云函数可以访问外网
- [ ] 您的轮询项目服务正常运行
- [ ] API Key有足够的配额
- [ ] 没有IP白名单限制

---

## 🐛 常见错误和解决方案

### 错误1：`storage file not exists`（当前问题）

**原因**：图片文件已过期或不存在

**解决**：
1. 删除旧图片
2. 重新上传新图片
3. 立即提交诊断

---

### 错误2：`Request failed with status code 401`

**原因**：API Key无效或未配置

**检查**：
```javascript
// 在云函数中打印
console.log('API Key:', process.env.GEMINI_API_KEY ? '已配置' : '未配置')
```

**解决**：
1. 确认环境变量名称正确（`GEMINI_API_KEY`）
2. 确认API Key值正确
3. 检查API Key是否有前后空格
4. 重新上传云函数

---

### 错误3：`Request failed with status code 404`

**原因**：API URL不正确

**检查日志中的URL**：
```
API URL: https://your-api.com/v1beta/models/gemini-2.5-pro:generateContent
```

**可能的问题**：
- Base URL配置错误
- 轮询项目的endpoint路径不同
- 模型名称不匹配

**解决**：
1. 确认您的轮询项目实际endpoint
2. 可能需要调整为 `/v1/models/...` 或其他路径
3. 确认模型名称（gemini-2.5-pro vs gemini-pro）

---

### 错误4：`Request failed with status code 400`

**原因**：请求格式错误

**常见原因**：
1. 图片Base64格式不正确
2. API格式不匹配
3. 参数缺失或格式错误

**解决**：

如果您的轮询项目使用OpenAI兼容格式而不是GEMINI原生格式，需要修改代码：

```javascript
// 修改 callGemini 方法
const requestData = {
  model: 'gemini-2.5-pro',
  messages,  // OpenAI格式
  max_tokens: options.maxTokens || config.maxTokens
}

// 不需要转换为GEMINI原生格式
```

---

### 错误5：`Request failed with status code 429`

**原因**：速率限制

**解决**：
1. 等待一段时间
2. 检查API配额
3. 系统会自动降级到备选模型

---

## 📝 测试检查表

### 完整测试流程

- [ ] **步骤1**：确认环境变量已配置
- [ ] **步骤2**：上传ai-multi-model云函数
- [ ] **步骤3**：进入AI诊断页面
- [ ] **步骤4**：删除所有旧图片
- [ ] **步骤5**：上传2-3张新图片
- [ ] **步骤6**：填写症状描述
- [ ] **步骤7**：提交诊断
- [ ] **步骤8**：查看云函数日志
- [ ] **步骤9**：确认看到"调用 Google Gemini API"
- [ ] **步骤10**：确认返回诊断结果

---

## 🎯 快速验证命令

### 在云函数控制台运行

```javascript
// 快速测试代码
const axios = require('axios')

const apiKey = process.env.GEMINI_API_KEY
const baseURL = process.env.GEMINI_BASE_URL

console.log('API Key:', apiKey ? '✓ 已配置' : '✗ 未配置')
console.log('Base URL:', baseURL || '✗ 未配置')

if (apiKey && baseURL) {
  const url = `${baseURL}/v1beta/models/gemini-2.5-pro:generateContent`
  console.log('测试URL:', url)
  
  axios.post(url, {
    contents: [{
      parts: [{text: "Hi"}]
    }]
  }, {
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  }).then(res => {
    console.log('✓ API调用成功!')
    console.log('响应:', res.data)
  }).catch(err => {
    console.log('✗ API调用失败')
    console.log('错误:', err.response?.status, err.response?.data)
  })
}
```

---

## 📞 需要帮助？

### 收集以下信息

1. **完整的云函数日志**（包含GEMINI调用部分）
2. **环境变量配置**（不要发送实际的API Key，只说是否配置）
3. **您的轮询项目API格式**（GEMINI原生 or OpenAI兼容）
4. **错误代码和错误信息**

### 提供日志时注意

- ✅ 包含 `====== 调用 Google Gemini API ======` 开始的日志
- ✅ 包含错误状态码和错误数据
- ✅ 包含完整的错误堆栈
- ❌ 不要截断日志

---

## 🎊 成功标志

当您看到以下日志时，说明GEMINI配置成功：

```
====== 调用 Google Gemini API ======
模型: gemini-2.5-pro
消息数量: 2
包含图片: true
Gemini请求格式: {
  model: 'gemini-2.5-pro',
  contents数量: 1,
  第一个content的parts数量: 3
}
图片统计: 2张
API URL: https://your-api.com/v1beta/models/gemini-2.5-pro:generateContent
Gemini API调用成功!
返回内容长度: 1200
✅ 模型 gemini-2.5-pro 调用成功
```

---

**请先尝试"重新上传新图片"的方案，这是最简单直接的测试方法！** 🚀

