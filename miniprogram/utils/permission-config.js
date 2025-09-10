/**
 * 统一权限管理配置
 * 适用于整个小程序的权限控制体系
 * 包含4个核心角色：超级管理员、经理、员工、兽医
 */

// 角色定义
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager', 
  EMPLOYEE: 'employee',
  VETERINARIAN: 'veterinarian'
}

// 模块定义
export const MODULES = {
  PRODUCTION_MANAGEMENT: 'production_management',
  HEALTH_MANAGEMENT: 'health_management',
  FINANCE_MANAGEMENT: 'finance_management',
  USER_MANAGEMENT: 'user_management',
  AI_DIAGNOSIS: 'ai_diagnosis',
  SYSTEM_MANAGEMENT: 'system_management'
}

// 操作定义
export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  BATCH_OPERATION: 'batch_operation',
  DIAGNOSIS: 'diagnosis',
  TREATMENT: 'treatment',
  PRESCRIPTION: 'prescription',
  VALIDATE: 'validate',
  ASSIGN_ROLE: 'assign_role',
  REPORT_VIEW: 'report_view'
}

// 页面权限配置映射
export const PAGE_PERMISSIONS = {
  // 主页面
  '/pages/index/index': {
    module: null,
    action: null,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  
  // 生产管理页面
  '/pages/production/production': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  '/pages/production/batch-create': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/production/entry-record': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE]
  },
  '/pages/production/exit-record': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE]
  },
  '/pages/production/material-management': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.UPDATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE]
  },
  
  // 健康管理页面
  '/pages/health/health': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  '/pages/health/health-record': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  '/pages/health/treatment-record': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.TREATMENT,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.VETERINARIAN]
  },
  '/pages/health/vaccination': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.UPDATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  
  // AI诊断页面
  '/pages/ai-diagnosis/ai-diagnosis': {
    module: MODULES.AI_DIAGNOSIS,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  '/pages/diagnosis-history/diagnosis-history': {
    module: MODULES.AI_DIAGNOSIS,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  
  // 财务管理页面
  '/pages/finance/finance': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/finance/income': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/finance/expense': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/finance/reports': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.REPORT_VIEW,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  
  // 用户管理页面
  '/pages/user/user-list': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/user/user-create': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/user/role-management': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.ASSIGN_ROLE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  
  // 个人中心
  '/pages/profile/profile': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN],
    conditions: { ownerOnly: true }
  },
  '/pages/profile/settings': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.UPDATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN],
    conditions: { ownerOnly: true }
  },
  
  // 系统管理页面
  '/pages/system/system-config': {
    module: MODULES.SYSTEM_MANAGEMENT,
    action: ACTIONS.UPDATE,
    allowedRoles: [ROLES.SUPER_ADMIN]
  },
  '/pages/system/logs': {
    module: MODULES.SYSTEM_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  '/pages/system/backup': {
    module: MODULES.SYSTEM_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN]
  }
}

// 组件权限配置映射
export const COMPONENT_PERMISSIONS = {
  // 按钮权限
  'create-batch-btn': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'delete-record-btn': {
    module: null, // 根据上下文动态确定
    action: ACTIONS.DELETE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'export-data-btn': {
    module: null,
    action: ACTIONS.BATCH_OPERATION,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'ai-diagnosis-btn': {
    module: MODULES.AI_DIAGNOSIS,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  'validate-diagnosis-btn': {
    module: MODULES.AI_DIAGNOSIS,
    action: ACTIONS.VALIDATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  'prescription-btn': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.PRESCRIPTION,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.VETERINARIAN]
  },
  'finance-view-btn': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'user-management-btn': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  
  // 表单权限
  'batch-form': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'health-record-form': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  'treatment-form': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.TREATMENT,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.VETERINARIAN]
  },
  'finance-form': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.CREATE,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  
  // 菜单权限
  'production-menu': {
    module: MODULES.PRODUCTION_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  'health-menu': {
    module: MODULES.HEALTH_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  'finance-menu': {
    module: MODULES.FINANCE_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'ai-diagnosis-menu': {
    module: MODULES.AI_DIAGNOSIS,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.VETERINARIAN]
  },
  'user-management-menu': {
    module: MODULES.USER_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN, ROLES.MANAGER]
  },
  'system-management-menu': {
    module: MODULES.SYSTEM_MANAGEMENT,
    action: ACTIONS.READ,
    allowedRoles: [ROLES.SUPER_ADMIN]
  }
}

// 角色显示名称映射
export const ROLE_NAMES = {
  [ROLES.SUPER_ADMIN]: '超级管理员',
  [ROLES.MANAGER]: '经理',
  [ROLES.EMPLOYEE]: '员工',
  [ROLES.VETERINARIAN]: '兽医'
}

// 权限检查缓存时间（毫秒）
export const PERMISSION_CACHE_TIME = 5 * 60 * 1000 // 5分钟

// 默认权限配置
export const DEFAULT_PERMISSIONS = {
  // 所有用户都能访问的页面
  publicPages: [
    '/pages/index/index',
    '/pages/login/login',
    '/pages/profile/profile'
  ],
  
  // 需要登录但不需要特殊权限的页面
  authPages: [
    '/pages/profile/settings',
    '/pages/help/help',
    '/pages/about/about'
  ]
}

// 权限错误消息
export const PERMISSION_ERRORS = {
  NO_PERMISSION: '您没有权限访问此功能',
  LOGIN_REQUIRED: '请先登录',
  ROLE_REQUIRED: '需要特定角色权限',
  MODULE_RESTRICTED: '模块访问受限',
  ACTION_FORBIDDEN: '操作被禁止',
  TIME_RESTRICTED: '当前时间不允许此操作',
  RESOURCE_FORBIDDEN: '资源访问被拒绝'
}

// 导出配置验证函数
export function validatePermissionConfig(config) {
  const requiredFields = ['module', 'action', 'allowedRoles']
  for (const field of requiredFields) {
    if (!config[field]) {
      console.warn(`权限配置缺少必要字段: ${field}`)
      return false
    }
  }
  return true
}

// 检查角色是否有效
export function isValidRole(role) {
  return Object.values(ROLES).includes(role)
}

// 检查模块是否有效
export function isValidModule(module) {
  return Object.values(MODULES).includes(module)
}

// 检查操作是否有效
export function isValidAction(action) {
  return Object.values(ACTIONS).includes(action)
}
