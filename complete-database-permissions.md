# 完整数据库权限配置文档

## 概述
本文档详细说明了鹅场管理系统所有数据库集合的权限配置策略，基于用户角色的访问控制（RBAC）模型。

## 权限配置原则

### 1. 最小权限原则
用户只能访问执行其工作职能所必需的数据和功能。

### 2. 角色分离原则
不同角色具有明确分离的权限边界，避免权限冲突。

### 3. 数据所有权原则
用户对自己创建的数据具有完全控制权，对他人数据的访问受到限制。

### 4. 审计追踪原则
所有敏感操作都要求身份验证，并记录操作日志。

## 用户角色定义

### 角色层级
```
super_admin (超级管理员)
    ↓
manager (场主/经理)
    ↓
technician (技术员) / finance (财务人员)
    ↓
employee (普通员工)
    ↓
observer (观察员)
```

### 角色权限矩阵
| 角色 | 生产管理 | 健康管理 | 财务管理 | 用户管理 | 系统配置 |
|------|----------|----------|----------|----------|----------|
| super_admin | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 | ✅ 全部 |
| manager | ✅ 全部 | ✅ 全部 | 🔍 只读 | 👥 部分 | 🚫 无 |
| technician | ✅ 全部 | ✅ 全部 | 🚫 无 | 🔍 只读 | 🚫 无 |
| finance | 🔍 只读 | 🔍 只读 | ✅ 全部 | 🔍 只读 | 🚫 无 |
| employee | 📝 基础 | 📝 基础 | 🚫 无 | 🔍 自己 | 🚫 无 |
| observer | 🔍 只读 | 🔍 只读 | 🔍 只读 | 🔍 只读 | 🚫 无 |

## 集合权限配置

### 1. 生产经营数据集合

#### `entry_records` - 入栏记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `exit_records` - 出栏记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `inventory_logs` - 库存变动日志
```javascript
{
  "read": "auth.openid != null",
  "write": false  // 只能通过云函数写入
}
```

#### `production_batches` - 生产批次管理
```javascript
{
  "read": "auth.openid != null",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician']"
}
```

#### `material_records` - 物料使用记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

### 2. 健康管理数据集合

#### `health_records` - 健康记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `prevention_records` - 预防记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `treatment_records` - 治疗记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `ai_diagnosis_records` - AI诊断记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid"
}
```

#### `vaccine_plans` - 疫苗计划
```javascript
{
  "read": "auth.openid != null",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician']"
}
```

#### `health_alerts` - 健康预警
```javascript
{
  "read": "auth.openid != null",
  "write": false  // 只能通过云函数写入
}
```

#### `death_records` - 死亡记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `followup_records` - 跟进记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

#### `cure_records` - 治愈记录
```javascript
{
  "read": "auth.openid != null",
  "write": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'technician', 'employee']"
}
```

### 3. 财务管理数据集合

#### `cost_records` - 成本记录
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance', 'observer']",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance']"
}
```

#### `revenue_records` - 收入记录
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance', 'observer']",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance']"
}
```

#### `financial_summaries` - 财务汇总
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance', 'observer']",
  "write": false  // 只能通过云函数写入
}
```

#### `financial_reports` - 财务报表
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance', 'observer']",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager', 'finance']"
}
```

### 4. 系统管理数据集合

#### `users` - 用户信息
```javascript
{
  "read": "auth.openid == resource._openid || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']",
  "write": "auth.openid == resource._openid && resource.role == null || get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']"
}
```

#### `roles` - 角色定义
```javascript
{
  "read": "auth.openid != null",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role == 'super_admin'"
}
```

#### `permissions` - 权限配置
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role == 'super_admin'"
}
```

#### `employee_invites` - 员工邀请
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']"
}
```

#### `audit_logs` - 操作审计日志
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']",
  "write": false  // 只能通过云函数写入
}
```

#### `notifications` - 通知记录
```javascript
{
  "read": "auth.openid != null",
  "write": false  // 只能通过云函数写入
}
```

#### `user_notifications` - 用户通知状态
```javascript
{
  "read": "auth.openid == resource._openid",
  "write": "auth.openid == resource._openid"
}
```

