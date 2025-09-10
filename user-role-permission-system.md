# 用户角色和权限管理体系设计

## 概述
本文档详细设计了鹅场管理系统的用户角色和权限管理体系，包括角色定义、权限矩阵、管理流程和技术实现方案。

## 角色体系设计

### 1. 角色层级结构
```
鹅场管理系统角色体系
├── 超级管理员 (super_admin)
│   └── 系统全局管理权限
├── 经理 (manager)
│   └── 业务运营管理权限
├── 员工 (employee)
│   └── 日常操作执行权限
└── 兽医 (veterinarian)
    └── 健康诊疗专业权限
```

### 2. 角色详细定义

#### 超级管理员 (super_admin)
**职责范围**：
- 系统全局管理和配置
- 用户角色分配和权限管理
- 系统监控和维护
- 数据备份和恢复
- 安全策略制定和审计

**功能权限**：
- 所有业务模块完全访问权限
- 用户管理：创建、编辑、删除、角色分配
- 系统配置：参数设置、功能开关、环境配置
- 数据管理：导入、导出、备份、恢复
- 监控管理：日志查看、性能监控、告警设置

**数据权限**：
- 所有数据的完全访问权限
- 敏感数据查看权限（财务、用户隐私等）
- 历史数据查看和管理权限

#### 经理 (manager)
**职责范围**：
- 鹅场整体运营管理
- 业务决策制定和执行监督
- 各部门工作协调
- 绩效考核和目标管理
- 对外业务沟通

**功能权限**：
- 生产管理：批次规划、进度监控、质量管理
- 健康管理：健康策略制定、疫病防控决策
- 财务管理：预算审批、成本控制、收支监督
- 人员管理：员工管理、工作安排、考核评价
- 报表分析：各类业务报表查看和分析

**数据权限**：
- 所有业务数据的查看权限
- 财务汇总数据查看权限
- 跨模块数据关联分析权限
- 部分敏感数据查看权限（需审批）

#### 员工 (employee)
**职责范围**：
- 日常生产操作执行
- 基础数据记录和维护
- 设备使用和基础维护
- 异常情况及时上报
- 工作规范遵守

**功能权限**：
- 生产管理：入栏/出栏记录、饲料记录、日常观察
- 健康管理：基础健康检查记录、异常情况上报
- AI诊断：AI诊断发起、结果查看、诊断验证
- 物料管理：物料使用记录、库存查看
- 个人管理：个人信息维护、工作记录查看

**数据权限**：
- 自己创建数据的编辑权限
- 分配批次/区域数据的查看和操作权限
- 基础参考数据查看权限
- 个人工作数据查看权限

#### 兽医 (veterinarian)
**职责范围**：
- 动物健康检查和诊断
- 疾病治疗方案制定和执行
- 疫苗接种计划和实施
- AI诊断结果验证和确认
- 健康数据专业分析

**功能权限**：
- 健康管理：完整的诊疗权限、处方开具、疫苗管理
- AI诊断：AI诊断发起、结果验证、专业建议
- 生产管理：健康相关的生产建议、质量评估
- 报表分析：健康相关数据分析和报告

**数据权限**：
- 所有健康相关数据的完全访问权限
- AI诊断数据的验证和修改权限
- 健康档案的创建和管理权限
- 跨批次健康数据对比分析权限

## 权限矩阵设计

### 功能模块权限矩阵

| 功能模块 | 超级管理员 | 经理 | 员工 | 兽医 |
|---------|-----------|------|------|------|
| **用户管理** |
| 用户创建 | ✓ | ✓ | ✗ | ✗ |
| 用户编辑 | ✓ | ✓ | ◐ | ◐ |
| 角色分配 | ✓ | ✓ | ✗ | ✗ |
| 用户禁用 | ✓ | ✓ | ✗ | ✗ |
| **生产管理** |
| 批次创建 | ✓ | ✓ | ✗ | ✗ |
| 批次管理 | ✓ | ✓ | ◐ | ◐ |
| 入栏记录 | ✓ | ✓ | ✓ | ◐ |
| 出栏记录 | ✓ | ✓ | ✓ | ◐ |
| 物料管理 | ✓ | ✓ | ✓ | ◐ |
| 生产报表 | ✓ | ✓ | ◐ | ◐ |
| **健康管理** |
| 健康记录 | ✓ | ✓ | ✓ | ✓ |
| 诊疗管理 | ✓ | ✓ | ◐ | ✓ |
| 疫苗管理 | ✓ | ✓ | ◐ | ✓ |
| AI诊断 | ✓ | ✓ | ✓ | ✓ |
| 处方开具 | ✓ | ◐ | ✗ | ✓ |
| 健康报表 | ✓ | ✓ | ◐ | ✓ |
| **财务管理** |
| 收入记录 | ✓ | ✓ | ✗ | ✗ |
| 支出记录 | ✓ | ✓ | ✗ | ✗ |
| 成本分析 | ✓ | ✓ | ✗ | ✗ |
| 财务报表 | ✓ | ✓ | ✗ | ✗ |
| **系统管理** |
| 系统配置 | ✓ | ✗ | ✗ | ✗ |
| 数据备份 | ✓ | ◐ | ✗ | ✗ |
| 日志查看 | ✓ | ✓ | ✗ | ✗ |
| 权限管理 | ✓ | ✓ | ✗ | ✗ |
| **个人中心** |
| 个人信息 | ✓ | ✓ | ✓ | ✓ |
| 密码修改 | ✓ | ✓ | ✓ | ✓ |
| 工作记录 | ✓ | ✓ | ✓ | ✓ |

