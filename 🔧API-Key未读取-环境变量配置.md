# 🔧 API Key未读取 - 环境变量配置指南

## 🎯 问题

日志显示：
```
API Key前6位: undefined
错误: 401 "令牌已过期或验证不正确"
```

**原因**：云函数环境变量 `GLM4_API_KEY` 未配置或未读取到。

---

## ✅ 解决方案（2步配置）

### 第1步：在云开发控制台配置环境变量 ⭐

**打开控制台**：
```
微信开发者工具
→ 顶部菜单"云开发"
→ "云开发控制台"
```

**配置环境变量**：
```
1. 左侧菜单：云函数
2. 点击：ai-multi-model
3. 点击标签：函数配置
4. 找到：环境变量
5. 点击：编辑
6. 添加变量：
   - 键(Key): GLM4_API_KEY
   - 值(Value): 您的智谱AI API Key
7. 点击：保存 ✅
```

**示例**：
```
键：GLM4_API_KEY
值：79909699e2a14bcfa3456789abcdef.xxxxxx
    ↑
    您的完整API Key（通常以数字开头，包含点号和后缀）
```

---

### 第2步：重新上传云函数

**为什么需要重新上传**：
- 环境变量更改后，需要重新上传云函数才能生效

**操作**：
```
右键 cloudfunctions/ai-multi-model
→ "上传并部署：云端安装依赖"
→ 等待完成（约30秒）
```

---

## 🔍 如何获取智谱AI API Key

### 方式1：智谱AI官网

```
1. 访问：https://open.bigmodel.cn
2. 登录/注册账号
3. 进入控制台
4. API Keys → 创建新的API Key
5. 复制完整的API Key
```

### 方式2：检查现有配置

您可能已经配置过，请检查：
```
云开发控制台
→ 云函数
→ ai-multi-model
→ 函数配置
→ 环境变量
→ 查看是否已有 GLM4_API_KEY
```

---

## 📊 环境变量配置清单

**ai-multi-model 需要的环境变量**：

| 变量名 | 说明 | 是否必需 |
|--------|------|----------|
| `GLM4_API_KEY` | 智谱AI API密钥 | ✅ 必需（视觉诊断） |
| `siliconflow_API_KEY` | SiliconFlow API密钥 | ✅ 必需（备选） |
| `DEEPSEEK_API_KEY` | DeepSeek API密钥 | ⚠️ 可选 |
| `MOONSHOT_API_KEY` | 月之暗面API密钥 | ⚠️ 可选 |
| `GROQ_API_KEY` | Groq API密钥 | ⚠️ 可选 |

**最少需要配置**：
- `GLM4_API_KEY`（智谱AI - 用于视觉诊断）
- `siliconflow_API_KEY`（SiliconFlow - 用于备选）

---

## 🎯 验证配置是否成功

### 方法1：查看日志

配置并重新上传后，提交诊断，查看日志：

**成功标志**：
```
====== 调用智谱AI ======
API Key前6位: 799096  ← 显示前6位数字 ✅
模型: glm-4v-flash
```

**失败标志**：
```
API Key前6位: undefined  ← 还是undefined ❌
```

### 方法2：测试诊断

```
1. 上传1张图片
2. 提交诊断
3. 查看结果：
   - 成功：显示诊断结果 ✅
   - 失败：继续排查
```

---

## ⚠️ 常见问题

### Q1: 配置了但还是undefined？

**原因**：未重新上传云函数

**解决**：
```
1. 再次右键 ai-multi-model
2. 选择"上传并部署：云端安装依赖"
3. 等待上传完成
4. 等待2分钟
5. 再次测试
```

### Q2: API Key格式是什么样的？

**智谱AI**：
```
格式：数字.字母数字混合
示例：79909699e2a14bcf.xxxxxxxxxxxxxx
长度：约50-60字符
```

### Q3: 如何确认API Key有效？

**测试方法**：
```bash
curl https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "glm-4-flash",
    "messages": [{"role":"user","content":"你好"}]
  }'
```

如果返回正常响应，说明Key有效。

### Q4: 需要配置多个环境变量吗？

**最少配置**：
- 只配置 `GLM4_API_KEY` 即可使用视觉诊断
- 如果失败，会自动降级到文本诊断（需要 `siliconflow_API_KEY`）

**推荐配置**：
```
GLM4_API_KEY: 智谱AI（主力）
siliconflow_API_KEY: SiliconFlow（备选）
```

---

## 🚀 完整操作流程

### 步骤1：获取API Key
```
智谱AI官网 → 控制台 → API Keys → 创建 → 复制
```

### 步骤2：配置环境变量
```
云开发控制台
→ ai-multi-model
→ 函数配置
→ 环境变量
→ 添加 GLM4_API_KEY
→ 保存
```

### 步骤3：上传云函数
```
右键 ai-multi-model
→ "上传并部署：云端安装依赖"
```

### 步骤4：等待生效
```
等待2分钟（配置生效时间）
```

### 步骤5：测试
```
上传图片 → 提交诊断 → 查看日志
```

---

## 💡 额外说明

### 关于智谱AI GLM-4V-Flash

**特点**：
- ✅ 永久免费
- ✅ 支持视觉识别
- ✅ 最多2张图片
- ✅ 响应速度：15-25秒

**API文档**：
https://open.bigmodel.cn/dev/api#glm-4v

### 关于降级策略

如果 `glm-4v-flash` 失败：
```
glm-4v-flash (视觉) 失败
  ↓
siliconflow-qwen (文本) 备选1
  ↓
glm-4-free (文本) 备选2
  ↓
降级为纯文本诊断（不使用图片）
```

---

## 📝 快速检查清单

- [ ] 已在云开发控制台配置 GLM4_API_KEY
- [ ] API Key格式正确（包含点号）
- [ ] 已重新上传 ai-multi-model 云函数
- [ ] 等待2分钟配置生效
- [ ] 测试上传1张图片
- [ ] 查看日志确认 API Key 前6位显示正常

---

**现在请按照步骤配置环境变量！** 🚀

配置完成后重新上传云函数，问题就会解决！

