# 报销系统 - 数据库设计文档

## 概述

本文档定义报销系统的数据库结构，扩展现有的 `finance_cost_records` 集合以支持报销申请和审批功能。

---

## 一、集合扩展：finance_cost_records

### 1.1 集合说明

**集合名称**：`finance_cost_records`（财务成本记录）

**用途**：统一存储所有成本支出记录，包括：
- 常规采购支出
- 工资支出
- **报销支出**（新增）
- 其他支出

### 1.2 完整字段定义

```javascript
{
  // ========== 基础字段 ==========
  _id: 'record_xxx',                    // 记录ID
  _openid: 'user_openid',               // 创建者openid
  
  // ========== 原有字段 ==========
  costType: String,                     // 成本类型：'feed'|'labor'|'medicine'|'utilities'|'other'
  amount: Number,                       // 金额（元）
  description: String,                  // 描述说明
  date: String,                         // 日期 'YYYY-MM-DD'
  batchNumber: String,                  // 关联批次号（可选）
  operator: String,                     // 操作人姓名
  
  // ========== 新增：记录类型 ==========
  recordType: String,                   // 记录类型：'reimbursement'|'purchase'|'salary'|'other'
  isReimbursement: Boolean,             // 是否为报销记录（快速筛选用）
  
  // ========== 新增：报销相关字段 ==========
  // 仅当 recordType = 'reimbursement' 时使用以下字段
  
  reimbursement: {
    // 报销基本信息
    type: String,                       // 报销类型：'feed'|'medicine'|'vaccine'|'equipment'|'transport'|'utilities'|'labor'|'other'
    typeName: String,                   // 报销类型名称：'饲料采购'|'兽药采购'|'防疫费用'|'设备维修'|'运输费用'|'水电费'|'劳务费用'|'其他费用'
    
    // 申请人信息
    applicant: {
      openid: String,                   // 申请人openid
      name: String,                     // 申请人姓名
      role: String,                     // 申请人角色
      phone: String                     // 申请人电话（可选）
    },
    
    // 审批信息
    status: String,                     // 审批状态：'pending'|'approved'|'rejected'
    approver: {
      openid: String,                   // 审批人openid
      name: String,                     // 审批人姓名
      role: String                      // 审批人角色
    },
    approvalTime: String,               // 审批时间 ISO格式
    rejectionReason: String,            // 拒绝原因（status='rejected'时必填）
    
    // 凭证信息
    vouchers: [                         // 凭证文件数组
      {
        fileId: String,                 // 云存储文件ID
        fileName: String,               // 文件名
        fileType: String,               // 文件类型：'image'|'pdf'
        uploadTime: String              // 上传时间
      }
    ],
    
    // 详细说明
    detail: String,                     // 详细说明
    remark: String                      // 备注
  },
  
  // ========== 审计字段 ==========
  createTime: String,                   // 创建时间 ISO格式
  updateTime: String,                   // 更新时间 ISO格式
  isDeleted: Boolean,                   // 软删除标记
  deletedTime: String                   // 删除时间
}
```

### 1.3 字段说明

#### 基础字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | String | 是 | 记录唯一标识 |
| `_openid` | String | 是 | 创建者的openid |

#### 原有字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `costType` | String | 是 | 成本类型 |
| `amount` | Number | 是 | 金额，单位：元 |
| `description` | String | 是 | 描述说明 |
| `date` | String | 是 | 日期，格式：YYYY-MM-DD |
| `operator` | String | 是 | 操作人姓名 |
| `batchNumber` | String | 否 | 关联的批次号 |

#### 新增字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `recordType` | String | 是 | 区分记录类型：报销/采购/工资/其他 |
| `isReimbursement` | Boolean | 是 | 快速标识是否为报销记录 |
| `reimbursement` | Object | 条件 | 报销详细信息（仅报销记录需要） |

#### 报销对象字段

| 字段路径 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| `reimbursement.type` | String | 是 | 报销类型代码 |
| `reimbursement.typeName` | String | 是 | 报销类型显示名称 |
| `reimbursement.applicant` | Object | 是 | 申请人完整信息 |
| `reimbursement.status` | String | 是 | 审批状态 |
| `reimbursement.approver` | Object | 条件 | 审批人信息（已审批时必填） |
| `reimbursement.approvalTime` | String | 条件 | 审批时间（已审批时必填） |
| `reimbursement.rejectionReason` | String | 条件 | 拒绝原因（被拒绝时必填） |
| `reimbursement.vouchers` | Array | 否 | 凭证文件列表 |
| `reimbursement.detail` | String | 否 | 详细说明 |
| `reimbursement.remark` | String | 否 | 备注 |