#### `system_configs` - 系统配置
```javascript
{
  "read": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role in ['super_admin', 'manager']",
  "write": "get('database').collection('users').where({_openid: auth.openid}).get().data[0].role == 'super_admin'"
}
```

## 权限配置脚本

### 自动化配置云函数

创建 `setup-complete-permissions` 云函数：

```javascript
// cloudfunctions/setup-complete-permissions/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const COLLECTION_PERMISSIONS = {
  // 生产经营数据 - 所有用户可读，创建者和高级角色可写
  production_data: {
    collections: ['entry_records', 'exit_records', 'material_records'],
    read: 'auth.openid != null',
    write: 'auth.openid == resource._openid || getUserRole(auth.openid) in ["super_admin", "manager", "technician", "employee"]'
  },
  
  // 生产管理数据 - 技术员及以上可管理
  production_management: {
    collections: ['production_batches', 'vaccine_plans'],
    read: 'auth.openid != null',
    write: 'getUserRole(auth.openid) in ["super_admin", "manager", "technician"]'
  },
  
  // 健康数据 - 所有用户可读，创建者和相关角色可写
  health_data: {
    collections: ['health_records', 'prevention_records', 'treatment_records', 'death_records', 'followup_records', 'cure_records'],
    read: 'auth.openid != null',
    write: 'auth.openid == resource._openid || getUserRole(auth.openid) in ["super_admin", "manager", "technician", "employee"]'
  },
  
  // AI诊断数据 - 创建者可读写
  ai_data: {
    collections: ['ai_diagnosis_records'],
    read: 'auth.openid != null',
    write: 'auth.openid == resource._openid'
  },
  
  // 系统预警数据 - 只读，云函数写入
  system_alerts: {
    collections: ['health_alerts', 'inventory_logs'],
    read: 'auth.openid != null',
    write: false
  },
  
  // 财务数据 - 财务角色可读写，管理员可读
  finance_data: {
    collections: ['cost_records', 'revenue_records', 'financial_reports'],
    read: 'getUserRole(auth.openid) in ["super_admin", "manager", "finance", "observer"]',
    write: 'getUserRole(auth.openid) in ["super_admin", "manager", "finance"]'
  },
  
  // 财务汇总 - 财务角色可读，系统写入
  finance_summary: {
    collections: ['financial_summaries'],
    read: 'getUserRole(auth.openid) in ["super_admin", "manager", "finance", "observer"]',
    write: false
  },
  
  // 用户数据 - 自己可读写，管理员可管理
  user_data: {
    collections: ['users'],
    read: 'auth.openid == resource._openid || getUserRole(auth.openid) in ["super_admin", "manager"]',
    write: '(auth.openid == resource._openid && !exists(resource.role)) || getUserRole(auth.openid) in ["super_admin", "manager"]'
  },
  
  // 管理数据 - 管理员可读写
  admin_data: {
    collections: ['employee_invites', 'permissions', 'system_configs'],
    read: 'getUserRole(auth.openid) in ["super_admin", "manager"]',
    write: 'getUserRole(auth.openid) in ["super_admin", "manager"]'
  },
  
  // 系统数据 - 管理员可读，系统写入
  system_data: {
    collections: ['audit_logs', 'notifications'],
    read: 'getUserRole(auth.openid) in ["super_admin", "manager"]',
    write: false
  },
  
  // 公共数据 - 所有用户可读
  public_data: {
    collections: ['roles'],
    read: 'auth.openid != null',
    write: 'getUserRole(auth.openid) == "super_admin"'
  },
  
  // 个人通知 - 用户自己可读写
  personal_data: {
    collections: ['user_notifications'],
    read: 'auth.openid == resource._openid',
    write: 'auth.openid == resource._openid'
  }
}

exports.main = async (event, context) => {
  const { action } = event
  
  try {
    switch (action) {
      case 'generate_permissions':
        return generatePermissionConfig()
      case 'validate_permissions':
        return validatePermissions(event.collection)
      case 'get_user_role':
        return getUserRole(event.openid)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

function generatePermissionConfig() {
  const config = {}
  
  Object.keys(COLLECTION_PERMISSIONS).forEach(categoryKey => {
    const category = COLLECTION_PERMISSIONS[categoryKey]
    category.collections.forEach(collection => {
      config[collection] = {
        read: category.read,
        write: category.write,
        category: categoryKey
      }
    })
  })
  
  return {
    success: true,
    data: {
      permissions: config,
      instructions: [
        '1. 在微信云开发控制台进入数据库管理',
        '2. 为每个集合设置对应的权限规则',
        '3. 注意：getUserRole() 函数需要在权限规则中实现',
        '4. 建议使用云函数进行复杂的权限验证'
      ]
    }
  }
}

// 简化的用户角色获取（实际应该通过数据库查询）
async function getUserRole(openid) {
  try {
    const db = cloud.database()
    const user = await db.collection('users').where({ _openid: openid }).get()
    return user.data.length > 0 ? user.data[0].role : 'employee'
  } catch (error) {
    return 'employee'
  }
}
```

