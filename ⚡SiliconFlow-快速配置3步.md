# ⚡ SiliconFlow 快速配置 3步

## 🎯 为什么配置SiliconFlow

作为智谱AI的**免费备选方案**：
- ✅ 完全免费（2000万Tokens）
- ✅ 高速稳定
- ✅ 智能降级备选

---

## 📋 3步配置（5分钟）

### 第1步：获取API Key 🔑

**访问**：https://siliconflow.cn

**操作**：
```
1. 注册/登录账号
   - 手机号、邮箱或微信登录
   
2. 进入控制台
   - 点击右上角头像 → "控制台"
   - 或访问：https://cloud.siliconflow.cn/account/ak

3. 创建API密钥
   - 左侧菜单：API密钥
   - 点击：创建API密钥
   - 名称：鹅数通（或任意名称）
   - 点击：创建
   
4. ⚠️ 立即复制保存API Key
   格式：sk-xxxxxxxxxxxxxxxxxxxxxxxx
   （只显示一次！）
```

---

### 第2步：配置到云函数 ⚙️

**打开微信云开发控制台**：
```
微信开发者工具 → 云开发 → 云开发控制台
```

**配置环境变量**：
```
1. 左侧菜单：云函数
2. 点击：ai-multi-model
3. 点击标签：函数配置
4. 找到：环境变量 → 编辑
5. 添加：
   键：siliconflow_API_KEY
   值：sk-xxxxxxxx（您的完整API Key）
6. 保存 ✅
```

---

### 第3步：重新上传云函数 📤

```
右键 cloudfunctions/ai-multi-model
→ "上传并部署：云端安装依赖"
→ 等待完成
→ 等待2分钟（配置生效）
→ 测试 ✅
```

---

## 🎯 验证成功

**测试后查看日志**：

**成功标志**：
```
====== 调用 SiliconFlow API ======
模型: Qwen/Qwen2.5-72B-Instruct
API调用成功 ✅
```

**或者在SiliconFlow控制台**：
```
控制台 → 使用统计
→ 看到调用记录 ✅
```

---

## 💡 配合使用建议

**推荐配置两个API**：

| API | 用途 | 优先级 |
|-----|------|--------|
| 智谱AI (`GLM4_API_KEY`) | 视觉诊断主力 | ⭐⭐⭐⭐⭐ |
| SiliconFlow (`siliconflow_API_KEY`) | 备选降级 | ⭐⭐⭐⭐ |

**工作流程**：
```
带图片诊断：
  智谱AI视觉模型
    ↓ 失败/限额
  SiliconFlow文本模型（自动降级）✅

纯文本诊断：
  SiliconFlow文本模型 ✅
    ↓ 失败/限额
  智谱AI文本模型（自动降级）✅
```

---

## 📝 快速检查清单

- [ ] 注册 SiliconFlow 账号
- [ ] 创建API密钥（保存sk-开头的Key）
- [ ] 配置环境变量 `siliconflow_API_KEY`
- [ ] 重新上传 ai-multi-model
- [ ] 等待2分钟
- [ ] 测试诊断

---

## ⚠️ 常见问题

### Q: API Key在哪里找？

```
https://cloud.siliconflow.cn/account/ak
→ API密钥 → 创建
```

### Q: 如果丢失了API Key？

```
删除旧的 → 创建新的
（API Key只显示一次）
```

### Q: 免费额度够用吗？

```
新用户：2000万Tokens
诊断一次：约5000 Tokens
可用次数：约4000次 ✅
```

---

## 🔗 快速链接

- **注册/登录**：https://siliconflow.cn
- **API密钥管理**：https://cloud.siliconflow.cn/account/ak
- **使用文档**：https://docs.siliconflow.cn

---

**现在就去配置！** 🚀

5分钟搞定，完全免费！

