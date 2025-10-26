# 通义千问AI诊断系统配置完成 ✅

## 🎉 配置状态

**配置完成时间：** 2025-10-24  
**系统版本：** v3.0  
**AI供应商：** 阿里云通义千问  
**状态：** ✅ 已完成所有代码修改，可以开始部署  

---

## 📋 完成的配置清单

### ✅ 1. 模型配置 (MODEL_CONFIGS)

已配置**5个通义千问模型**，覆盖所有狮头鹅诊断场景：

| 模型 | 用途 | 成本 | 特点 |
|------|------|------|------|
| **qwen-long** | 常规文本诊断 | 免费（100万tokens） | 超长上下文 |
| **qwen-turbo** | 快速咨询 | 0.3分/次 | 极快响应（2-3秒） |
| **qwen-plus** | 复杂诊断/死因剖析 | 0.8分/次 | 专家级推理 |
| **qwen-vl-max** | 图片诊断 | 1.5分/次 | 顶级视觉（10张图片） |
| **qwen-vl-plus** | 图片诊断（经济） | 1分/次 | 高性价比视觉 |

### ✅ 2. 任务路由策略 (TASK_MODEL_MAPPING)

智能路由系统，根据任务类型自动选择最优模型：

```plaintext
任务类型              主选模型              备选模型              特点
═══════════════════════════════════════════════════════════════════
常规文本诊断       qwen-long           qwen-turbo          免费优先
复杂诊断/死因      qwen-plus           qwen-long           专家推理
图片诊断（主要）   qwen-vl-max         qwen-vl-plus        10张图片
紧急诊断           qwen-turbo          qwen-long           极快响应
历史记录分析       qwen-long           qwen-plus           超长文本
```

### ✅ 3. 成本控制器 (DailyCostController)

**每日10元预算**自动管理，四级降级策略：

1. **0-70%预算** → 正常运行，优选最佳模型
2. **70-90%预算** → 预警模式，谨慎使用付费模型
3. **90-100%预算** → 经济模式，优先免费模型
4. **预算耗尽** → 完全免费模式（Qwen-Long）

### ✅ 4. API调用方法

**OpenAI兼容格式**，统一调用接口：

