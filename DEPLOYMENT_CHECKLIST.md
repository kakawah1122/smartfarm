# 百度ERNIE AI诊断系统 - 快速部署检查清单

> **部署日期**: 2025年10月24日  
> **预计时间**: 30-45分钟  

---

## ✅ 部署前准备

### 1. 百度AI开放平台账号准备

- [ ] 已注册百度AI开放平台账号：https://ai.baidu.com/
- [ ] 已完成实名认证
- [ ] 已创建应用并获取API Key和Secret Key
- [ ] 已开通以下模型服务：
  - [ ] ERNIE-Speed-128K（永久免费）
  - [ ] ERNIE 4.0 Turbo 8K
  - [ ] ERNIE 4.5 VL Preview

### 2. 环境检查

- [ ] 微信开发者工具版本 ≥ 1.06.0
- [ ] Node.js版本 ≥ 16.x
- [ ] 云开发环境已初始化
- [ ] 云函数Node.js运行时 ≥ 18.x

---

## 📦 代码部署

### 步骤1：更新云函数

#### 1.1 ai-multi-model 云函数

```bash
cd cloudfunctions/ai-multi-model
```

- [ ] 代码已更新（MODEL_CONFIGS中包含3个ERNIE模型）
- [ ] TASK_MODEL_MAPPING已更新
- [ ] DailyCostController类已添加
- [ ] callErnieBot和callErnie45VL方法已添加
- [ ] callModel方法已支持百度文心
- [ ] package.json中axios依赖已确认

**上传部署**:
- [ ] 右键 → 云函数 → 上传并部署（云端安装依赖）
- [ ] 等待部署完成（约2-3分钟）

#### 1.2 process-ai-diagnosis 云函数

```bash
cd cloudfunctions/process-ai-diagnosis
```

- [ ] 智能任务选择函数已添加：
  - [ ] selectOptimalTaskType
  - [ ] evaluateDiagnosisComplexity
  - [ ] evaluateUrgency
- [ ] processTask方法已更新使用智能路由
- [ ] buildDiagnosisMessages系统提示词已优化（ERNIE 4.5 VL多模态能力）

**上传部署**:
- [ ] 右键 → 云函数 → 上传并部署
- [ ] 等待部署完成

---

## 🔐 环境变量配置

### 步骤2：设置云开发环境变量

1. 登录微信云开发控制台
2. 进入"环境" → "环境设置" → "环境变量"
3. 添加以下变量：

- [ ] `ERNIE_API_KEY` = 你的百度API_KEY
- [ ] `ERNIE_SECRET_KEY` = 你的百度SECRET_KEY

**验证**:
```javascript
// 在云函数测试控制台
console.log('API_KEY:', process.env.ERNIE_API_KEY ? '已配置✅' : '未配置❌')
console.log('SECRET_KEY:', process.env.ERNIE_SECRET_KEY ? '已配置✅' : '未配置❌')
```

---

## 🗄️ 数据库配置

### 步骤3：创建/验证数据库集合

#### 3.1 health_ai_diagnosis 集合

- [ ] 集合已存在
- [ ] 权限配置：
  - 所有用户可读
  - 仅创建者可写
- [ ] 索引已创建：
  - [ ] `farmId_1_createTime_-1`（复合索引）
  - [ ] `status_1`（单字段索引）

#### 3.2 sys_ai_usage 集合（成本记录）

- [ ] 集合已创建（如不存在需手动创建）
- [ ] 权限配置：所有用户不可读写
- [ ] 索引已创建：
  - [ ] `date_1_modelId_1`（复合索引）
  - [ ] `date_1_cost_-1`（复合索引）

**手动创建方法**:
```
1. 云开发控制台 → 数据库 → 新建集合
2. 集合名称：sys_ai_usage
3. 权限：所有用户不可读写
4. 索引 → 添加 → 输入上述索引配置
```

---

## 🧪 功能测试

### 步骤4：基础功能测试

#### 测试1：百度Token获取

在云开发控制台 → 云函数 → ai-multi-model → 测试：

```json
{
  "action": "health_check"
}
```

**预期结果**:
- [ ] 返回各模型可用性状态
- [ ] ernie-speed-128k, ernie-4.0-turbo, ernie-4.5-vl 显示为 available: true

---

#### 测试2：免费文本诊断（ERNIE-Speed-128K）

在小程序前端或云函数测试：

```javascript
wx.cloud.callFunction({
  name: 'ai-diagnosis',
  data: {
    symptoms: ['食欲不振', '精神萎靡'],
    symptomsText: '小鹅精神不好，不爱吃料',
    dayAge: 15,
    affectedCount: 2,
    images: []  // 无图片
  }
})
```

