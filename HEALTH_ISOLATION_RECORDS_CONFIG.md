# health_isolation_records 集合配置指南

## 📋 集合信息

**集合名称**：`health_isolation_records`  
**用途**：隔离记录（记录病鹅隔离管理情况）  
**所属模块**：健康管理模块  
**序号**：第14号集合（健康管理模块的第4个）

---

## 📝 创建集合

### 步骤1：登录云开发控制台
1. 打开[微信云开发控制台](https://console.cloud.tencent.com/)
2. 选择对应的环境
3. 进入"数据库"模块
4. 点击"创建集合"

### 步骤2：填写集合信息
- **集合名称**：输入 `health_isolation_records`
- **权限类型**：选择 **"所有用户可读、创建者可读写"**
  - 养殖场成员需要查看所有隔离记录
  - 只能修改自己创建的记录
  - 管理员可以通过云函数修改所有记录

### 步骤3：确认创建
- 点击"确定"按钮完成创建

---

## 📊 添加索引

创建集合后，需要添加以下3个索引：

### 索引1：批次和开始日期索引（高优先级）

**用途**：查询某批次的所有隔离记录，按时间降序排列

**配置步骤**：
1. 在集合详情页，点击"索引管理"标签
2. 点击"新建索引"
3. 填写以下信息：

| 配置项 | 值 |
|-------|---|
| **索引名称** | `batchId_1_startDate_-1` |
| **索引属性** | 非唯一 |
| **字段1** | `batchId`，排序：升序 |
| **字段2** | `startDate`，排序：降序 |

4. 点击"确定"保存

**说明**：这是最重要的索引，用于查询某批次的隔离历史记录。

---

### 索引2：养殖场和开始日期索引（中优先级）

**用途**：查询养殖场的所有隔离记录，按时间降序排列

**配置步骤**：
1. 点击"新建索引"
2. 填写以下信息：

| 配置项 | 值 |
|-------|---|
| **索引名称** | `farmId_1_startDate_-1` |
| **索引属性** | 非唯一 |
| **字段1** | `farmId`，排序：升序 |
| **字段2** | `startDate`，排序：降序 |

3. 点击"确定"保存

**说明**：用于统计养殖场的隔离情况和历史趋势。

---

### 索引3：隔离状态查询索引（中优先级）

**用途**：查询养殖场当前正在隔离的记录

**配置步骤**：
1. 点击"新建索引"
2. 填写以下信息：

| 配置项 | 值 |
|-------|---|
| **索引名称** | `farmId_1_status_1` |
| **索引属性** | 非唯一 |
| **字段1** | `farmId`，排序：升序 |
| **字段2** | `status`，排序：升序 |

3. 点击"确定"保存

**说明**：用于快速查询当前隔离中的鹅只数量和详情。

---

## 🔑 关键字段说明

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| `_id` | String | 自动 | 记录ID | 系统生成 |
| `_openid` | String | 自动 | 创建者openid | 系统生成 |
| `batchId` | String | ✅ | 批次ID | "8f6c3a6368f82fd50028f6036302e3da" |
| `farmId` | String | ✅ | 养殖场ID | "farm_001" |
| `startDate` | Date/String | ✅ | 隔离开始日期 | "2025-10-26" |
| `endDate` | Date/String | ❌ | 隔离结束日期 | "2025-11-02" |
| `isolationCount` | Number | ✅ | 隔离数量 | 10 |
| `reason` | String | ✅ | 隔离原因 | "疑似新城疫，预防传染" |
| `location` | String | ❌ | 隔离位置 | "东区隔离舍1号" |
| `status` | String | ✅ | 隔离状态 | "isolating"/"released"/"died" |
| `outcome` | String | ❌ | 隔离结果 | "康复"/"死亡"/"继续治疗" |
| `relatedRecordId` | String | ❌ | 关联健康记录ID | "health_record_123" |
| `treatmentId` | String | ❌ | 关联治疗记录ID | "treatment_456" |
| `notes` | String | ❌ | 备注 | "观察症状变化，每日消毒" |
| `images` | Array | ❌ | 隔离照片 | ["cloud://xxx.jpg"] |
| `userId` | String | ✅ | 操作用户openid | 系统填充 |
| `isDeleted` | Boolean | ❌ | 是否已删除 | false |
| `createTime` | Date | 自动 | 创建时间 | 系统生成 |
| `updateTime` | Date | 自动 | 更新时间 | 系统生成 |

---

## 📦 字段详细说明

### 隔离状态（status）枚举值
- `isolating`：隔离中
- `released`：已解除隔离（康复）
- `transferred`：转移治疗
- `died`：隔离期间死亡

### 隔离原因（reason）示例
- "疑似传染病，预防扩散"
- "治疗观察期"
- "新引入批次，预防性隔离"
- "发热症状，待确诊"
- "与患病鹅只有接触史"

### 隔离结果（outcome）示例
- "康复，已归群"
- "症状缓解，继续观察"
- "转入治疗，病情加重"
- "隔离期间死亡"

---

## 🔍 数据示例

```json
{
  "_id": "isolation_20251026001",
  "_openid": "oQXEE7v2rkQBc5ECYn1W0PJoheB8",
  "batchId": "8f6c3a6368f82fd50028f6036302e3da",
  "farmId": "farm_20251022001",
  "startDate": "2025-10-26",
  "endDate": null,
  "isolationCount": 5,
  "reason": "疑似禽流感，预防传染",
  "location": "隔离舍A区",
  "status": "isolating",
  "outcome": "",
  "relatedRecordId": "abnormal_20251026001",
  "treatmentId": "treatment_20251026001",
  "notes": "每日观察体温和食欲，单独饮水，加强消毒",
  "images": [
    "cloud://xxx/isolation_20251026_1.jpg",
    "cloud://xxx/isolation_20251026_2.jpg"
  ],
  "userId": "oQXEE7v2rkQBc5ECYn1W0PJoheB8",
  "isDeleted": false,
  "createTime": "2025-10-26T10:30:00.000Z",
  "updateTime": "2025-10-26T10:30:00.000Z"
}
```

---

## ⚡ 使用场景

### 1. 创建隔离记录
```javascript
const db = wx.cloud.database()
await db.collection('health_isolation_records').add({
  data: {
    batchId: 'xxx',
    farmId: 'xxx',
    startDate: '2025-10-26',
    isolationCount: 5,
    reason: '疑似传染病',
    status: 'isolating',
    notes: '密切观察',
    userId: openid,
    createTime: new Date(),
    updateTime: new Date()
  }
})
```

### 2. 查询某批次的隔离记录
```javascript
const result = await db.collection('health_isolation_records')
  .where({
    batchId: 'xxx',
    isDeleted: _.neq(true)
  })
  .orderBy('startDate', 'desc')
  .get()
```

### 3. 查询当前隔离中的记录
```javascript
const result = await db.collection('health_isolation_records')
  .where({
    farmId: 'xxx',
    status: 'isolating',
    isDeleted: _.neq(true)
  })
  .get()
```

### 4. 解除隔离（更新状态）
```javascript
await db.collection('health_isolation_records')
  .doc(recordId)
  .update({
    data: {
      status: 'released',
      endDate: '2025-11-02',
      outcome: '康复，已归群',
      updateTime: new Date()
    }
  })
```

---

## 🔐 权限说明

### 读权限
- ✅ 养殖场所有成员可以查看隔离记录
- ✅ 用于了解批次健康状况和隔离历史

### 写权限
- ✅ 创建者可以修改自己创建的记录
- ✅ 云函数可以修改所有记录（管理员操作）
- ❌ 其他成员不能修改别人创建的记录

---

## 🚀 部署后验证

### 1. 验证集合创建
```javascript
// 在云函数中测试
const db = cloud.database()
const result = await db.collection('health_isolation_records').count()
console.log('集合存在，文档数量:', result.total)
```

### 2. 验证索引
- 在云开发控制台查看"索引管理"
- 确认3个索引都已创建成功
- 状态显示为"正常"

### 3. 验证权限
- 使用不同角色的账号测试读写权限
- 确保符合"所有用户可读、创建者可读写"

---

## 📝 相关集合

| 集合名 | 关系 | 说明 |
|-------|------|------|
| `health_records` | 关联 | 通过 `relatedRecordId` 关联异常记录 |
| `health_treatment_records` | 关联 | 通过 `treatmentId` 关联治疗记录 |
| `prod_batch_entries` | 关联 | 通过 `batchId` 关联批次信息 |

---

## 🎯 配置检查清单

- [ ] 集合已创建：`health_isolation_records`
- [ ] 权限已设置：所有用户可读、创建者可读写
- [ ] 索引1已创建：`batchId_1_startDate_-1`
- [ ] 索引2已创建：`farmId_1_startDate_-1`
- [ ] 索引3已创建：`farmId_1_status_1`
- [ ] 已在云函数中添加容错处理
- [ ] 已在小程序中测试访问权限

---

## 💡 最佳实践

1. **及时记录**：发现异常后立即创建隔离记录
2. **详细备注**：记录隔离原因、观察情况、处理措施
3. **照片留存**：上传隔离环境和病鹅状态照片
4. **定期更新**：每日更新隔离状态和观察结果
5. **规范解除**：康复后及时更新状态为已解除

---

**配置时间**：约5分钟  
**优先级**：中等（功能完善需要，不影响核心诊断）  
**建议**：先完成核心功能测试，再创建此集合

---

**创建日期**：2025-10-26  
**适用项目**：鹅数通智慧养鹅小程序  
**版本**：v1.0

