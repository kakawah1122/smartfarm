# 🔧 SiliconFlow API 配置指南

## 🎯 为什么需要配置SiliconFlow

SiliconFlow提供**完全免费**的大模型API服务，作为智谱AI的备选方案：
- ✅ 完全免费（新用户2000万Tokens）
- ✅ 高速响应
- ✅ 多种模型可选
- ✅ 稳定可靠

---

## 📋 获取API Key（5分钟）

### 第1步：注册账号

**访问官网**：
```
https://siliconflow.cn
或
https://cloud.siliconflow.cn
```

**注册步骤**：
```
1. 点击 "注册" 或 "登录"
2. 支持以下方式：
   - 手机号注册
   - 邮箱注册
   - 微信扫码登录
   - GitHub登录
3. 完成注册验证
```

**💡 提示**：新用户注册后自动获赠**2000万Tokens**免费额度！

---

### 第2步：进入控制台

**登录后**：
```
1. 点击右上角头像
2. 选择 "控制台" 或 "API管理"
3. 或直接访问：https://cloud.siliconflow.cn/account/ak
```

---

### 第3步：创建API Key

**在控制台页面**：
```
1. 左侧菜单：API密钥 或 API Keys
2. 点击：创建API密钥 或 Create API Key
3. 填写：
   - 名称：鹅数通小程序（或其他备注名称）
   - 有效期：永久（推荐）或自定义
4. 点击：创建
5. ⚠️ 重要：立即复制保存API Key
   （创建后只显示一次！）
```

**API Key格式示例**：
```
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
↑
以 sk- 开头，后面是随机字符串
长度约40-50字符
```

---

### 第4步：保存API Key

**建议保存到安全的地方**：
- 密码管理器
- 加密笔记
- 本地文档（不要提交到Git）

**⚠️ 安全提示**：
- API Key只显示一次
- 如果丢失，需要删除重新创建
- 不要分享给他人
- 不要提交到公开代码库

---

## ⚙️ 配置到云函数

### 在微信云开发控制台配置

**步骤**：
```
1. 打开云开发控制台
   微信开发者工具 → 顶部"云开发" → "云开发控制台"

2. 进入云函数配置
   左侧菜单：云函数
   → 点击：ai-multi-model
   → 点击标签：函数配置

3. 配置环境变量
   找到：环境变量
   → 点击：编辑
   → 添加变量：
      键：siliconflow_API_KEY
      值：sk-xxxxxxxx（您的完整API Key）
   → 点击：保存 ✅

4. 重新上传云函数
   右键 cloudfunctions/ai-multi-model
   → "上传并部署：云端安装依赖"
   → 等待完成
```

---

## 🎯 验证配置

### 方法1：查看日志

**测试后查看云函数日志**：

**成功标志**：
```
====== 调用 SiliconFlow API ======
模型: Qwen/Qwen2.5-72B-Instruct
API调用成功 ✅
```

**失败标志**：
```
错误: 401 Unauthorized
或
API Key前6位: undefined
```

### 方法2：在SiliconFlow控制台查看使用量

```
控制台 → API使用统计 或 Usage
→ 查看今日调用次数
→ 如果有调用记录，说明配置成功 ✅
```

---

## 💡 SiliconFlow 免费额度

### 新用户福利

```
注册即送：2000万 Tokens
有效期：永久（或根据政策）
```

### 如何查看剩余额度

```
控制台 → 账户信息 或 Account
→ Token余额
→ 使用统计
```

### 额度用完后

```
1. 可以充值（价格很便宜）
2. 或切换到其他免费模型（如智谱AI）
3. 系统会自动切换到备选模型
```

---

## 🚀 SiliconFlow 可用模型

### 文本模型（免费）

| 模型 | 说明 | 适用场景 |
|------|------|----------|
| `Qwen/Qwen2.5-72B-Instruct` | 通义千问2.5 | 通用对话、诊断 ✅ |
| `deepseek-ai/DeepSeek-V2.5` | DeepSeek V2.5 | 深度推理 |
| `meta-llama/Meta-Llama-3.1-8B-Instruct` | Llama 3.1 | 快速响应 |