**预期结果**:
- [ ] 返回诊断结果
- [ ] 使用模型：ERNIE-Speed-128K
- [ ] 成本：0元
- [ ] 响应时间：< 10秒

**验证日志**（云函数日志）:
```
智能路由结果: health_diagnosis
使用模型: ernie-speed-128k
成本: 0元
```

---

#### 测试3：图片诊断（ERNIE 4.5 VL）

```javascript
// 1. 先上传图片到云存储
wx.cloud.uploadFile({
  cloudPath: 'test/diagnosis-test.jpg',
  filePath: tempFilePath,
  success: uploadRes => {
    // 2. 调用诊断
    wx.cloud.callFunction({
      name: 'ai-diagnosis',
      data: {
        symptoms: ['腹泻', '粪便异常'],
        symptomsText: '出现白色粪便，精神萎靡',
        dayAge: 5,
        affectedCount: 8,
        images: [uploadRes.fileID]  // 云存储文件ID
      }
    })
  }
})
```

**预期结果**:
- [ ] 返回诊断结果，包含图片分析
- [ ] 使用模型：ERNIE 4.5 VL
- [ ] 成本：0.02元（2分）
- [ ] 响应时间：15-25秒
- [ ] imageAnalysis字段包含图片观察结果

**验证日志**:
```
智能路由结果: health_diagnosis_vision
图片数量: 1
使用模型: ernie-4.5-vl
成本: 0.02元
图片Base64转换成功
```

---

#### 测试4：复杂诊断（ERNIE 4.0 Turbo）

```javascript
wx.cloud.callFunction({
  name: 'ai-diagnosis',
  data: {
    symptoms: ['突然死亡', '批量发病', '神经症状'],
    symptomsText: '批量死亡，出现扭颈症状，快速扩散',
    dayAge: 20,
    affectedCount: 50,
    images: []
  }
})
```

**预期结果**:
- [ ] 返回诊断结果
- [ ] 使用模型：ERNIE 4.0 Turbo
- [ ] 成本：0.006元（0.6分）
- [ ] 包含鉴别诊断
- [ ] 紧急建议明确

**验证日志**:
```
复杂度评估: high
智能路由结果: complex_diagnosis
使用模型: ernie-4.0-turbo
成本: 0.006元
```

---

#### 测试5：成本控制验证

```javascript
// 查询今日成本
wx.cloud.database().collection('sys_ai_usage')
  .where({
    date: new Date().toISOString().split('T')[0]
  })
  .get()
  .then(res => {
    const totalCost = res.data.reduce((sum, r) => sum + r.cost, 0)
    const visionCalls = res.data.filter(r => r.modelId === 'ernie-4.5-vl').length
    const complexCalls = res.data.filter(r => r.modelId === 'ernie-4.0-turbo').length
    
    console.log('今日成本统计:')
    console.log('- 总成本:', totalCost.toFixed(2), '元')
    console.log('- 视觉模型调用:', visionCalls, '次')
    console.log('- 复杂诊断调用:', complexCalls, '次')
  })
```

**预期结果**:
- [ ] sys_ai_usage集合正常记录
- [ ] cost字段准确
- [ ] date字段正确（YYYY-MM-DD格式）

---

#### 测试6：预算降级机制

**模拟预算紧张**（手动添加测试数据）:

```javascript
// 在云开发控制台添加测试记录，模拟已用9元
const db = wx.cloud.database()
const today = new Date().toISOString().split('T')[0]

// 添加450次视觉诊断记录（9元）
for (let i = 0; i < 450; i++) {
  await db.collection('sys_ai_usage').add({
    data: {
      modelId: 'ernie-4.5-vl',
      cost: 0.02,
      tokens: 1500,
      date: today,
      createTime: new Date()
    }
  })
}

// 此时预算使用率：90%
```

**再次请求图片诊断**:

```javascript
wx.cloud.callFunction({
  name: 'ai-diagnosis',
  data: {
    symptoms: ['轻微腹泻'],
    symptomsText: '轻微症状',
    images: ['cloud://test.jpg']
  }
})
```

**预期结果**:
- [ ] 系统检测到预算不足（90%）
- [ ] 自动降级为免费模型（ERNIE-Speed-128K）
- [ ] 返回降级提示：`degraded: true`
- [ ] userMessage显示："今日预算即将用尽，已切换为经济模式"

---

## 📊 监控与验证

### 步骤5：验证监控功能

#### 5.1 成本统计