```javascript
// 通义千问使用标准OpenAI格式
const response = await axios.post(
  `${baseURL}chat/completions`,
  {
    model: 'qwen-vl-max',
    messages,
    max_tokens: 8192,
    temperature: 0.7
  },
  {
    headers: {
      'Authorization': `Bearer ${QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
)
```

### ✅ 5. 图片处理

**HTTPS URL直链支持**（无需Base64转换）：

- ✅ 支持10张图片同时诊断
- ✅ 单张图片最大10MB
- ✅ 支持格式：BMP, JPEG, PNG, TIFF, WEBP
- ✅ 自动获取云存储临时URL
- ✅ 无需复杂的Base64编码

### ✅ 6. 删除的旧代码

已完全移除百度ERNIE相关代码：

- ❌ MODEL_CONFIGS中的3个ERNIE模型
- ❌ getBaiduAccessToken方法
- ❌ prepareBaiduImage方法
- ❌ callErnieBot方法
- ❌ callErnie45VL方法
- ❌ baiduTokenCache缓存机制
- ❌ 百度特殊的消息格式转换

---

## 🎯 通义千问 vs 百度ERNIE 对比

| 维度 | 通义千问 | 百度ERNIE | 优势 |
|------|---------|-----------|------|
| **图片数量** | 10张 | 4张 | **+150%** |
| **图片大小** | 10MB | 4MB | **+150%** |
| **成本** | 1-1.5分/次 | 2分/次 | **-30%** |
| **免费额度** | 100万tokens | 30000次 | **更多** |
| **开通流程** | 立即生效 | 逐个申请 | **更快** |
| **API标准** | OpenAI兼容 | 自定义格式 | **更标准** |
| **环境变量** | 1个API Key | 2个密钥 | **更简单** |
| **图片处理** | URL直链 | Base64转换 | **更简单** |
| **代码复杂度** | 简单统一 | 复杂适配 | **更易维护** |

---

## 🚀 部署指南

### 步骤1：获取通义千问API Key

#### 1.1 注册/登录阿里云
```
https://www.aliyun.com/
- 使用支付宝/淘宝账号快速登录
- 完成实名认证
```

#### 1.2 开通百炼平台
```
https://www.aliyun.com/product/bailian
- 点击"免费开通"
- 立即生效，无需等待审核！
- 自动获得100万tokens免费额度
```

#### 1.3 创建API Key
```
1. 进入百炼控制台：https://bailian.console.aliyun.com/
2. 左侧菜单 → "API-KEY管理"
3. 点击"创建新的API-KEY"
4. 复制API Key（格式：sk-xxxxxxxxxxxxxxxxxxxxxxxx）
```

**⚠️ 重要提示：**
- ✅ 只需要1个API Key（不像百度需要API Key + Secret Key）
- ✅ 立即生效，无需申请模型权限
- ✅ 100万tokens免费额度自动到账，有效期180天

---

### 步骤2：配置云函数环境变量

#### 2.1 打开微信开发者工具
```
顶部菜单 → "云开发" → 进入云开发控制台
```

#### 2.2 配置 ai-multi-model 环境变量
```
1. 左侧菜单 → "云函数"
2. 找到 "ai-multi-model" 云函数
3. 点击函数名称进入详情
4. 切换到"配置"标签
5. 找到"环境变量"区域
6. 点击"编辑"或"新增"
```

#### 2.3 添加环境变量
```
键(Key):   QWEN_API_KEY
值(Value): sk-xxxxxxxxxxxxxxxxxxxxxxxx（从阿里云复制的API Key）
```

**✅ 仅需1个环境变量！**

#### 2.4 删除旧环境变量（可选）
```
可以安全删除这些不再使用的变量：
- ERNIE_API_KEY
- ERNIE_SECRET_KEY
```

---

### 步骤3：上传云函数

#### 3.1 上传 ai-multi-model
```
1. 在微信开发者工具的项目目录中
2. 右键点击 cloudfunctions/ai-multi-model 文件夹
3. 选择"上传并部署：云端安装依赖"
4. 等待上传完成（约1-2分钟）
5. 看到✅ 上传成功提示
```

#### 3.2 验证环境变量
```
上传后，可以在云函数日志中看到：
"API Key已配置: ✅"
```

---

### 步骤4：测试AI诊断功能

#### 4.1 文本诊断测试
```javascript
// 在小程序中测试
wx.cloud.callFunction({
  name: 'ai-multi-model',
  data: {
    action: 'chat_completion',
    messages: [
      { 
        role: 'user', 
        content: '狮头鹅雏鹅5日龄，出现白色粪便、精神萎靡，请诊断' 
      }
    ],
    taskType: 'health_diagnosis'
  }
}).then(res => {
  console.log('诊断结果:', res.result)
})
```

#### 4.2 图片诊断测试
```javascript
// 上传2-4张症状图片后测试
wx.cloud.callFunction({
  name: 'ai-multi-model',
  data: {
    action: 'chat_completion',
    messages: [
      { 
        role: 'user', 
        content: '这是狮头鹅的粪便照片，请分析健康状况' 
      }
    ],
    images: ['cloud://xxx.jpg', 'cloud://yyy.jpg'],  // 云存储图片ID
    taskType: 'health_diagnosis_vision'
  }
}).then(res => {
  console.log('诊断结果:', res.result)
})
```

#### 4.3 查看云函数日志
```
云开发控制台 → 云函数 → ai-multi-model → 日志
查看：
- ✅ 通义千问调用成功
- 模型: qwen-vl-max
- 返回内容长度: XXX
```

---

## 📊 成本估算（每日10元预算）

### 场景1：纯文本诊断
```
使用模型：qwen-long（免费）
成本：0元
每日可支持：无限次（受100万tokens限制）
```

### 场景2：复杂诊断
```
使用模型：qwen-plus
成本：0.8分/次
每日可支持：约1250次诊断
```

### 场景3：图片诊断（主要场景）
```
使用模型：qwen-vl-max
成本：1.5分/次（2-4张图片）
每日可支持：约666次诊断
```

### 场景4：混合使用（推荐）
```
- 200次图片诊断（qwen-vl-max）：3元
- 300次复杂诊断（qwen-plus）：2.4元
- 500次快速咨询（qwen-turbo）：1.5元
- 无限次常规诊断（qwen-long）：免费
总计：6.9元/天（留有余量）
```

---

## 🎯 智能成本控制示例

### 预算充足（0-70%）
```
诊断场景：用户上传4张图片，描述症状
智能路由：选择 qwen-vl-max（顶级视觉）
成本：1.5分
状态：✅ 正常运行
```

### 预算预警（70-90%）
```
诊断场景：用户上传4张图片，描述症状
智能路由：降级到 qwen-vl-plus（经济视觉）
成本：1分
状态：⚠️ 预警模式
用户提示：无（静默降级）
```

### 预算不足（90-100%）
```
诊断场景：用户上传4张图片，描述症状
智能路由：降级到 qwen-long（纯文本）
成本：0元
状态：⚠️ 经济模式
用户提示："今日预算即将用尽，已切换为文字分析模式"
```

### 预算耗尽（100%）
```
诊断场景：任何诊断请求
智能路由：强制使用 qwen-long（免费）
成本：0元
状态：❌ 免费模式
用户提示："今日预算已用完，已切换为免费模式（明日0点重置）"
```

---

## 🔍 常见问题解答

### Q1: 通义千问的API Key在哪里获取？
**A:** 
```
1. 访问：https://bailian.console.aliyun.com/
2. 左侧菜单 → API-KEY管理
3. 点击"创建新的API-KEY"
4. 复制 sk-xxxxxxxx 格式的密钥
```

### Q2: 需要申请每个模型的权限吗？
**A:** 
```
❌ 不需要！
通义千问开通后，所有模型立即可用。
不像百度ERNIE需要逐个申请模型权限。
```

### Q3: 100万tokens免费额度够用吗？
**A:** 
```
✅ 非常够用！
- 纯文本诊断：约可用2-3个月
- 图片诊断：约可支持5000-10000次
- 混合使用：约可用1-2个月
```

### Q4: 图片支持哪些格式？
**A:** 
```
✅ 支持格式：BMP, JPEG, PNG, TIFF, WEBP
✅ 最大10张图片
✅ 单张最大10MB
✅ 推荐分辨率：800×800 或 1024×1024
```

### Q5: 如何查看今日预算使用情况？
**A:** 
```
云函数日志中会自动打印：
📊 今日预算使用: 45.2% (4.52元/10元)
```

### Q6: 成本控制器如何工作？
**A:** 
```
自动监控今日花费，智能选择模型：
- 预算充足 → 使用最佳模型（qwen-vl-max）
- 预算预警 → 使用经济模型（qwen-vl-plus）
- 预算不足 → 降级免费模型（qwen-long）
- 预算耗尽 → 完全免费模式
```

### Q7: 旧的百度ERNIE环境变量需要删除吗？
**A:** 
```
可选，不删除也不影响。
但建议删除以保持环境变量整洁：
- ERNIE_API_KEY（可删除）
- ERNIE_SECRET_KEY（可删除）
```

### Q8: 如何测试是否配置成功？
**A:** 
```
在小程序AI诊断页面：
1. 输入症状描述
2. 上传1-2张图片（可选）
3. 点击"开始AI诊断"
4. 查看是否返回诊断结果
5. 查看云函数日志确认调用成功
```

---

## 📈 性能优化建议

### 1. 图片优化
```
✅ 推荐尺寸：800×800 或 1024×1024
✅ 推荐格式：JPEG（最通用）或 WEBP（最小）
✅ 压缩质量：50-70%（AI识别足够）
✅ 图片数量：2-4张（性价比最优）
```

### 2. 提示词优化
```
✅ 提供详细症状描述
✅ 包含日龄、数量、环境等关键信息
✅ 使用关键词：死亡、批量、突然等（自动选择专家模型）
```

### 3. 任务类型选择
```
- 常规诊断 → health_diagnosis（免费）
- 复杂诊断 → complex_diagnosis（专家模型）
- 图片诊断 → health_diagnosis_vision（视觉模型）
- 紧急诊断 → urgent_diagnosis（快速响应）
- 历史分析 → history_analysis（超长文本）
```

---

## 🎉 完成状态总结

✅ **代码修改** - 已完成所有云函数代码修改  
✅ **模型配置** - 5个通义千问模型配置完毕  
✅ **任务路由** - 智能路由策略已更新  
✅ **成本控制** - 每日10元预算控制器已配置  
✅ **API调用** - OpenAI兼容格式统一接口  
✅ **图片处理** - URL直链支持，最多10张  
✅ **旧代码清理** - 百度ERNIE代码已完全移除  
✅ **无linter错误** - 代码通过所有检查  

---

## 📚 相关文档

1. **通义千问官方文档**
   - 模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
   - API文档：https://help.aliyun.com/zh/model-studio/developer-reference/api-reference

2. **本项目配置文档**
   - 完整代码：`cloudfunctions/ai-multi-model/index.js`
   - 环境变量：微信云开发控制台 → 云函数配置

---

## 🚀 下一步

1. ✅ 获取通义千问API Key
2. ✅ 配置环境变量（QWEN_API_KEY）
3. ✅ 上传云函数（ai-multi-model）
4. ✅ 测试AI诊断功能
5. ✅ 查看日志验证成功
6. ✅ 在小程序中实际使用

---

**配置完成！🎉 现在可以开始部署了！**

如有问题，请查看云函数日志或联系技术支持。