### 当前在鹅数通中的使用

```javascript
// 配置在 ai-multi-model/index.js
'siliconflow-qwen': {
  model: 'Qwen/Qwen2.5-72B-Instruct',  // 主力模型
  costPerKToken: 0,  // 完全免费
}

'siliconflow-deepseek': {
  model: 'deepseek-ai/DeepSeek-V2.5',  // 备选
  costPerKToken: 0,  // 完全免费
}
```

---

## ⚠️ 常见问题

### Q1: API Key创建后在哪里查看？

**答**：
- API Key **只在创建时显示一次**
- 之后无法再查看完整Key
- 如果丢失，需要删除重新创建

### Q2: 如何删除或重新创建API Key？

**答**：
```
控制台 → API密钥
→ 找到要删除的Key
→ 点击：删除 或 Delete
→ 确认删除
→ 重新创建新的Key
```

### Q3: 免费额度会过期吗？

**答**：
- 根据SiliconFlow政策而定
- 一般新用户赠送的额度有效期较长
- 建议在控制台查看具体政策

### Q4: 可以创建多个API Key吗？

**答**：
- 可以
- 每个Key可以设置不同的名称和权限
- 用于不同的项目或环境

### Q5: 配置后还是401错误？

**检查**：
1. API Key是否完整复制（以`sk-`开头）
2. 环境变量名称是否正确：`siliconflow_API_KEY`（注意大小写）
3. 是否重新上传了云函数
4. 是否等待2分钟配置生效

---

## 📊 完整配置清单

### 需要配置的环境变量

**微信云开发控制台 → ai-multi-model → 函数配置 → 环境变量**：

| 变量名 | 说明 | 优先级 |
|--------|------|--------|
| `GLM4_API_KEY` | 智谱AI（视觉诊断主力） | ⭐⭐⭐⭐⭐ 必需 |
| `siliconflow_API_KEY` | SiliconFlow（备选） | ⭐⭐⭐⭐ 强烈推荐 |
| `DEEPSEEK_API_KEY` | DeepSeek（可选） | ⭐⭐ 可选 |

**最少配置**：
- `GLM4_API_KEY`：用于视觉诊断
- `siliconflow_API_KEY`：用于备选和降级

---

## 🎊 配置完成后的效果

### 系统会自动选择最优模型

```
带图片诊断：
  1. glm-4v-flash（智谱AI视觉）✅ 优先
  2. siliconflow-qwen（文本降级）✅ 备选
  3. glm-4-free（文本备选）✅ 兜底

纯文本诊断：
  1. siliconflow-qwen ✅ 优先
  2. glm-4-free ✅ 备选
  3. deepseek-chat ✅ 兜底
```

### 自动切换策略

```
如果智谱AI限额用完 → 自动切换到SiliconFlow
如果SiliconFlow限额用完 → 自动切换到DeepSeek
完全无需手动干预 🎉
```

---

## 🔗 有用链接

- **SiliconFlow官网**：https://siliconflow.cn
- **控制台**：https://cloud.siliconflow.cn/account/ak
- **API文档**：https://docs.siliconflow.cn
- **模型列表**：https://cloud.siliconflow.cn/models

---

## 📝 快速操作清单

- [ ] 访问 siliconflow.cn 注册账号
- [ ] 进入控制台（https://cloud.siliconflow.cn/account/ak）
- [ ] 创建API密钥
- [ ] 复制并保存API Key（以sk-开头）
- [ ] 打开微信云开发控制台
- [ ] ai-multi-model → 函数配置 → 环境变量
- [ ] 添加 `siliconflow_API_KEY`
- [ ] 保存
- [ ] 重新上传 ai-multi-model 云函数
- [ ] 等待2分钟
- [ ] 测试 ✅

---

**现在就去获取SiliconFlow API Key！** 🚀

完全免费，2000万Tokens够用很久了！

