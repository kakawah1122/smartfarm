# 鹅场管理系统完整部署配置指导

## 概述
本文档详细指导如何从零开始部署鹅场管理系统，包括环境准备、云开发配置、数据库设计、云函数部署、权限设置、前端配置和系统监控等全方位指导。

## 目录
1. [环境准备](#环境准备)
2. [微信云开发环境配置](#微信云开发环境配置)
3. [数据库部署配置](#数据库部署配置)
4. [云函数部署](#云函数部署)
5. [云存储配置](#云存储配置)
6. [权限系统部署](#权限系统部署)
7. [前端小程序配置](#前端小程序配置)
8. [系统初始化](#系统初始化)
9. [监控和日志配置](#监控和日志配置)
10. [安全配置](#安全配置)
11. [性能优化配置](#性能优化配置)
12. [备份和恢复策略](#备份和恢复策略)
13. [运维管理](#运维管理)
14. [故障排除](#故障排除)

## 环境准备

### 1. 必要工具安装

#### 微信开发者工具
```bash
# 下载并安装微信开发者工具
# 官方下载链接：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
```

#### Node.js 环境
```bash
# 推荐使用 Node.js 14.x 或更高版本
node --version  # 应显示 v14.x.x 或更高

# 如果需要安装 Node.js
# macOS 使用 Homebrew
brew install node

# Ubuntu/Debian
sudo apt-get install nodejs npm

# Windows
# 访问 https://nodejs.org/ 下载安装包
```

#### 微信云开发 CLI 工具
```bash
# 全局安装微信云开发CLI
npm install -g @cloudbase/cli

# 验证安装
tcb --version

# 登录云开发
tcb login
```

### 2. 微信小程序账号准备

#### 注册小程序账号
1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 注册小程序账号
3. 获取 AppID
4. 完成小程序基本信息填写

#### 开通云开发服务
1. 登录小程序后台
2. 进入"云开发" → "开通"
3. 创建云开发环境
4. 记录环境 ID（env_id）

## 微信云开发环境配置

### 1. 环境配置参数

#### 基础配置
```javascript
// project.config.json
{
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "preloadBackgroundData": false,
    "minified": true,
    "newFeature": true,
    "coverView": true,
    "nodeModules": false,
    "autoAudits": false,
    "showShadowRootInWxmlPanel": true,
    "scopeDataCheck": false,
    "uglifyFileName": false,
    "checkInvalidKey": true,
    "checkSiteMap": true,
    "uploadWithSourceMap": true,
    "compileHotReLoad": false,
    "useMultiFrameRuntime": true,
    "useApiHook": true,
    "useApiHostProcess": true,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    },
    "bundle": false,
    "useIsolateContext": true,
    "useCompilerModule": true,
    "userConfirmedUseIsolateContext": true
  },
  "appid": "your_app_id_here",
  "projectname": "goose_farm_management",
  "debugOptions": {
    "hidedInDevtools": []
  },
  "cloudfunctionTemplateRoot": "cloudfunctionTemplate/",
  "compileType": "miniprogram",
  "libVersion": "2.19.4",
  "packOptions": {
    "ignore": []
  },
  "condition": {},
  "editorType": "vscode"
}
```

#### 云开发配置
```javascript
// miniprogram/app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'your_env_id_here', // 云开发环境ID
        traceUser: true,
      })
    }
  }
})
```

### 2. 环境变量配置

#### 云函数环境变量
```bash
# 进入云开发控制台设置以下环境变量

# AI API配置
AI_API_KEY=your_ai_api_key_here
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL_NAME=gpt-3.5-turbo

# 系统配置
SYSTEM_NAME=鹅场管理系统
SYSTEM_VERSION=1.0.0
DEBUG_MODE=false

# 安全配置
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# 第三方服务配置
SMS_API_KEY=your_sms_api_key
EMAIL_SERVICE_KEY=your_email_service_key

# 数据库配置
DB_BACKUP_INTERVAL=24  # 小时
LOG_RETENTION_DAYS=90

# 文件上传限制
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,mp4,avi
```

## 数据库部署配置

### 1. 数据库集合创建脚本

#### 创建基础集合
```bash
#!/bin/bash
# setup-database-collections.sh

echo "开始创建数据库集合..."

# 云开发环境ID
ENV_ID="your_env_id_here"

# 核心业务集合
collections=(
  "production_batches"
  "production_entry_records"
  "production_exit_records"
  "production_materials"
  "health_records"
  "health_treatments"
  "health_preventions"
  "health_vaccinations"
  "ai_diagnosis_records"
  "ai_diagnosis_history"
  "finance_income"
  "finance_expense"
  "finance_budgets"
  "finance_reports"
  "users"
  "user_roles"
  "roles"
  "permission_modules"
  "permission_logs"
  "user_sessions"
  "system_logs"
  "notifications"
  "file_uploads"
  "system_configs"
)

# 创建集合
for collection in "${collections[@]}"; do
  echo "创建集合: $collection"
  tcb db:createCollection $collection --envId $ENV_ID
  if [ $? -eq 0 ]; then
    echo "✓ 集合 $collection 创建成功"
  else
    echo "✗ 集合 $collection 创建失败"
  fi
done

echo "数据库集合创建完成"
```

#### 设置数据库索引
```bash
#!/bin/bash
# setup-database-indexes.sh

echo "开始创建数据库索引..."

ENV_ID="your_env_id_here"

# 生产管理索引
echo "创建生产管理相关索引..."
tcb db:createIndex production_batches '{"batchNumber": 1}' --envId $ENV_ID
tcb db:createIndex production_batches '{"status": 1, "createTime": -1}' --envId $ENV_ID
tcb db:createIndex production_entry_records '{"batchNumber": 1, "entryDate": -1}' --envId $ENV_ID
tcb db:createIndex production_exit_records '{"batchNumber": 1, "exitDate": -1}' --envId $ENV_ID
tcb db:createIndex production_materials '{"type": 1, "purchaseDate": -1}' --envId $ENV_ID

# 健康管理索引
echo "创建健康管理相关索引..."
tcb db:createIndex health_records '{"batchNumber": 1, "checkDate": -1}' --envId $ENV_ID
tcb db:createIndex health_records '{"healthStatus": 1, "createTime": -1}' --envId $ENV_ID
tcb db:createIndex health_treatments '{"batchNumber": 1, "treatmentDate": -1}' --envId $ENV_ID
tcb db:createIndex health_preventions '{"type": 1, "scheduleDate": -1}' --envId $ENV_ID
tcb db:createIndex ai_diagnosis_records '{"openid": 1, "diagnosisDate": -1}' --envId $ENV_ID

# 财务管理索引
echo "创建财务管理相关索引..."
tcb db:createIndex finance_income '{"type": 1, "date": -1}' --envId $ENV_ID
tcb db:createIndex finance_expense '{"category": 1, "date": -1}' --envId $ENV_ID
tcb db:createIndex finance_budgets '{"year": 1, "month": 1}' --envId $ENV_ID

# 用户和权限索引
echo "创建用户权限相关索引..."
tcb db:createIndex users '{"openid": 1}' --envId $ENV_ID --unique
tcb db:createIndex user_roles '{"openid": 1, "isActive": 1}' --envId $ENV_ID
tcb db:createIndex permission_logs '{"openid": 1, "timestamp": -1}' --envId $ENV_ID
tcb db:createIndex user_sessions '{"openid": 1, "isActive": 1}' --envId $ENV_ID

# 系统管理索引
echo "创建系统管理相关索引..."
tcb db:createIndex system_logs '{"level": 1, "timestamp": -1}' --envId $ENV_ID
tcb db:createIndex notifications '{"targetUser": 1, "isRead": 1}' --envId $ENV_ID
tcb db:createIndex file_uploads '{"uploader": 1, "uploadTime": -1}' --envId $ENV_ID

echo "数据库索引创建完成"
```

### 2. 数据库权限配置

#### 设置集合权限
```bash
#!/bin/bash
# setup-database-permissions.sh

echo "开始配置数据库权限..."

ENV_ID="your_env_id_here"

# 生产管理集合权限（需要特定角色）
production_collections=("production_batches" "production_entry_records" "production_exit_records" "production_materials")
for collection in "${production_collections[@]}"; do
  echo "配置 $collection 权限..."
  # 这些集合需要通过云函数权限检查
  tcb db:updateCollectionPermission $collection '{
    "read": "auth != null",
    "write": "auth != null"
  }' --envId $ENV_ID
done

# 健康管理集合权限
health_collections=("health_records" "health_treatments" "health_preventions" "health_vaccinations" "ai_diagnosis_records" "ai_diagnosis_history")
for collection in "${health_collections[@]}"; do
  echo "配置 $collection 权限..."
  tcb db:updateCollectionPermission $collection '{
    "read": "auth != null",
    "write": "auth != null"
  }' --envId $ENV_ID
done

# 财务管理集合权限（更严格）
finance_collections=("finance_income" "finance_expense" "finance_budgets" "finance_reports")
for collection in "${finance_collections[@]}"; do
  echo "配置 $collection 权限..."
  tcb db:updateCollectionPermission $collection '{
    "read": "auth != null",
    "write": "auth != null"
  }' --envId $ENV_ID
done

# 用户管理集合权限
tcb db:updateCollectionPermission users '{
  "read": "auth != null && (auth.openid == resource.openid || getUserRole(auth.openid) in [\"super_admin\", \"manager\"])",
  "write": "auth != null && (auth.openid == resource.openid || getUserRole(auth.openid) in [\"super_admin\", \"manager\"])"
}' --envId $ENV_ID

# 权限管理集合（仅管理员）
tcb db:updateCollectionPermission user_roles '{
  "read": "getUserRole(auth.openid) in [\"super_admin\", \"manager\"]",
  "write": "getUserRole(auth.openid) in [\"super_admin\", \"manager\"]"
}' --envId $ENV_ID

tcb db:updateCollectionPermission roles '{
  "read": "getUserRole(auth.openid) in [\"super_admin\", \"manager\"]",
  "write": "getUserRole(auth.openid) == \"super_admin\""
}' --envId $ENV_ID

# 日志集合（只读）
tcb db:updateCollectionPermission permission_logs '{
  "read": "getUserRole(auth.openid) in [\"super_admin\", \"manager\"]",
  "write": false
}' --envId $ENV_ID

tcb db:updateCollectionPermission system_logs '{
  "read": "getUserRole(auth.openid) == \"super_admin\"",
  "write": false
}' --envId $ENV_ID

echo "数据库权限配置完成"
```

### 3. 初始数据导入

#### 角色初始化脚本
```javascript
// init-roles.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'your_env_id_here'
})

const db = cloud.database()

const initRoles = async () => {
  console.log('开始初始化角色数据...')
  
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
      roleName: '场长/经理',
      roleDescription: '场地管理者，负责整体运营管理',
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
          actions: ['read', 'report_view'],
          conditions: null
        },
        {
          module: 'user_management',
          actions: ['read', 'update', 'assign_role'],
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
      roleCode: 'production_supervisor',
      roleName: '生产主管',
      roleDescription: '生产管理主管，负责生产计划和执行',
      level: 3,
      parentRole: 'manager',
      isActive: true,
      permissions: [
        {
          module: 'production_management',
          actions: ['create', 'read', 'update', 'delete'],
          conditions: null
        },
        {
          module: 'health_management',
          actions: ['read'],
          conditions: null
        }
      ],
      restrictions: {
        maxConcurrentSessions: 3,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [6, 20],
          allowedDays: [1, 2, 3, 4, 5, 6]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'health_supervisor',
      roleName: '健康主管',
      roleDescription: '健康管理主管，负责疾病防控和健康监测',
      level: 3,
      parentRole: 'manager',
      isActive: true,
      permissions: [
        {
          module: 'health_management',
          actions: ['create', 'read', 'update', 'delete'],
          conditions: null
        },
        {
          module: 'production_management',
          actions: ['read'],
          conditions: null
        }
      ],
      restrictions: {
        maxConcurrentSessions: 3,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [6, 20],
          allowedDays: [1, 2, 3, 4, 5, 6, 7]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'finance_supervisor',
      roleName: '财务主管',
      roleDescription: '财务管理主管，负责财务核算和成本控制',
      level: 3,
      parentRole: 'manager',
      isActive: true,
      permissions: [
        {
          module: 'finance_management',
          actions: ['create', 'read', 'update', 'delete'],
          conditions: null
        },
        {
          module: 'production_management',
          actions: ['read'],
          conditions: {
            resourceType: 'cost_related'
          }
        }
      ],
      restrictions: {
        maxConcurrentSessions: 2,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [8, 18],
          allowedDays: [1, 2, 3, 4, 5]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'technician',
      roleName: '技术员',
      roleDescription: '技术人员，负责具体技术操作',
      level: 4,
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
        }
      ],
      restrictions: {
        maxConcurrentSessions: 2,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [6, 20],
          allowedDays: [1, 2, 3, 4, 5, 6]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'employee',
      roleName: '普通员工',
      roleDescription: '普通员工，负责日常操作',
      level: 5,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'production_management',
          actions: ['create', 'read'],
          conditions: {
            batchAccess: true,
            resourceCollection: 'production_entry_records'
          }
        },
        {
          module: 'health_management',
          actions: ['create', 'read'],
          conditions: {
            batchAccess: true,
            resourceCollection: 'health_records'
          }
        }
      ],
      restrictions: {
        maxConcurrentSessions: 1,
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
      roleCode: 'finance_staff',
      roleName: '财务人员',
      roleDescription: '财务工作人员，负责财务数据录入',
      level: 4,
      parentRole: 'finance_supervisor',
      isActive: true,
      permissions: [
        {
          module: 'finance_management',
          actions: ['create', 'read', 'update'],
          conditions: null
        }
      ],
      restrictions: {
        maxConcurrentSessions: 2,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [8, 18],
          allowedDays: [1, 2, 3, 4, 5]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'veterinarian',
      roleName: '兽医',
      roleDescription: '兽医，负责动物诊疗',
      level: 4,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'health_management',
          actions: ['create', 'read', 'update', 'diagnosis', 'treatment'],
          conditions: null
        },
        {
          module: 'ai_diagnosis',
          actions: ['create', 'read', 'validate'],
          conditions: null
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
    },
    {
      roleCode: 'observer',
      roleName: '观察员',
      roleDescription: '观察员，只能查看数据',
      level: 6,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'production_management',
          actions: ['read'],
          conditions: null
        },
        {
          module: 'health_management',
          actions: ['read'],
          conditions: null
        },
        {
          module: 'finance_management',
          actions: ['read'],
          conditions: {
            reportOnly: true
          }
        }
      ],
      restrictions: {
        maxConcurrentSessions: 1,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [8, 18],
          allowedDays: [1, 2, 3, 4, 5]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      roleCode: 'temporary_worker',
      roleName: '临时工',
      roleDescription: '临时工作人员，有时间和功能限制',
      level: 7,
      parentRole: null,
      isActive: true,
      permissions: [
        {
          module: 'production_management',
          actions: ['create', 'read'],
          conditions: {
            batchAccess: true,
            timeLimit: true,
            resourceCollection: 'production_entry_records'
          }
        }
      ],
      restrictions: {
        maxConcurrentSessions: 1,
        allowedIpRanges: [],
        timeRestrictions: {
          allowedHours: [8, 17],
          allowedDays: [1, 2, 3, 4, 5]
        }
      },
      createTime: new Date(),
      updateTime: new Date()
    }
  ]
  
  for (const role of roles) {
    try {
      await db.collection('roles').add({
        data: role
      })
      console.log(`✓ 角色 ${role.roleName} 创建成功`)
    } catch (error) {
      console.error(`✗ 角色 ${role.roleName} 创建失败:`, error)
    }
  }
  
  console.log('角色数据初始化完成')
}

// 权限模块初始化
const initPermissionModules = async () => {
  console.log('开始初始化权限模块...')
  
  const modules = [
    {
      moduleCode: 'production_management',
      moduleName: '生产管理',
      description: '鹅场生产相关的管理功能，包括批次管理、入栏出栏、物料管理等',
      availableActions: [
        {
          actionCode: 'create',
          actionName: '创建',
          description: '创建生产记录、批次信息等'
        },
        {
          actionCode: 'read',
          actionName: '查看',
          description: '查看生产数据和报表'
        },
        {
          actionCode: 'update',
          actionName: '更新',
          description: '更新生产记录和信息'
        },
        {
          actionCode: 'delete',
          actionName: '删除',
          description: '删除生产记录（谨慎操作）'
        },
        {
          actionCode: 'batch_operation',
          actionName: '批量操作',
          description: '批量导入导出生产数据'
        }
      ],
      isActive: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      moduleCode: 'health_management',
      moduleName: '健康管理',
      description: '动物健康相关的管理功能，包括健康记录、诊疗管理、疫苗接种等',
      availableActions: [
        {
          actionCode: 'create',
          actionName: '创建',
          description: '创建健康记录、诊疗记录等'
        },
        {
          actionCode: 'read',
          actionName: '查看',
          description: '查看健康数据和报告'
        },
        {
          actionCode: 'update',
          actionName: '更新',
          description: '更新健康记录和治疗信息'
        },
        {
          actionCode: 'delete',
          actionName: '删除',
          description: '删除健康记录（谨慎操作）'
        },
        {
          actionCode: 'diagnosis',
          actionName: '诊断',
          description: '进行疾病诊断和AI辅助诊断'
        },
        {
          actionCode: 'treatment',
          actionName: '治疗',
          description: '制定和执行治疗方案'
        }
      ],
      isActive: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      moduleCode: 'finance_management',
      moduleName: '财务管理',
      description: '财务相关的管理功能，包括收支记录、成本分析、财务报表等',
      availableActions: [
        {
          actionCode: 'create',
          actionName: '创建',
          description: '创建财务记录、预算等'
        },
        {
          actionCode: 'read',
          actionName: '查看',
          description: '查看财务数据和报表'
        },
        {
          actionCode: 'update',
          actionName: '更新',
          description: '更新财务记录和预算'
        },
        {
          actionCode: 'delete',
          actionName: '删除',
          description: '删除财务记录（谨慎操作）'
        },
        {
          actionCode: 'report_view',
          actionName: '报表查看',
          description: '查看详细财务报表'
        },
        {
          actionCode: 'budget_manage',
          actionName: '预算管理',
          description: '制定和管理预算'
        }
      ],
      isActive: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      moduleCode: 'user_management',
      moduleName: '用户管理',
      description: '用户和权限相关的管理功能',
      availableActions: [
        {
          actionCode: 'create',
          actionName: '创建用户',
          description: '创建新用户账号'
        },
        {
          actionCode: 'read',
          actionName: '查看用户',
          description: '查看用户信息和列表'
        },
        {
          actionCode: 'update',
          actionName: '更新用户',
          description: '更新用户信息'
        },
        {
          actionCode: 'delete',
          actionName: '删除用户',
          description: '删除用户账号'
        },
        {
          actionCode: 'assign_role',
          actionName: '分配角色',
          description: '为用户分配和撤销角色'
        },
        {
          actionCode: 'manage_permission',
          actionName: '权限管理',
          description: '管理用户权限'
        }
      ],
      isActive: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      moduleCode: 'ai_diagnosis',
      moduleName: 'AI诊断',
      description: 'AI辅助诊断功能模块',
      availableActions: [
        {
          actionCode: 'create',
          actionName: '发起诊断',
          description: '创建AI诊断请求'
        },
        {
          actionCode: 'read',
          actionName: '查看诊断',
          description: '查看诊断结果和历史'
        },
        {
          actionCode: 'validate',
          actionName: '验证诊断',
          description: '验证AI诊断结果'
        }
      ],
      isActive: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      moduleCode: 'system_management',
      moduleName: '系统管理',
      description: '系统配置和管理功能',
      availableActions: [
        {
          actionCode: 'config',
          actionName: '系统配置',
          description: '修改系统配置参数'
        },
        {
          actionCode: 'backup',
          actionName: '数据备份',
          description: '执行数据备份操作'
        },
        {
          actionCode: 'log_view',
          actionName: '日志查看',
          description: '查看系统日志'
        },
        {
          actionCode: 'monitor',
          actionName: '系统监控',
          description: '监控系统运行状态'
        }
      ],
      isActive: true,
      createTime: new Date(),
      updateTime: new Date()
    }
  ]
  
  for (const module of modules) {
    try {
      await db.collection('permission_modules').add({
        data: module
      })
      console.log(`✓ 权限模块 ${module.moduleName} 创建成功`)
    } catch (error) {
      console.error(`✗ 权限模块 ${module.moduleName} 创建失败:`, error)
    }
  }
  
  console.log('权限模块初始化完成')
}

// 系统配置初始化
const initSystemConfigs = async () => {
  console.log('开始初始化系统配置...')
  
  const configs = [
    {
      configKey: 'system_name',
      configValue: '鹅场管理系统',
      description: '系统名称',
      category: 'basic',
      isEditable: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      configKey: 'system_version',
      configValue: '1.0.0',
      description: '系统版本',
      category: 'basic',
      isEditable: false,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      configKey: 'max_file_size',
      configValue: '104857600',
      description: '最大文件上传大小（字节）',
      category: 'upload',
      isEditable: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      configKey: 'allowed_file_types',
      configValue: 'jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,mp4,avi',
      description: '允许上传的文件类型',
      category: 'upload',
      isEditable: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      configKey: 'session_timeout',
      configValue: '1800',
      description: '会话超时时间（秒）',
      category: 'security',
      isEditable: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      configKey: 'backup_interval',
      configValue: '24',
      description: '自动备份间隔（小时）',
      category: 'backup',
      isEditable: true,
      createTime: new Date(),
      updateTime: new Date()
    },
    {
      configKey: 'log_retention_days',
      configValue: '90',
      description: '日志保留天数',
      category: 'logging',
      isEditable: true,
      createTime: new Date(),
      updateTime: new Date()
    }
  ]
  
  for (const config of configs) {
    try {
      await db.collection('system_configs').add({
        data: config
      })
      console.log(`✓ 系统配置 ${config.configKey} 创建成功`)
    } catch (error) {
      console.error(`✗ 系统配置 ${config.configKey} 创建失败:`, error)
    }
  }
  
  console.log('系统配置初始化完成')
}

// 执行初始化
const main = async () => {
  try {
    await initRoles()
    await initPermissionModules()
    await initSystemConfigs()
    console.log('=== 数据库初始化完成 ===')
  } catch (error) {
    console.error('数据库初始化失败:', error)
  }
}

main()
```

## 云函数部署

### 1. 云函数列表和部署脚本

#### 部署脚本
```bash
#!/bin/bash
# deploy-cloud-functions.sh

echo "开始部署云函数..."

ENV_ID="your_env_id_here"
FUNCTIONS_DIR="cloudfunctions"

# 云函数列表
functions=(
  "health-management"
  "ai-diagnosis"
  "production-management"
  "finance-management"
  "user-management"
  "permission-check"
  "setup-health-permissions"
  "file-management"
  "notification-service"
  "data-export"
  "system-monitoring"
  "backup-service"
)

# 部署每个云函数
for func in "${functions[@]}"; do
  echo "部署云函数: $func"
  cd "$FUNCTIONS_DIR/$func"
  
  # 安装依赖
  npm install
  
  # 部署到云端
  tcb fn:deploy $func --envId $ENV_ID
  
  if [ $? -eq 0 ]; then
    echo "✓ 云函数 $func 部署成功"
  else
    echo "✗ 云函数 $func 部署失败"
  fi
  
  cd ../..
done

echo "云函数部署完成"
```

### 2. 云函数配置文件

#### 统一配置模板
```javascript
// cloudfunctions/common/config.js
module.exports = {
  // 数据库配置
  database: {
    timeout: 5000,
    retries: 3
  },
  
  // 文件上传配置
  upload: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'avi'],
    tempPath: '/tmp/'
  },
  
  // AI服务配置
  ai: {
    timeout: 30000,
    retries: 2,
    fallbackEnabled: true
  },
  
  // 通知配置
  notification: {
    pushEnabled: true,
    emailEnabled: false,
    smsEnabled: false
  },
  
  // 日志配置
  logging: {
    level: process.env.DEBUG_MODE === 'true' ? 'debug' : 'info',
    enableConsole: true,
    enableFile: true,
    maxSize: '10MB',
    maxFiles: 5
  },
  
  // 安全配置
  security: {
    enableRateLimit: true,
    rateLimitWindow: 60000, // 1分钟
    rateLimitMax: 100,      // 每分钟最多100次请求
    enableIpWhitelist: false,
    ipWhitelist: []
  }
}
```

## 云存储配置

### 1. 存储权限设置脚本

```bash
#!/bin/bash
# setup-cloud-storage.sh

echo "开始配置云存储..."

ENV_ID="your_env_id_here"

# 设置存储权限规则
cat > storage_rules.json << EOF
{
  "read": "auth.openid != null && validateFileAccess(auth.openid, resource.path, 'read')",
  "write": "auth.openid != null && validateFileAccess(auth.openid, resource.path, 'write')"
}
EOF

# 应用存储权限规则
tcb storage:setPermission storage_rules.json --envId $ENV_ID

# 创建存储文件夹结构
folders=(
  "production/"
  "production/entry/"
  "production/exit/"
  "production/batches/"
  "production/materials/"
  "health/"
  "health/records/"
  "health/diagnosis/"
  "health/treatment/"
  "health/prevention/"
  "health/reports/"
  "finance/"
  "finance/invoices/"
  "finance/receipts/"
  "finance/reports/"
  "finance/contracts/"
  "user/"
  "user/avatars/"
  "user/profiles/"
  "user/certifications/"
  "system/"
  "system/backups/"
  "system/exports/"
  "system/logs/"
  "system/configs/"
  "temp/"
  "temp/uploads/"
  "temp/processing/"
  "temp/cache/"
  "public/"
  "public/templates/"
  "public/guides/"
  "public/resources/"
)

# 创建示例文件来建立文件夹结构
for folder in "${folders[@]}"; do
  echo "创建文件夹: $folder"
  echo "# 这是 $folder 文件夹的说明文件" > "./$folder/README.md"
  tcb storage:upload "./$folder/README.md" "${folder}README.md" --envId $ENV_ID
  rm "./$folder/README.md"
done

echo "云存储配置完成"
```

### 2. 文件管理云函数

```javascript
// cloudfunctions/file-management/index.js
const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const storage = cloud.storage()

exports.main = async (event, context) => {
  const { action, filePath, targetPath, fileData, options = {} } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'upload':
        return await handleFileUpload(filePath, fileData, OPENID, options)
      case 'download':
        return await handleFileDownload(filePath, OPENID)
      case 'delete':
        return await handleFileDelete(filePath, OPENID)
      case 'move':
        return await handleFileMove(filePath, targetPath, OPENID)
      case 'list':
        return await handleFileList(filePath, OPENID, options)
      case 'cleanup':
        return await handleCleanup(options)
      case 'backup':
        return await handleBackup(options)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    console.error('文件管理操作失败：', error)
    return {
      success: false,
      message: '文件操作失败',
      error: error.message
    }
  }
}

// 处理文件上传
async function handleFileUpload(filePath, fileData, openid, options) {
  // 验证上传权限
  const hasPermission = await checkUploadPermission(openid, filePath)
  if (!hasPermission) {
    throw new Error('无权限上传到此路径')
  }
  
  // 验证文件类型和大小
  await validateFile(fileData, options)
  
  // 生成唯一文件名
  const uniqueFileName = generateUniqueFileName(filePath, fileData.originalName)
  
  // 上传文件
  const result = await storage.uploadFile({
    cloudPath: uniqueFileName,
    fileContent: fileData.buffer
  })
  
  // 记录上传日志
  await logFileOperation('upload', uniqueFileName, openid, 'success')
  
  // 保存文件记录
  await saveFileRecord({
    fileID: result.fileID,
    cloudPath: uniqueFileName,
    originalName: fileData.originalName,
    size: fileData.size,
    mimeType: fileData.mimeType,
    uploader: openid,
    uploadTime: new Date(),
    category: getFileCategory(filePath),
    isPublic: isPublicPath(filePath)
  })
  
  return {
    success: true,
    fileID: result.fileID,
    cloudPath: uniqueFileName,
    message: '文件上传成功'
  }
}

// 处理文件下载
async function handleFileDownload(filePath, openid) {
  // 验证下载权限
  const hasPermission = await checkDownloadPermission(openid, filePath)
  if (!hasPermission) {
    throw new Error('无权限下载此文件')
  }
  
  // 获取下载链接
  const result = await storage.getTempFileURL({
    fileList: [filePath]
  })
  
  // 记录下载日志
  await logFileOperation('download', filePath, openid, 'success')
  
  return {
    success: true,
    downloadUrl: result.fileList[0].tempFileURL,
    message: '获取下载链接成功'
  }
}

// 处理文件删除
async function handleFileDelete(filePath, openid) {
  // 验证删除权限
  const hasPermission = await checkDeletePermission(openid, filePath)
  if (!hasPermission) {
    throw new Error('无权限删除此文件')
  }
  
  // 删除文件
  await storage.deleteFile({
    fileList: [filePath]
  })
  
  // 更新文件记录
  await db.collection('file_uploads')
    .where({ cloudPath: filePath })
    .update({
      data: {
        isDeleted: true,
        deleteTime: new Date(),
        deletedBy: openid
      }
    })
  
  // 记录删除日志
  await logFileOperation('delete', filePath, openid, 'success')
  
  return {
    success: true,
    message: '文件删除成功'
  }
}

// 权限验证函数
async function checkUploadPermission(openid, filePath) {
  // 调用权限检查云函数
  const result = await cloud.callFunction({
    name: 'permission-check',
    data: {
      action: 'write',
      module: 'file_management',
      resourceId: filePath,
      additionalContext: { operation: 'upload' }
    }
  })
  
  return result.result.hasPermission
}

async function checkDownloadPermission(openid, filePath) {
  const result = await cloud.callFunction({
    name: 'permission-check',
    data: {
      action: 'read',
      module: 'file_management',
      resourceId: filePath,
      additionalContext: { operation: 'download' }
    }
  })
  
  return result.result.hasPermission
}

async function checkDeletePermission(openid, filePath) {
  const result = await cloud.callFunction({
    name: 'permission-check',
    data: {
      action: 'delete',
      module: 'file_management',
      resourceId: filePath,
      additionalContext: { operation: 'delete' }
    }
  })
  
  return result.result.hasPermission
}

// 文件验证
async function validateFile(fileData, options) {
  const config = require('./config')
  
  // 验证文件大小
  if (fileData.size > config.upload.maxSize) {
    throw new Error(`文件大小超过限制 (${config.upload.maxSize / 1024 / 1024}MB)`)
  }
  
  // 验证文件类型
  const fileExtension = path.extname(fileData.originalName).toLowerCase().slice(1)
  if (!config.upload.allowedTypes.includes(fileExtension)) {
    throw new Error(`不支持的文件类型: ${fileExtension}`)
  }
  
  // 检查文件内容（可选）
  if (options.validateContent) {
    await validateFileContent(fileData)
  }
}

// 生成唯一文件名
function generateUniqueFileName(basePath, originalName) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 8)
  const extension = path.extname(originalName)
  const nameWithoutExt = path.basename(originalName, extension)
  
  return `${basePath}${timestamp}_${random}_${nameWithoutExt}${extension}`
}

// 文件分类
function getFileCategory(filePath) {
  if (filePath.startsWith('production/')) return 'production'
  if (filePath.startsWith('health/')) return 'health'
  if (filePath.startsWith('finance/')) return 'finance'
  if (filePath.startsWith('user/')) return 'user'
  if (filePath.startsWith('system/')) return 'system'
  if (filePath.startsWith('public/')) return 'public'
  return 'other'
}

// 判断是否为公共路径
function isPublicPath(filePath) {
  return filePath.startsWith('public/')
}

// 保存文件记录
async function saveFileRecord(fileRecord) {
  await db.collection('file_uploads').add({
    data: fileRecord
  })
}

// 记录文件操作日志
async function logFileOperation(operation, filePath, openid, result) {
  await db.collection('file_operation_logs').add({
    data: {
      operation,
      filePath,
      openid,
      result,
      timestamp: new Date(),
      ipAddress: cloud.getWXContext().SOURCE
    }
  })
}
```

继续编写完整的部署配置指导文档...（由于内容太长，我需要分几个部分来完成这个文档）

现在让我继续完成部署配置指导文档。
