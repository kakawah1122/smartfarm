/**
 * 前端角色配置文件
 * 与后端角色定义保持一致
 */

// 角色代码常量
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee', 
  VETERINARIAN: 'veterinarian'
}

// 角色信息映射
export const ROLE_INFO = {
  [ROLES.SUPER_ADMIN]: {
    code: 'super_admin',
    name: '超级管理员',
    description: '系统全局管理权限，可管理所有功能和用户',
    level: 1,
    color: '#ff4d4f',
    icon: 'crown',
    badge: 'admin'
  },
  [ROLES.MANAGER]: {
    code: 'manager',
    name: '经理',
    description: '业务运营管理权限，负责整体运营和决策',
    level: 2,
    color: '#1890ff',
    icon: 'user-tie',
    badge: 'manager'
  },
  [ROLES.EMPLOYEE]: {
    code: 'employee',
    name: '员工',
    description: '日常操作执行权限，包括AI诊断功能',
    level: 3,
    color: '#52c41a',
    icon: 'user',
    badge: 'staff'
  },
  [ROLES.VETERINARIAN]: {
    code: 'veterinarian', 
    name: '兽医',
    description: '健康诊疗专业权限，负责动物健康和AI诊断验证',
    level: 3,
    color: '#722ed1',
    icon: 'medical',
    badge: 'vet'
  }
}

// 角色层级关系
export const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.EMPLOYEE]: 3,
  [ROLES.VETERINARIAN]: 3
}

// 角色权限说明
export const ROLE_PERMISSIONS_DESC = {
  [ROLES.SUPER_ADMIN]: {
    production: '完全管理生产批次、入栏出栏、物料管理',
    health: '完全管理健康记录、诊疗、疫苗接种',
    aiDiagnosis: '使用AI诊断、验证诊断结果、查看历史',
    finance: '完全管理收支记录、预算、财务报表',
    user: '用户管理、角色分配、审批用户',
    system: '系统配置、备份、日志查看'
  },
  [ROLES.MANAGER]: {
    production: '完全管理生产批次、入栏出栏、物料管理',
    health: '完全管理健康记录、诊疗、疫苗接种',
    aiDiagnosis: '使用AI诊断、验证诊断结果、查看历史',
    finance: '完全管理收支记录、预算、财务报表',
    user: '基础用户管理、邀请用户、分配角色',
    system: '部分系统功能、查看日志'
  },
  [ROLES.EMPLOYEE]: {
    production: '日常入栏出栏记录、物料使用记录',
    health: '健康检查记录、异常情况上报',
    aiDiagnosis: '使用AI诊断、验证诊断结果、查看历史',
    finance: '无权限',
    user: '查看和修改个人信息',
    system: '无权限'
  },
  [ROLES.VETERINARIAN]: {
    production: '查看生产数据（健康相关）',
    health: '完全管理健康记录、诊疗、开具处方',
    aiDiagnosis: '使用AI诊断、专业验证、修改诊断',
    finance: '无权限',
    user: '查看和修改个人信息',
    system: '无权限'
  }
}

// 角色选择选项（用于下拉框等）
export const ROLE_OPTIONS = [
  {
    value: ROLES.SUPER_ADMIN,
    label: ROLE_INFO[ROLES.SUPER_ADMIN].name,
    description: ROLE_INFO[ROLES.SUPER_ADMIN].description,
    color: ROLE_INFO[ROLES.SUPER_ADMIN].color,
    disabled: true // 超级管理员角色通常不允许直接分配
  },
  {
    value: ROLES.MANAGER,
    label: ROLE_INFO[ROLES.MANAGER].name,
    description: ROLE_INFO[ROLES.MANAGER].description,
    color: ROLE_INFO[ROLES.MANAGER].color
  },
  {
    value: ROLES.EMPLOYEE,
    label: ROLE_INFO[ROLES.EMPLOYEE].name,
    description: ROLE_INFO[ROLES.EMPLOYEE].description,
    color: ROLE_INFO[ROLES.EMPLOYEE].color
  },
  {
    value: ROLES.VETERINARIAN,
    label: ROLE_INFO[ROLES.VETERINARIAN].name,
    description: ROLE_INFO[ROLES.VETERINARIAN].description,
    color: ROLE_INFO[ROLES.VETERINARIAN].color
  }
]

// 工具函数
export function getRoleInfo(roleCode) {
  return ROLE_INFO[roleCode] || null
}

export function getRoleName(roleCode) {
  const info = getRoleInfo(roleCode)
  return info ? info.name : '未知角色'
}

export function getRoleColor(roleCode) {
  const info = getRoleInfo(roleCode)
  return info ? info.color : '#666666'
}

export function getRoleIcon(roleCode) {
  const info = getRoleInfo(roleCode)
  return info ? info.icon : 'user'
}

export function getRoleLevel(roleCode) {
  return ROLE_HIERARCHY[roleCode] || 999
}

export function isHigherRole(userRole, targetRole) {
  const userLevel = getRoleLevel(userRole)
  const targetLevel = getRoleLevel(targetRole)
  return userLevel < targetLevel
}

export function validateRole(roleCode) {
  return Object.values(ROLES).includes(roleCode)
}

export function getAvailableRolesForUser(userRole) {
  const userLevel = getRoleLevel(userRole)
  return ROLE_OPTIONS.filter(option => {
    const roleLevel = getRoleLevel(option.value)
    return roleLevel >= userLevel && !option.disabled
  })
}

export function formatRoleDisplay(roleCode) {
  const info = getRoleInfo(roleCode)
  if (!info) return roleCode
  
  return {
    name: info.name,
    color: info.color,
    icon: info.icon,
    badge: info.badge
  }
}

// 角色权限检查（前端显示用）
export function canAccessModule(userRole, module) {
  const permissions = ROLE_PERMISSIONS_DESC[userRole]
  if (!permissions) return false
  
  switch (module) {
    case 'production':
      return userRole !== ROLES.VETERINARIAN || userRole === ROLES.SUPER_ADMIN || userRole === ROLES.MANAGER
    case 'health':
      return true // 所有角色都可以访问健康模块
    case 'ai_diagnosis':
      return true // 所有角色都可以访问AI诊断
    case 'finance':
      return userRole === ROLES.SUPER_ADMIN || userRole === ROLES.MANAGER
    case 'user':
      return userRole === ROLES.SUPER_ADMIN || userRole === ROLES.MANAGER
    case 'system':
      return userRole === ROLES.SUPER_ADMIN
    default:
      return false
  }
}

// 获取角色权限描述
export function getRolePermissionDescription(roleCode, module) {
  const permissions = ROLE_PERMISSIONS_DESC[roleCode]
  return permissions ? permissions[module] : '无权限'
}

// 角色比较
export function compareRoles(role1, role2) {
  const level1 = getRoleLevel(role1)
  const level2 = getRoleLevel(role2)
  return level1 - level2 // 负数表示role1级别更高
}
