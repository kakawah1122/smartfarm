# AI诊断功能修复指南

## 问题描述
AI诊断功能报错：`collection not exist` - 数据库集合不存在

## 错误截图分析
```
collection.add:fail -502005
database collection not exist
[ResourceNotFound] Db or Table not exist
```

---

## 问题根源

### 1. 集合名称不一致（已修复 ✅）
- **云函数使用**: `health_ai_diagnosis` ✅
- **前端使用**: `ai_diagnosis_tasks` ❌ （错误）

**修复内容：**
统一前端代码使用 `health_ai_diagnosis` 集合

**修复文件：**
- `miniprogram/packageAI/ai-diagnosis/ai-diagnosis.ts` (第414行)

---

### 2. 数据库集合未创建（需要手动创建 ⚠️）

根据项目规范，`health_ai_diagnosis` 集合需要在云开发控制台手动创建。

---

## 立即修复步骤

### 步骤1：创建数据库集合

1. **打开微信开发者工具**
2. **进入云开发控制台**
   - 点击顶部菜单：云开发 → 云开发控制台
3. **创建集合**
   - 左侧菜单：数据库
   - 点击"添加集合"按钮
   - 集合名称：`health_ai_diagnosis`
   - 点击"确定"

### 步骤2：配置集合权限

在 `health_ai_diagnosis` 集合中设置权限：

```json
{
  "read": "auth",
  "write": "auth"
}
```

**含义：**
- 所有登录用户可读
- 所有登录用户可写（会自动添加 _openid 进行权限隔离）

### 步骤3：创建必要索引（可选，建议创建）

根据 `DATABASE_CONFIG_GUIDE.md` 的高优先级索引配置：

#### 索引1：按养殖场和创建时间查询
- **字段1**: `farmId` (升序)
- **字段2**: `createTime` (降序)
- **索引名称**: `farmId_1_createTime_-1`

#### 索引2：按批次和创建时间查询
- **字段1**: `batchId` (升序)  
- **字段2**: `createTime` (降序)
- **索引名称**: `batchId_1_createTime_-1`

#### 索引3：按模型和创建时间查询
- **字段1**: `model` (升序)
- **字段2**: `createTime` (降序)
- **索引名称**: `model_1_createTime_-1`

**创建步骤：**
1. 进入 `health_ai_diagnosis` 集合
2. 点击"索引管理"
3. 点击"添加索引"
4. 按上述配置创建索引

### 步骤4：测试AI诊断功能

1. **重新编译小程序**
2. **清除缓存并重新打开**
   - 开发者工具：工具 → 清除缓存
3. **测试AI诊断**
   - 进入"健康管理"页面
   - 点击"AI智能诊断"
   - 输入症状描述
   - 点击"开始AI智能诊断"
4. **验证结果**
   - 应该能成功提交诊断
   - 轮询状态正常显示
   - 诊断结果正常返回

---

## 技术细节

### 集合字段结构

`health_ai_diagnosis` 集合的标准字段：

```javascript
{
  _id: String,                    // 自动生成
  _openid: String,                // 自动添加（用户标识）
  diagnosisId: String,            // 诊断编号 (如: AD250124001)
  
  // 诊断输入
  batchId: String,                // 批次ID
  farmId: String,                 // 养殖场ID
  symptoms: Array<String>,        // 症状列表
  symptomsText: String,           // 症状描述
  affectedCount: Number,          // 受影响数量
  dayAge: Number,                 // 日龄
  images: Array<String>,          // 图片文件ID列表
  
  // AI诊断结果
  result: {
    primaryDiagnosis: {           // 主要诊断
      disease: String,            // 疾病名称
      confidence: Number,         // 置信度 (0-100)
      reasoning: String           // 诊断依据
    },
    differentialDiagnosis: Array, // 鉴别诊断
    riskFactors: Array<String>,   // 风险因素
    severity: String,             // 严重程度: mild/moderate/severe
    urgency: String,              // 紧急程度: low/medium/high/critical
    treatmentRecommendation: Object, // 治疗建议
    preventionAdvice: Array<String>  // 预防建议
  },
  
  // 状态管理
  status: String,                 // 状态: pending/processing/completed/failed
  error: String,                  // 错误信息（如果失败）
  
  // AI模型信息
  model: String,                  // 使用的AI模型
  tokens: Number,                 // 消耗的token数
  
  // 时间戳
  createTime: Date,               // 创建时间
  updateTime: Date,               // 更新时间
  completedTime: Date             // 完成时间
}
```

