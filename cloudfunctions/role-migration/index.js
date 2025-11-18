// cloudfunctions/role-migration/index.js
// 角色迁移云函数 - 将旧角色更新为新的4角色体系
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 角色迁移映射
const ROLE_MIGRATION_MAP = {
  // 旧角色 -> 新角色
  'admin': 'super_admin',
  'user': 'employee',
  'operator': 'employee', 
  'technician': 'veterinarian',
  'finance': 'manager',
  
  // 已经是新角色的保持不变
  'super_admin': 'super_admin',
  'manager': 'manager',
  'employee': 'employee',
  'veterinarian': 'veterinarian'
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, dryRun = false } = event
  
  try {
    // 验证管理员权限
    const hasPermission = await verifyAdminPermission(wxContext.OPENID)
    if (!hasPermission) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message: '权限不足，仅超级管理员可执行角色迁移'
      }
    }

    switch (action) {
      case 'analyze':
        return await analyzeRoles(event, wxContext)
      case 'migrate':
        return await migrateRoles(event, wxContext)
      case 'verify':
        return await verifyMigration(event, wxContext)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: error.message || '操作失败，请重试'
    }
  }
}

// 验证管理员权限
async function verifyAdminPermission(openid) {
  try {
    if (!openid) return false

    const userResult = await db.collection(COLLECTIONS.WX_USERS).where({
      _openid: openid
    }).get()

    if (userResult.data.length === 0) return false

    const user = userResult.data[0]
    return user.role === 'super_admin' || user.role === 'admin'
  } catch (error) {
    return false
  }
}

// 分析现有角色分布
async function analyzeRoles(event, wxContext) {
  try {
    // 获取所有用户的角色分布
    const usersResult = await db.collection(COLLECTIONS.WX_USERS).get()
    const users = usersResult.data
    
    const roleStats = {}
    const migrationPlan = {}
    const problemUsers = []
    
    users.forEach(user => {
      const currentRole = user.role || 'unknown'
      const newRole = ROLE_MIGRATION_MAP[currentRole]
      
      // 统计当前角色
      roleStats[currentRole] = (roleStats[currentRole] || 0) + 1
      
      // 生成迁移计划
      if (newRole && newRole !== currentRole) {
        if (!migrationPlan[currentRole]) {
          migrationPlan[currentRole] = {
            oldRole: currentRole,
            newRole: newRole,
            count: 0,
            users: []
          }
        }
        migrationPlan[currentRole].count++
        migrationPlan[currentRole].users.push({
          _id: user._id,
          nickname: user.nickname || '未设置',
          phone: user.phone || '未绑定'
        })
      }
      
      // 记录问题用户（未知角色）
      if (!newRole) {
        problemUsers.push({
          _id: user._id,
          nickname: user.nickname || '未设置',
          role: currentRole
        })
      }
    })
    
    return {
      success: true,
      data: {
        totalUsers: users.length,
        roleStats,
        migrationPlan: Object.values(migrationPlan),
        problemUsers,
        needsMigration: Object.keys(migrationPlan).length > 0 || problemUsers.length > 0
      },
      message: '角色分析完成'
    }
  } catch (error) {
    throw error
  }
}

// 执行角色迁移
async function migrateRoles(event, wxContext) {
  const { dryRun = true } = event
  
  try {
    // 获取所有需要迁移的用户
    const usersResult = await db.collection(COLLECTIONS.WX_USERS).get()
    const users = usersResult.data
    
    const migrationResults = []
    let successCount = 0
    let errorCount = 0
    
    for (const user of users) {
      const currentRole = user.role || 'unknown'
      const newRole = ROLE_MIGRATION_MAP[currentRole]
      
      if (newRole && newRole !== currentRole) {
        try {
          if (!dryRun) {
            // 实际执行更新
            await db.collection(COLLECTIONS.WX_USERS).doc(user._id).update({
              data: {
                role: newRole,
                oldRole: currentRole, // 保留旧角色记录
                migrationTime: new Date(),
                updateTime: new Date()
              }
            })
          }
          
          migrationResults.push({
            userId: user._id,
            nickname: user.nickname || '未设置',
            oldRole: currentRole,
            newRole: newRole,
            status: 'success'
          })
          successCount++
        } catch (error) {
          migrationResults.push({
            userId: user._id,
            nickname: user.nickname || '未设置',
            oldRole: currentRole,
            newRole: newRole,
            status: 'error',
            error: error.message
          })
          errorCount++
        }
      } else if (!newRole) {
        // 处理未知角色
        const suggestedRole = 'employee' // 默认建议为员工
        
        migrationResults.push({
          userId: user._id,
          nickname: user.nickname || '未设置',
          oldRole: currentRole,
          newRole: suggestedRole,
          status: 'manual_required',
          note: '未知角色，建议手动处理'
        })
      }
    }
    
    // 记录迁移日志
    if (!dryRun) {
      await db.collection('migration_logs').add({
        data: {
          type: 'role_migration',
          operatorId: wxContext.OPENID,
          totalUsers: users.length,
          successCount,
          errorCount,
          results: migrationResults,
          createTime: new Date()
        }
      })
    }
    
    return {
      success: true,
      data: {
        dryRun,
        totalUsers: users.length,
        successCount,
        errorCount,
        results: migrationResults
      },
      message: dryRun ? '角色迁移预览完成' : '角色迁移执行完成'
    }
  } catch (error) {
    throw error
  }
}

// 验证迁移结果
async function verifyMigration(event, wxContext) {
  try {
    // 获取所有用户的角色分布
    const usersResult = await db.collection(COLLECTIONS.WX_USERS).get()
    const users = usersResult.data
    
    const newRoleStats = {}
    const invalidRoles = []
    const validRoles = ['super_admin', 'manager', 'employee', 'veterinarian']
    
    users.forEach(user => {
      const role = user.role || 'unknown'
      newRoleStats[role] = (newRoleStats[role] || 0) + 1
      
      if (!validRoles.includes(role)) {
        invalidRoles.push({
          _id: user._id,
          nickname: user.nickname || '未设置',
          role: role
        })
      }
    })
    
    return {
      success: true,
      data: {
        totalUsers: users.length,
        newRoleStats,
        invalidRoles,
        isValid: invalidRoles.length === 0,
        validRoleCount: validRoles.reduce((sum, role) => sum + (newRoleStats[role] || 0), 0)
      },
      message: '角色验证完成'
    }
  } catch (error) {
    throw error
  }
}