**图例**：
- ✓ 完全权限（增删改查）
- ◐ 部分权限（查看、特定操作）
- ✗ 无权限

**权限说明**：
- **超级管理员**：拥有所有功能的完全权限
- **经理**：拥有业务管理权限，无系统配置权限
- **员工**：拥有日常操作权限，包括AI诊断功能，无管理和财务权限
- **兽医**：拥有健康相关的专业权限，可查看生产相关数据

### 操作级别权限矩阵

| 操作类型 | 超级管理员 | 经理 | 员工 | 兽医 |
|---------|-----------|------|------|------|
| **数据操作** |
| 创建 (Create) | ✓ | ✓ | ◐ | ◐ |
| 读取 (Read) | ✓ | ✓ | ✓ | ✓ |
| 更新 (Update) | ✓ | ✓ | ◐ | ◐ |
| 删除 (Delete) | ✓ | ◐ | ✗ | ✗ |
| **批量操作** |
| 批量导入 | ✓ | ✓ | ✗ | ◐ |
| 批量导出 | ✓ | ✓ | ◐ | ✓ |
| 批量删除 | ✓ | ◐ | ✗ | ✗ |
| **审批流程** |
| 提交申请 | ✓ | ✓ | ✓ | ✓ |
| 审批申请 | ✓ | ✓ | ✗ | ◐ |
| 撤销申请 | ✓ | ✓ | ✓ | ✓ |

**操作权限说明**：
- **数据操作**：基础的CRUD操作权限
- **批量操作**：大批量数据处理权限
- **审批流程**：业务流程审批权限

**各角色操作特点**：
- **超级管理员**：所有操作完全权限
- **经理**：管理级操作权限，部分删除限制
- **员工**：基础操作权限，包括AI诊断完全权限，无删除和批量权限
- **兽医**：专业领域完全权限，其他领域受限

## 权限控制实现

### 1. 角色权限数据结构

#### 角色定义集合 (roles)
```javascript
{
  "_id": "role_id",
  "roleCode": "super_admin",
  "roleName": "超级管理员",
  "roleDescription": "系统超级管理员，拥有所有权限",
  "level": 1,                    // 角色等级，数字越小等级越高
  "parentRole": null,            // 父角色ID，用于角色继承
  "isActive": true,
  "permissions": [               // 角色拥有的权限列表
    {
      "module": "user_management",
      "actions": ["create", "read", "update", "delete", "assign_role"],
      "conditions": null         // 权限条件，null表示无条件
    },
    {
      "module": "production_management",
      "actions": ["create", "read", "update", "delete", "batch_operation"],
      "conditions": null
    }
  ],
  "restrictions": {              // 角色限制
    "maxConcurrentSessions": 5,  // 最大并发会话数
    "allowedIpRanges": [],       // 允许的IP范围
    "timeRestrictions": {        // 时间限制
      "allowedHours": [6, 22],   // 允许访问时间（6:00-22:00）
      "allowedDays": [1,2,3,4,5,6,7] // 允许访问日期（1-7对应周一到周日）
    }
  },
  "createTime": "2024-01-01T00:00:00.000Z",
  "updateTime": "2024-01-01T00:00:00.000Z"
}
```