### 批量权限设置脚本

```bash
#!/bin/bash
# setup-database-permissions.sh

echo "设置数据库权限配置..."

# 定义集合和权限的映射
declare -A PERMISSIONS=(
  # 生产数据
  ["entry_records"]="read:all,write:creator_or_role"
  ["exit_records"]="read:all,write:creator_or_role"
  ["material_records"]="read:all,write:creator_or_role"
  ["production_batches"]="read:all,write:role_only"
  ["inventory_logs"]="read:all,write:false"
  
  # 健康数据
  ["health_records"]="read:all,write:creator_or_role"
  ["prevention_records"]="read:all,write:creator_or_role"
  ["treatment_records"]="read:all,write:creator_or_role"
  ["ai_diagnosis_records"]="read:all,write:creator_only"
  ["vaccine_plans"]="read:all,write:role_only"
  ["health_alerts"]="read:all,write:false"
  ["death_records"]="read:all,write:creator_or_role"
  ["followup_records"]="read:all,write:creator_or_role"
  ["cure_records"]="read:all,write:creator_or_role"
  
  # 财务数据
  ["cost_records"]="read:finance_role,write:finance_role"
  ["revenue_records"]="read:finance_role,write:finance_role"
  ["financial_summaries"]="read:finance_role,write:false"
  ["financial_reports"]="read:finance_role,write:finance_role"
  
  # 系统数据
  ["users"]="read:admin_or_self,write:admin_or_self_limited"
  ["roles"]="read:all,write:super_admin_only"
  ["permissions"]="read:admin_role,write:super_admin_only"
  ["employee_invites"]="read:admin_role,write:admin_role"
  ["audit_logs"]="read:admin_role,write:false"
  ["notifications"]="read:all,write:false"
  ["user_notifications"]="read:self_only,write:self_only"
  ["system_configs"]="read:admin_role,write:super_admin_only"
)

# 生成权限配置文件
generate_permission_rules() {
  echo "生成权限配置规则..."
  
  cat > database-permission-rules.json << 'EOF'
{
  "permissions": {
    "all_users": "auth.openid != null",
    "creator_only": "auth.openid == resource._openid",
    "creator_or_role": "auth.openid == resource._openid || getUserRole(auth.openid) in [\"super_admin\", \"manager\", \"technician\", \"employee\"]",
    "role_only": "getUserRole(auth.openid) in [\"super_admin\", \"manager\", \"technician\"]",
    "finance_role": "getUserRole(auth.openid) in [\"super_admin\", \"manager\", \"finance\", \"observer\"]",
    "admin_role": "getUserRole(auth.openid) in [\"super_admin\", \"manager\"]",
    "admin_or_self": "auth.openid == resource._openid || getUserRole(auth.openid) in [\"super_admin\", \"manager\"]",
    "admin_or_self_limited": "(auth.openid == resource._openid && !exists(resource.role)) || getUserRole(auth.openid) in [\"super_admin\", \"manager\"]",
    "super_admin_only": "getUserRole(auth.openid) == \"super_admin\"",
    "self_only": "auth.openid == resource._openid",
    "system_only": false
  },
  "collections": {}
}
EOF

  echo "权限配置规则已生成：database-permission-rules.json"
}

# 生成部署指令
generate_deployment_commands() {
  echo "生成部署指令..."
  
  cat > deploy-permissions.md << 'EOF'
# 数据库权限部署指令

## 在微信云开发控制台执行以下配置

### 1. 生产经营数据集合
EOF

  for collection in "${!PERMISSIONS[@]}"; do
    IFS=',' read -ra PERM_ARRAY <<< "${PERMISSIONS[$collection]}"
    
    echo "#### $collection" >> deploy-permissions.md
    echo '```javascript' >> deploy-permissions.md
    echo "// 读取权限: ${PERM_ARRAY[0]#*:}" >> deploy-permissions.md
    echo "// 写入权限: ${PERM_ARRAY[1]#*:}" >> deploy-permissions.md
    echo '```' >> deploy-permissions.md
    echo '' >> deploy-permissions.md
  done
  
  echo "部署指令已生成：deploy-permissions.md"
}