在云函数测试或管理页面：

```javascript
async function checkDailyStats() {
  const db = wx.cloud.database()
  const today = new Date().toISOString().split('T')[0]
  
  const stats = await db.collection('sys_ai_usage')
    .where({ date: today })
    .get()
  
  console.log('今日统计:')
  console.log('- 总调用:', stats.data.length, '次')
  console.log('- 总成本:', stats.data.reduce((sum, r) => sum + r.cost, 0).toFixed(2), '元')
  
  return stats.data
}
```

**预期输出**:
```
今日统计:
- 总调用: 15次
- 总成本: 0.32元
```

- [ ] 数据统计准确
- [ ] 成本计算正确

#### 5.2 模型分布统计

```javascript
const byModel = {}
stats.data.forEach(r => {
  if (!byModel[r.modelId]) byModel[r.modelId] = { calls: 0, cost: 0 }
  byModel[r.modelId].calls++
  byModel[r.modelId].cost += r.cost
})

console.log('模型分布:')
Object.keys(byModel).forEach(model => {
  console.log(`- ${model}: ${byModel[model].calls}次, ${byModel[model].cost.toFixed(2)}元`)
})
```

**预期输出**:
```
模型分布:
- ernie-speed-128k: 8次, 0.00元
- ernie-4.5-vl: 5次, 0.10元
- ernie-4.0-turbo: 2次, 0.012元
```

- [ ] 各模型调用统计准确
- [ ] 成本分配正确

---

## 🚨 常见问题快速修复

### 问题1：Token获取失败

**错误**: `百度API认证失败: invalid_client`

**检查项**:
- [ ] 环境变量是否正确配置
- [ ] API Key和Secret Key无多余空格
- [ ] 百度账户是否已实名认证
- [ ] 应用是否已审核通过

**快速测试**:
```bash
curl -X POST "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=YOUR_KEY&client_secret=YOUR_SECRET"
```

---

### 问题2：图片转换失败

**错误**: `图片过大: 5.23MB（百度限制4MB）`

**解决**:
- [ ] 前端压缩参数已设置为50%质量
- [ ] 尺寸已限制为1024x1024
- [ ] 如仍超限，调整为quality: 30

---

### 问题3：sys_ai_usage集合不存在

**解决**:
```
1. 云开发控制台 → 数据库
2. 新建集合：sys_ai_usage
3. 权限：所有用户不可读写
4. 添加索引（见上文）
```

---

### 问题4：诊断返回空结果

**检查项**:
- [ ] 云函数日志是否有错误
- [ ] AI返回内容是否符合JSON格式
- [ ] 网络是否超时（增加timeout配置）

---

## 🎯 部署后验证清单

### 核心功能验证

- [ ] ✅ 免费文本诊断正常（ERNIE-Speed-128K）
- [ ] ✅ 图片诊断正常（ERNIE 4.5 VL）
- [ ] ✅ 复杂诊断正常（ERNIE 4.0 Turbo）
- [ ] ✅ 成本记录准确（sys_ai_usage）
- [ ] ✅ 智能路由生效（根据复杂度/图片/紧急度选择模型）
- [ ] ✅ 预算控制生效（70%预警、90%降级、100%免费）

### 性能指标

- [ ] 免费文本诊断响应时间 < 10秒
- [ ] 图片诊断响应时间 < 25秒
- [ ] 复杂诊断响应时间 < 15秒
- [ ] Token缓存生效（第2次调用无需重新获取）

### 成本验证

- [ ] 免费模型调用成本 = 0元
- [ ] ERNIE 4.5 VL调用成本 = 2分/次
- [ ] ERNIE 4.0 Turbo调用成本 = 0.6分/次
- [ ] 每日预算限制 = 10元

---

## 📝 部署完成签字

**部署人员**: ________________  
**部署日期**: ________________  
**测试通过**: [ ] 是  [ ] 否  
**备注**: ____________________  

---

## 🎉 恭喜部署完成！

您的AI诊断系统已成功上线，可以开始为用户提供智能诊断服务了！

### 下一步建议

1. 📊 监控每日成本使用情况
2. 📈 收集用户反馈优化诊断准确率
3. 🔍 定期查看诊断日志，调整复杂度评估算法
4. 💡 根据实际使用情况调整预算分配策略

### 技术支持

- 📚 详细配置文档：`ERNIE_AI_DIAGNOSIS_CONFIG_GUIDE.md`
- 📊 数据库配置：`DATABASE_CONFIG_GUIDE.md`
- 🔧 故障排查：见配置指南第8章

---

**祝运营顺利！** 🚀