#### 用户角色关联集合 (user_roles)
```javascript
{
  "_id": "user_role_id",
  "openid": "user_openid",
  "roleCode": "manager",
  "assignedBy": "admin_openid",
  "assignTime": "2024-01-01T00:00:00.000Z",
  "expiryTime": null,            // 角色过期时间，null表示永不过期
  "isActive": true,
  "additionalPermissions": [     // 额外权限
    {
      "module": "finance_management",
      "actions": ["read"],
      "reason": "临时财务查看权限",
      "expiryTime": "2024-12-31T23:59:59.999Z"
    }
  ],
  "deniedPermissions": [         // 被拒绝的权限
    {
      "module": "system_management",
      "actions": ["delete"],
      "reason": "安全考虑"
    }
  ]
}
```

#### 权限模块定义集合 (permission_modules)
```javascript
{
  "_id": "module_id",
  "moduleCode": "production_management",
  "moduleName": "生产管理",
  "description": "鹅场生产相关的管理功能",
  "availableActions": [
    {
      "actionCode": "create",
      "actionName": "创建",
      "description": "创建生产记录"
    },
    {
      "actionCode": "read",
      "actionName": "查看",
      "description": "查看生产数据"
    },
    {
      "actionCode": "update",
      "actionName": "更新",
      "description": "更新生产记录"
    },
    {
      "actionCode": "delete",
      "actionName": "删除",
      "description": "删除生产记录"
    },
    {
      "actionCode": "batch_operation",
      "actionName": "批量操作",
      "description": "批量导入导出操作"
    }
  ],
  "isActive": true
}
```

### 2. 权限验证云函数

#### cloudfunctions/permission-check/index.js
```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { action, module, resourceId, additionalContext } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 检查用户权限
    const hasPermission = await checkUserPermission(
      OPENID, 
      module, 
      action, 
      resourceId, 
      additionalContext
    )
    
    // 记录权限检查日志
    await logPermissionCheck(OPENID, module, action, hasPermission)
    
    return {
      success: true,
      hasPermission,
      message: hasPermission ? '权限验证通过' : '权限不足'
    }
  } catch (error) {
    console.error('权限检查失败：', error)
    return {
      success: false,
      hasPermission: false,
      message: '权限检查失败',
      error: error.message
    }
  }
}

// 检查用户权限
async function checkUserPermission(openid, module, action, resourceId, context) {
  // 1. 获取用户角色
  const userRoles = await getUserRoles(openid)
  if (!userRoles.length) {
    return false
  }
  
  // 2. 检查每个角色的权限
  for (const userRole of userRoles) {
    const rolePermissions = await getRolePermissions(userRole.roleCode)
    
    // 3. 检查模块权限
    const modulePermission = rolePermissions.permissions.find(p => p.module === module)
    if (!modulePermission) {
      continue
    }
    
    // 4. 检查操作权限
    if (!modulePermission.actions.includes(action)) {
      continue
    }
    
    // 5. 检查权限条件
    if (modulePermission.conditions) {
      const conditionMet = await evaluatePermissionConditions(
        modulePermission.conditions, 
        openid, 
        resourceId, 
        context
      )
      if (!conditionMet) {
        continue
      }
    }
    
    // 6. 检查被拒绝的权限
    const isDenied = userRole.deniedPermissions?.some(dp => 
      dp.module === module && dp.actions.includes(action)
    )
    if (isDenied) {
      continue
    }
    
    // 7. 检查时间和IP限制
    const restrictionPassed = await checkRestrictions(rolePermissions.restrictions, context)
    if (!restrictionPassed) {
      continue
    }
    
    // 如果通过所有检查，返回true
    return true
  }
  
  return false
}

// 获取用户角色
async function getUserRoles(openid) {
  const result = await db.collection('user_roles')
    .where({
      openid,
      isActive: true,
      $expr: {
        $or: [
          { expiryTime: null },
          { expiryTime: { $gt: new Date() } }
        ]
      }
    })
    .get()
  
  return result.data
}

// 获取角色权限
async function getRolePermissions(roleCode) {
  const result = await db.collection('roles')
    .where({
      roleCode,
      isActive: true
    })
    .get()
  
  return result.data[0]
}

// 评估权限条件
async function evaluatePermissionConditions(conditions, openid, resourceId, context) {
  // 条件评估逻辑
  // 例如：只能访问自己创建的资源
  if (conditions.ownerOnly) {
    const resource = await getResourceOwner(resourceId)
    return resource.creator === openid
  }
  
  // 例如：只能在特定时间段访问
  if (conditions.timeRestriction) {
    const currentHour = new Date().getHours()
    return currentHour >= conditions.timeRestriction.start && 
           currentHour <= conditions.timeRestriction.end
  }
  
  return true
}

// 检查角色限制
async function checkRestrictions(restrictions, context) {
  if (!restrictions) return true
  
  // 检查时间限制
  if (restrictions.timeRestrictions) {
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay() || 7 // 将周日从0转为7
    
    const { allowedHours, allowedDays } = restrictions.timeRestrictions
    
    if (allowedHours && (currentHour < allowedHours[0] || currentHour > allowedHours[1])) {
      return false
    }
    
    if (allowedDays && !allowedDays.includes(currentDay)) {
      return false
    }
  }
  
  // 检查IP限制
  if (restrictions.allowedIpRanges && restrictions.allowedIpRanges.length > 0) {
    const userIp = context.SOURCE
    const isAllowedIp = restrictions.allowedIpRanges.some(range => 
      isIpInRange(userIp, range)
    )
    if (!isAllowedIp) {
      return false
    }
  }
  
  return true
}

// 记录权限检查日志
async function logPermissionCheck(openid, module, action, hasPermission) {
  await db.collection('permission_logs').add({
    data: {
      openid,
      module,
      action,
      hasPermission,
      timestamp: new Date(),
      source: 'permission_check'
    }
  })
}
```