---

## 二、枚举值定义

### 2.1 记录类型 (recordType)

```javascript
const RECORD_TYPES = {
  REIMBURSEMENT: 'reimbursement',  // 报销
  PURCHASE: 'purchase',            // 采购
  SALARY: 'salary',                // 工资
  OTHER: 'other'                   // 其他
}
```

### 2.2 报销类型 (reimbursement.type)

```javascript
const REIMBURSEMENT_TYPES = {
  FEED: {
    code: 'feed',
    name: '饲料采购',
    description: '购买饲料产生的费用'
  },
  MEDICINE: {
    code: 'medicine',
    name: '兽药采购',
    description: '购买兽药、消毒剂等药品费用'
  },
  VACCINE: {
    code: 'vaccine',
    name: '防疫费用',
    description: '疫苗接种、防疫检查等费用'
  },
  EQUIPMENT: {
    code: 'equipment',
    name: '设备维修',
    description: '养殖设备维修、保养费用'
  },
  TRANSPORT: {
    code: 'transport',
    name: '运输费用',
    description: '运输饲料、禽类等产生的费用'
  },
  UTILITIES: {
    code: 'utilities',
    name: '水电费',
    description: '养殖场水电费用'
  },
  LABOR: {
    code: 'labor',
    name: '劳务费用',
    description: '临时工、外包服务等劳务费用'
  },
  OTHER: {
    code: 'other',
    name: '其他费用',
    description: '其他类型的报销'
  }
}
```

### 2.3 审批状态 (reimbursement.status)

```javascript
const APPROVAL_STATUS = {
  PENDING: {
    code: 'pending',
    name: '待审批',
    color: '#ed7b2f'  // 橙色
  },
  APPROVED: {
    code: 'approved',
    name: '已通过',
    color: '#00a870'  // 绿色
  },
  REJECTED: {
    code: 'rejected',
    name: '已拒绝',
    color: '#e34d59'  // 红色
  }
}
```

---

## 三、数据示例

### 3.1 报销记录示例

```javascript
{
  _id: 'reimbursement_20240315143022',
  _openid: 'oABC123456789',
  
  // 基础财务信息
  costType: 'other',
  amount: 280,
  description: '前往南京出差的交通和住宿费用',
  date: '2024-03-15',
  operator: '张三',
  
  // 记录类型
  recordType: 'reimbursement',
  isReimbursement: true,
  
  // 报销详细信息
  reimbursement: {
    type: 'feed',
    typeName: '饲料采购',
    
    applicant: {
      openid: 'oABC123456789',
      name: '张三',
      role: 'employee',
      phone: '138****8888'
    },
    
    status: 'pending',
    approver: null,
    approvalTime: null,
    rejectionReason: null,
    
    vouchers: [
      {
        fileId: 'cloud://xxx.png',
        fileName: '高铁票.png',
        fileType: 'image',
        uploadTime: '2024-03-15T14:30:22.000Z'
      },
      {
        fileId: 'cloud://yyy.png',
        fileName: '酒店发票.png',
        fileType: 'image',
        uploadTime: '2024-03-15T14:30:45.000Z'
      }
    ],
    
    detail: '3月13-14日前往南京参加养殖技术交流会，高铁往返费用180元，住宿费用100元。',
    remark: '已提前获得经理口头同意'
  },
  
  createTime: '2024-03-15T14:30:22.000Z',
  updateTime: '2024-03-15T14:30:22.000Z',
  isDeleted: false
}
```

### 3.2 已审批通过的报销记录

