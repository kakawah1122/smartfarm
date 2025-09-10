# 健康管理模块数据库权限配置

## 概述
本文档详细说明了健康管理模块重构后新增数据库集合的权限配置，确保数据安全和访问控制。

## 新增数据库集合权限配置

### 1. 健康记录相关集合

#### `health_records` - 健康记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

#### `death_records` - 死亡记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null", 
  "write": "auth.openid == resource._openid"
}
```

#### `followup_records` - 跟进记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"  
}
```

#### `cure_records` - 治愈记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

### 2. 预防管理相关集合

#### `prevention_records` - 预防记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

#### `vaccine_plans` - 疫苗计划集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

### 3. 诊疗管理相关集合

#### `treatment_records` - 治疗记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

#### `ai_diagnosis_records` - AI诊断记录集合
```javascript
// 权限规则：创建者可读写，其他用户只读
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

### 4. 预警和通知集合

#### `health_alerts` - 健康预警集合
```javascript
// 权限规则：所有用户只读，系统通过云函数写入
{
  "read": "auth.openid != null",
  "write": false
}
```

## 权限配置脚本

### 云开发控制台配置

```javascript
// 在微信云开发控制台的数据库权限设置中，为每个集合配置以下规则：

// 1. health_records
db.collection('health_records').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 2. death_records  
db.collection('death_records').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 3. followup_records
db.collection('followup_records').where({}).get() 
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 4. cure_records
db.collection('cure_records').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null  
// 写入权限：auth.openid == resource._openid

// 5. prevention_records
db.collection('prevention_records').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 6. vaccine_plans
db.collection('vaccine_plans').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 7. treatment_records
db.collection('treatment_records').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 8. ai_diagnosis_records
db.collection('ai_diagnosis_records').where({}).get()
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：auth.openid == resource._openid

// 9. health_alerts
db.collection('health_alerts').where({}).get()  
// 权限设置：
// 读取权限：auth.openid != null
// 写入权限：false （只能通过云函数写入）
```

### 批量权限配置脚本

创建云函数用于批量设置权限：

```javascript
// cloudfunctions/setup-health-permissions/index.js
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const db = cloud.database()
  
  // 健康管理模块集合权限配置
  const collections = [
    'health_records',
    'death_records', 
    'followup_records',
    'cure_records',
    'prevention_records',
    'vaccine_plans',
    'treatment_records',
    'ai_diagnosis_records'
  ]
  
  // 为每个集合设置权限（需要在控制台手动设置，此处仅作记录）
  const permissions = {
    read: 'auth.openid != null',
    write: 'auth.openid == resource._openid'
  }
  
  // 特殊权限集合
  const specialPermissions = {
    health_alerts: {
      read: 'auth.openid != null',
      write: false
    }
  }
  
  console.log('权限配置规则：')
  console.log('标准集合权限：', permissions)
  console.log('特殊权限集合：', specialPermissions)
  
  return {
    success: true,
    message: '权限配置规则已生成，请在微信云开发控制台手动设置'
  }
}
```

## 安全最佳实践

### 1. 数据访问控制
- 所有数据必须通过用户身份验证访问
- 用户只能修改自己创建的记录
- 系统敏感数据（预警）仅通过云函数操作

### 2. 数据完整性保护
- 使用云函数进行数据写入时的业务逻辑验证
- 设置适当的字段验证规则
- 实现数据删除的软删除机制

### 3. API安全
- 所有外部API调用（如AI诊断）的密钥通过云函数环境变量管理
- 不在前端代码中暴露任何敏感信息
- 实施请求频率限制

### 4. 审计和监控
- 记录重要操作的日志
- 监控异常访问模式
- 定期审查权限配置

## 权限配置步骤

### 步骤1：登录微信云开发控制台
1. 访问 [https://console.cloud.tencent.com/tcb](https://console.cloud.tencent.com/tcb)
2. 选择对应的云开发环境

### 步骤2：配置数据库权限
1. 进入数据库管理页面
2. 选择对应的数据库集合
3. 点击"权限设置"
4. 按照上述规则配置读取和写入权限

### 步骤3：测试权限配置
1. 使用测试账号验证权限设置
2. 确保用户只能访问自己的数据
3. 验证云函数可以正常操作系统数据

### 步骤4：部署权限配置
1. 在生产环境应用权限配置
2. 监控权限配置效果
3. 记录配置变更日志

## 故障排除

### 常见权限问题
1. **用户无法读取数据**
   - 检查用户是否已登录
   - 验证 `auth.openid` 是否存在

2. **用户无法写入数据**
   - 确认 `resource._openid` 字段正确设置
   - 检查用户是否为数据创建者

3. **云函数操作失败**
   - 验证云函数具有管理员权限
   - 检查云函数环境配置

### 权限调试
```javascript
// 在云函数中调试权限
const wxContext = cloud.getWXContext()
console.log('用户OpenID:', wxContext.OPENID)
console.log('来源:', wxContext.SOURCE)
console.log('环境:', wxContext.ENV)
```

## 更新记录

| 日期 | 版本 | 更新内容 | 更新人 |
|------|------|----------|--------|
| 2024-01-15 | 1.0.0 | 初始版本，健康管理模块权限配置 | 系统 |

---

**注意：本配置文档基于微信云开发平台，确保在配置前充分理解各项权限规则的影响。**