### 3. 前端权限控制组件

#### miniprogram/components/permission-wrapper/permission-wrapper.ts
```typescript
Component({
  properties: {
    module: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    resourceId: {
      type: String,
      value: ''
    },
    showLoader: {
      type: Boolean,
      value: true
    },
    fallbackContent: {
      type: String,
      value: '您没有权限访问此功能'
    }
  },

  data: {
    hasPermission: false,
    loading: true,
    error: ''
  },

  lifetimes: {
    attached() {
      this.checkPermission()
    }
  },

  observers: {
    'module, action, resourceId': function() {
      this.checkPermission()
    }
  },

  methods: {
    async checkPermission() {
      this.setData({ loading: true, error: '' })
      
      try {
        const result = await wx.cloud.callFunction({
          name: 'permission-check',
          data: {
            module: this.data.module,
            action: this.data.action,
            resourceId: this.data.resourceId
          }
        })
        
        if (result.result.success) {
          this.setData({
            hasPermission: result.result.hasPermission,
            loading: false
          })
        } else {
          throw new Error(result.result.message)
        }
      } catch (error) {
        console.error('权限检查失败：', error)
        this.setData({
          hasPermission: false,
          loading: false,
          error: error.message
        })
      }
    }
  }
})
```

#### miniprogram/components/permission-wrapper/permission-wrapper.wxml
```xml
<view wx:if="{{loading && showLoader}}" class="permission-loading">
  <t-loading theme="circular" size="24rpx" text="权限验证中..." />
</view>

<view wx:elif="{{hasPermission}}" class="permission-content">
  <slot></slot>
</view>

<view wx:else class="permission-denied">
  <t-empty icon="lock" description="{{error || fallbackContent}}" />
</view>
```

### 4. 权限管理页面

#### miniprogram/pages/permission-management/permission-management.ts
```typescript
Page({
  data: {
    users: [],
    roles: [],
    selectedUser: null,
    showRoleDialog: false,
    loading: false
  },

  onLoad() {
    this.loadUsers()
    this.loadRoles()
  },

  async loadUsers() {
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: { action: 'list_users' }
      })
      
      this.setData({
        users: result.result.users,
        loading: false
      })
    } catch (error) {
      console.error('加载用户列表失败：', error)
      this.setData({ loading: false })
    }
  },

  async loadRoles() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: { action: 'list_roles' }
      })
      
      this.setData({ roles: result.result.roles })
    } catch (error) {
      console.error('加载角色列表失败：', error)
    }
  },

  onAssignRole(event) {
    const user = event.currentTarget.dataset.user
    this.setData({
      selectedUser: user,
      showRoleDialog: true
    })
  },

  async onRoleConfirm(event) {
    const { selectedUser } = this.data
    const roleCode = event.detail.value
    
    try {
      await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'assign_role',
          openid: selectedUser.openid,
          roleCode
        }
      })
      
      wx.showToast({
        title: '角色分配成功',
        icon: 'success'
      })
      
      this.setData({ showRoleDialog: false })
      this.loadUsers()
    } catch (error) {
      console.error('角色分配失败：', error)
      wx.showToast({
        title: '角色分配失败',
        icon: 'error'
      })
    }
  },

  async onRevokeRole(event) {
    const { user, role } = event.currentTarget.dataset
    
    const result = await wx.showModal({
      title: '确认操作',
      content: `确定要撤销 ${user.nickName} 的 ${role.roleName} 角色吗？`
    })
    
    if (result.confirm) {
      try {
        await wx.cloud.callFunction({
          name: 'user-management',
          data: {
            action: 'revoke_role',
            openid: user.openid,
            roleCode: role.roleCode
          }
        })
        
        wx.showToast({
          title: '角色撤销成功',
          icon: 'success'
        })
        
        this.loadUsers()
      } catch (error) {
        console.error('角色撤销失败：', error)
        wx.showToast({
          title: '角色撤销失败',
          icon: 'error'
        })
      }
    }
  }
})
```