```javascript
{
  _id: 'reimbursement_20240314182015',
  _openid: 'oABC123456789',
  
  costType: 'other',
  amount: 120,
  description: '购买兽药费用',
  date: '2024-03-14',
  operator: '张三',
  
  recordType: 'reimbursement',
  isReimbursement: true,
  
  reimbursement: {
    type: 'medicine',
    typeName: '兽药采购',
    
    applicant: {
      openid: 'oABC123456789',
      name: '张三',
      role: 'employee'
    },
    
    status: 'approved',
    approver: {
      openid: 'oXYZ987654321',
      name: '李经理',
      role: 'manager'
    },
    approvalTime: '2024-03-15T09:15:30.000Z',
    rejectionReason: null,
    
    vouchers: [
      {
        fileId: 'cloud://zzz.png',
        fileName: '餐费发票.png',
        fileType: 'image',
        uploadTime: '2024-03-14T18:20:15.000Z'
      }
    ],
    
    detail: '加班工作餐',
    remark: null
  },
  
  createTime: '2024-03-14T18:20:15.000Z',
  updateTime: '2024-03-15T09:15:30.000Z',
  isDeleted: false
}
```

### 3.3 被拒绝的报销记录

```javascript
{
  _id: 'reimbursement_20240312101520',
  _openid: 'oABC123456789',
  
  costType: 'other',
  amount: 500,
  description: '办公用品采购',
  date: '2024-03-12',
  operator: '张三',
  
  recordType: 'reimbursement',
  isReimbursement: true,
  
  reimbursement: {
    type: 'equipment',
    typeName: '设备维修',
    
    applicant: {
      openid: 'oABC123456789',
      name: '张三',
      role: 'employee'
    },
    
    status: 'rejected',
    approver: {
      openid: 'oXYZ987654321',
      name: '李经理',
      role: 'manager'
    },
    approvalTime: '2024-03-13T10:30:00.000Z',
    rejectionReason: '该采购未经提前审批，且金额超过个人采购权限（200元），请走正规采购流程。',
    
    vouchers: [
      {
        fileId: 'cloud://aaa.png',
        fileName: '采购清单.png',
        fileType: 'image',
        uploadTime: '2024-03-12T10:15:20.000Z'
      }
    ],
    
    detail: '采购打印纸、文件夹等办公用品',
    remark: null
  },
  
  createTime: '2024-03-12T10:15:20.000Z',
  updateTime: '2024-03-13T10:30:00.000Z',
  isDeleted: false
}
```

---

## 四、数据库索引

### 4.1 必需索引

```javascript
// 1. 按用户查询我的报销记录
db.finance_cost_records.createIndex({ 
  "_openid": 1, 
  "isReimbursement": 1,
  "createTime": -1 
})

// 2. 按审批状态查询待审批报销（管理员用）
db.finance_cost_records.createIndex({ 
  "isReimbursement": 1,
  "reimbursement.status": 1,
  "createTime": -1 
})

// 3. 按日期范围查询（财务统计用）
db.finance_cost_records.createIndex({ 
  "date": 1,
  "recordType": 1,
  "isDeleted": 1
})

// 4. 复合索引：用户+状态
db.finance_cost_records.createIndex({
  "_openid": 1,
  "reimbursement.status": 1,
  "createTime": -1
})
```

### 4.2 索引说明

| 索引 | 用途 | 场景 |
|------|------|------|
| `_openid + isReimbursement + createTime` | 查询用户的报销记录 | 员工查看"我的报销" |
| `isReimbursement + status + createTime` | 查询待审批报销 | 管理员审批列表 |
| `date + recordType + isDeleted` | 按日期统计财务数据 | 月度/年度财务报表 |
| `_openid + status + createTime` | 查询用户特定状态的报销 | 查看待审批/已通过等 |

---

## 五、数据验证规则

### 5.1 字段验证

```javascript
// 报销记录创建时的验证规则
const reimbursementValidationRules = {
  // 金额必须大于0
  amount: (value) => value > 0,
  
  // 报销类型必须在允许范围内
  'reimbursement.type': (value) => ['feed', 'medicine', 'vaccine', 'equipment', 'transport', 'utilities', 'labor', 'other'].includes(value),
  
  // 描述不能为空
  description: (value) => value && value.trim().length > 0,
  
  // 日期格式验证
  date: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  
  // 凭证数量限制（最多5张）
  'reimbursement.vouchers': (value) => !value || value.length <= 5,
  
  // 单笔报销金额限制（根据角色不同）
  amountLimit: {
    employee: 1000,      // 普通员工单笔不超过1000元
    veterinarian: 1000,  // 兽医单笔不超过1000元
    manager: 5000,       // 经理单笔不超过5000元
    super_admin: Infinity // 超级管理员无限制
  }
}
```

### 5.2 状态转换规则