---

## 代码修复详情

### 修复前（错误）
```typescript
const result = await db.collection('ai_diagnosis_tasks')  // ❌ 集合不存在
  .doc(diagnosisId)
  .get()
```

### 修复后（正确）
```typescript
const result = await db.collection('health_ai_diagnosis')  // ✅ 使用正确的集合名称
  .doc(diagnosisId)
  .get()
```

---

## 遵循的项目规则

### ✅ 规则1：统一集合命名
- 健康管理模块使用 `health_` 前缀
- AI诊断属于健康管理，使用 `health_ai_diagnosis`

### ✅ 规则2：前后端一致
- 云函数和前端必须使用相同的集合名称
- 使用 `shared-config/collections.js` 统一管理

### ✅ 规则3：权限配置
- 用户数据使用 `auth` 权限
- 利用 `_openid` 自动权限隔离

### ✅ 规则4：索引优化
- 高频查询字段创建索引
- 时间字段使用降序索引（最新记录优先）

---

## 验证清单

完成以下步骤后，AI诊断功能应该能正常工作：

- [ ] **步骤1**: 创建 `health_ai_diagnosis` 集合
- [ ] **步骤2**: 配置集合权限为 `auth`
- [ ] **步骤3**: 创建必要索引（可选）
- [ ] **步骤4**: 重新编译小程序
- [ ] **步骤5**: 清除缓存
- [ ] **步骤6**: 测试AI诊断功能
- [ ] **步骤7**: 验证诊断记录保存成功
- [ ] **步骤8**: 检查诊断历史页面

---

## 常见问题

### Q1: 创建集合后仍然报错？
**A**: 清除小程序缓存并重新编译
```bash
开发者工具 → 工具 → 清除缓存 → 清除全部缓存
```

### Q2: 权限配置错误？
**A**: 检查权限设置
- 读权限：`auth`（所有登录用户可读）
- 写权限：`auth`（所有登录用户可写）

### Q3: AI诊断提交后一直loading？
**A**: 检查以下几点：
1. 确认 `ai-diagnosis` 云函数已部署
2. 检查云函数环境变量（API Key）
3. 查看云函数日志是否有错误

### Q4: 如何查看云函数日志？
**A**: 
1. 云开发控制台 → 云函数
2. 点击 `ai-diagnosis` 函数
3. 查看"日志"标签页

---

## 后续优化建议

### 1. 前端使用常量管理集合名称
创建 `miniprogram/utils/constants.ts`：
```typescript
export const COLLECTIONS = {
  HEALTH_AI_DIAGNOSIS: 'health_ai_diagnosis',
  // 其他集合...
}
```

### 2. 添加错误重试机制
在AI诊断失败时，提供重试按钮

### 3. 添加本地缓存
缓存最近的诊断结果，减少数据库查询

### 4. 监控和告警
- 监控AI诊断成功率
- 监控平均响应时间
- 失败率超过阈值时告警

---

## 修复总结

| 修复项目 | 状态 | 说明 |
|---------|------|------|
| 集合名称统一 | ✅ 已完成 | 前端代码已修改 |
| 数据库集合创建 | ⚠️ 需手动操作 | 需在云开发控制台创建 |
| 权限配置 | ⚠️ 需手动操作 | 设置为 `auth` |
| 索引创建 | 📝 建议创建 | 提升查询性能 |

**结论：代码层面已修复完成，需要在云开发控制台手动创建数据库集合。** ✅

---

## 快速操作命令

### 重新部署云函数（如需要）
```bash
# 在项目根目录执行
cd cloudfunctions/ai-diagnosis
npm install
# 然后在微信开发者工具中右键上传并部署
```

### 查看集合列表
在云开发控制台数据库页面，可以看到所有已创建的集合。

---

**修复时间：** 2025-10-24  
**修复人员：** AI Assistant  
**下一步：** 请按照"立即修复步骤"在云开发控制台创建数据库集合