## 部署和配置指南

### 1. 数据库集合创建
```shell
# 创建角色权限相关集合
wxcloud db createCollection roles
wxcloud db createCollection user_roles
wxcloud db createCollection permission_modules
wxcloud db createCollection permission_logs
```

### 2. 初始角色数据导入
```javascript
// 初始化角色数据脚本
const initRoles = async () => {
  const roles = [
    {
      roleCode: 'super_admin',
      roleName: '超级管理员',
      roleDescription: '系统超级管理员，拥有所有权限',
      level: 1,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: '*',
          actions: ['*'],
          conditions: null
        }
      ],
      restrictions: {
        maxConcurrentSessions: 10,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [0, 23],
          allowedDays: [1, 2, 3, 4, 5, 6, 7]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'manager',
      roleName: '经理',
      roleDescription: '鹅场经理，负责整体运营管理',
      level: 2,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'production_management',
          actions: ['create', 'read', 'update', 'delete', 'batch_operation'],
          conditions: null
        },
        {
          module: 'health_management',
          actions: ['create', 'read', 'update', 'delete'],
          conditions: null
        },
        {
          module: 'finance_management',
          actions: ['create', 'read', 'update', 'delete', 'report_view'],
          conditions: null
        },
        {
          module: 'user_management',
          actions: ['create', 'read', 'update', 'assign_role'],
          conditions: null
        },
        {
          module: 'ai_diagnosis',
          actions: ['create', 'read', 'validate'],
          conditions: null
        }
      ],
      restrictions: {
        maxConcurrentSessions: 5,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [6, 22],
          allowedDays: [1, 2, 3, 4, 5, 6, 7]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'employee',
      roleName: '员工',
      roleDescription: '普通员工，负责日常操作和数据录入',
      level: 3,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'production_management',
          actions: ['create', 'read', 'update'],
          conditions: {
            batchAccess: true,
            resourceCollection: 'production_entry_records'
          }
        },
        {
          module: 'health_management',
          actions: ['create', 'read', 'update'],
          conditions: {
            batchAccess: true,
            resourceCollection: 'health_records'
          }
        },
        {
          module: 'ai_diagnosis',
          actions: ['create', 'read', 'validate'],
          conditions: null
        },
        {
          module: 'user_management',
          actions: ['read', 'update'],
          conditions: {
            ownerOnly: true
          }
        }
      ],
      restrictions: {
        maxConcurrentSessions: 2,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [6, 18],
          allowedDays: [1, 2, 3, 4, 5, 6]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'veterinarian',
      roleName: '兽医',
      roleDescription: '兽医，负责动物健康诊疗和AI诊断验证',
      level: 3,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'health_management',
          actions: ['create', 'read', 'update', 'delete', 'diagnosis', 'treatment', 'prescription'],
          conditions: null
        },
        {
          module: 'ai_diagnosis',
          actions: ['create', 'read', 'validate', 'modify'],
          conditions: null
        },
        {
          module: 'production_management',
          actions: ['read'],
          conditions: {
            healthRelated: true
          }
        },
        {
          module: 'user_management',
          actions: ['read', 'update'],
          conditions: {
            ownerOnly: true
          }
        }
      ],
      restrictions: {
        maxConcurrentSessions: 3,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [6, 22],
          allowedDays: [1, 2, 3, 4, 5, 6, 7]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    }
  ]
  
  for (const role of roles) {
    await db.collection('roles').add({ data: role })
  }
}
```

### 3. 权限中间件配置
```javascript
// 云函数权限中间件
const permissionMiddleware = async (event, context, next) => {
  const { action, module } = event
  const { OPENID } = cloud.getWXContext()
  
  // 检查权限
  const permissionResult = await cloud.callFunction({
    name: 'permission-check',
    data: { action, module }
  })
  
  if (!permissionResult.result.hasPermission) {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: '权限不足'
    }
  }
  
  return next()
}

// 在云函数中使用中间件
exports.main = async (event, context) => {
  return permissionMiddleware(event, context, async () => {
    // 业务逻辑
    return { success: true, data: 'some data' }
  })
}
```

这个完整的用户角色和权限管理体系为鹅场管理系统提供了精细化的权限控制，确保数据安全和操作规范。