```javascript
// 允许的状态转换
const allowedStatusTransitions = {
  'pending': ['approved', 'rejected'],  // 待审批 -> 已通过/已拒绝
  'approved': [],                       // 已通过 -> 不允许转换
  'rejected': ['pending']               // 已拒绝 -> 可重新提交（待审批）
}
```

---

## 六、数据迁移

### 6.1 现有数据兼容

对于已存在的 `finance_cost_records` 记录，需要添加默认值：

```javascript
// 迁移脚本
db.finance_cost_records.updateMany(
  { recordType: { $exists: false } },  // 没有recordType字段的旧记录
  {
    $set: {
      recordType: 'other',
      isReimbursement: false,
      updateTime: new Date().toISOString()
    }
  }
)
```

### 6.2 数据完整性检查

```javascript
// 检查报销记录的完整性
db.finance_cost_records.find({
  isReimbursement: true,
  $or: [
    { 'reimbursement.type': { $exists: false } },
    { 'reimbursement.status': { $exists: false } },
    { 'reimbursement.applicant': { $exists: false } }
  ]
})
```

---

## 七、权限控制

### 7.1 操作权限

| 操作 | 员工 | 兽医 | 经理 | 超级管理员 |
|------|------|------|------|-----------|
| 创建报销申请 | ✅ | ✅ | ✅ | ✅ |
| 查看自己的报销 | ✅ | ✅ | ✅ | ✅ |
| 查看所有报销 | ❌ | ❌ | ✅ | ✅ |
| 审批报销 | ❌ | ❌ | ✅ | ✅ |
| 删除报销记录 | ❌ | ❌ | ❌ | ✅ |

### 7.2 数据权限

```javascript
// 数据访问规则
const dataAccessRules = {
  // 员工和兽医只能访问自己的报销记录
  employee: (user, record) => record._openid === user.openid,
  veterinarian: (user, record) => record._openid === user.openid,
  
  // 经理和超级管理员可以访问所有报销记录
  manager: (user, record) => true,
  super_admin: (user, record) => true
}
```

---

## 八、查询示例

### 8.1 查询我的报销记录

```javascript
// 查询当前用户的所有报销记录
db.collection('finance_cost_records')
  .where({
    _openid: currentUser.openid,
    isReimbursement: true,
    isDeleted: _.neq(true)
  })
  .orderBy('createTime', 'desc')
  .get()
```

### 8.2 查询待审批报销（管理员）

```javascript
// 查询所有待审批的报销申请
db.collection('finance_cost_records')
  .where({
    isReimbursement: true,
    'reimbursement.status': 'pending',
    isDeleted: _.neq(true)
  })
  .orderBy('createTime', 'asc')
  .get()
```

### 8.3 统计月度报销金额

```javascript
// 统计指定用户当月已通过的报销总额
const startDate = '2024-03-01'
const endDate = '2024-03-31'

db.collection('finance_cost_records')
  .aggregate()
  .match({
    _openid: currentUser.openid,
    isReimbursement: true,
    'reimbursement.status': 'approved',
    date: _.gte(startDate).and(_.lte(endDate)),
    isDeleted: _.neq(true)
  })
  .group({
    _id: null,
    totalAmount: $.sum('$amount')
  })
  .end()
```

---

## 九、注意事项

### 9.1 数据安全

1. **敏感信息保护**：报销记录可能包含个人敏感信息，需要严格的权限控制
2. **凭证文件安全**：上传的凭证图片应使用云存储的私有读写权限
3. **审计日志**：所有审批操作应记录完整的审计信息

### 9.2 业务规则

1. **单笔金额限制**：根据角色设置不同的单笔报销上限
2. **月度额度限制**：可选择性设置月度报销总额限制
3. **凭证要求**：超过一定金额的报销必须上传凭证
4. **审批时效**：建议设置审批超时提醒机制

### 9.3 性能优化

1. **分页查询**：报销记录列表使用分页，避免一次加载过多数据
2. **索引优化**：确保所有常用查询都有对应的索引
3. **缓存策略**：用户的月度报销统计可以短期缓存

---

## 十、版本历史

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| v1.0 | 2024-03-15 | 初始版本 | 系统设计 |

---

**文档维护**：本文档应随着业务需求变化及时更新
**相关文档**：
- 财务管理云函数设计文档
- 个人中心功能设计文档