# 主函数
main() {
  echo "开始设置数据库权限配置..."
  
  generate_permission_rules
  generate_deployment_commands
  
  echo "权限配置完成！"
  echo "请参考以下文件："
  echo "  - database-permission-rules.json: 权限规则定义"
  echo "  - deploy-permissions.md: 部署指令"
}

# 运行主函数
main "$@"
```

## 权限验证实现

### 云函数权限验证模板

```javascript
// 权限验证辅助函数
async function validatePermission(openid, action, resource) {
  try {
    const db = cloud.database()
    const user = await db.collection('users').where({ _openid: openid }).get()
    
    if (user.data.length === 0) {
      return { hasPermission: false, reason: '用户不存在' }
    }
    
    const userRole = user.data[0].role || 'employee'
    const userStatus = user.data[0].status || 'inactive'
    
    // 检查用户状态
    if (userStatus !== 'active') {
      return { hasPermission: false, reason: '用户账户未激活' }
    }
    
    // 检查资源所有权
    if (resource && resource._openid && resource._openid !== openid) {
      // 检查角色权限
      const rolePermissions = {
        'super_admin': ['*'],
        'manager': ['production.*', 'health.*', 'finance.read', 'user.manage'],
        'technician': ['production.*', 'health.*'],
        'finance': ['finance.*', 'production.read', 'health.read'],
        'employee': ['production.create', 'production.read', 'health.create', 'health.read'],
        'observer': ['*.read']
      }
      
      const userPerms = rolePermissions[userRole] || []
      const hasRolePermission = userPerms.some(perm => {
        if (perm === '*') return true
        if (perm === action) return true
        if (perm.endsWith('.*') && action.startsWith(perm.slice(0, -2))) return true
        return false
      })
      
      if (!hasRolePermission) {
        return { hasPermission: false, reason: '角色权限不足' }
      }
    }
    
    return { hasPermission: true, userRole, userStatus }
  } catch (error) {
    console.error('权限验证失败:', error)
    return { hasPermission: false, reason: '权限验证异常' }
  }
}

// 在云函数中使用权限验证
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  // 验证权限
  const permission = await validatePermission(wxContext.OPENID, action, event.resource)
  if (!permission.hasPermission) {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: permission.reason
    }
  }
  
  // 继续业务逻辑...
}
```

## 安全最佳实践

### 1. 敏感数据保护
- 财务数据仅对授权角色可见
- 用户个人信息加密存储
- API密钥通过环境变量管理

### 2. 访问控制
- 定期审查用户权限
- 实施最小权限原则
- 监控异常访问行为

### 3. 数据完整性
- 重要操作记录审计日志
- 实施数据变更追踪
- 定期备份关键数据

### 4. 安全监控
- 监控权限变更操作
- 检测异常登录行为
- 设置安全告警机制

## 部署检查清单

- [ ] 所有集合权限规则已配置
- [ ] 用户角色体系已建立
- [ ] 权限验证云函数已部署
- [ ] 审计日志功能已启用
- [ ] 安全监控已配置
- [ ] 权限测试已通过
- [ ] 文档已更新

这个完整的权限配置确保了系统数据的安全性和访问控制的精确性，为鹅场管理系统提供了坚实的安全基础。
