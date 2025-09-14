// cloudfunctions/register/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { nickname, avatarUrl, phone, gender, farmName, inviteCode } = event
  
  try {
    // 获取用户的 openid
    const { OPENID } = wxContext
    
    if (!OPENID) {
      return {
        success: false,
        message: '用户身份验证失败'
      }
    }
    
    // 查找用户记录
    let userQuery = null
    let user = null
    
    try {
      userQuery = await db.collection('users').where({
        _openid: OPENID
      }).get()
      
      if (userQuery.data.length === 0) {
        return {
          success: false,
          message: '用户不存在，请先登录'
        }
      }
      
      user = userQuery.data[0]
      
    } catch (queryError) {
      
      if (queryError.errCode === -502005 || queryError.message?.includes('collection not exists')) {
        return {
          success: false,
          message: '数据库集合不存在，请先完成登录以初始化数据库',
          error: 'database_collection_not_exists'
        }
      }
      
      throw queryError
    }
    
    // 处理邀请码验证（如果提供了邀请码）
    let inviteInfo = null
    if (inviteCode) {
      try {
        // 验证邀请码
        const inviteValidation = await validateInviteCode(inviteCode, OPENID)
        if (!inviteValidation.success) {
          return {
            success: false,
            message: inviteValidation.message,
            error: inviteValidation.error
          }
        }
        
        inviteInfo = inviteValidation.data.invite
        
        // 使用邀请码
        const useResult = await useInviteCode(inviteCode, OPENID)
        if (!useResult.success) {
          return {
            success: false,
            message: useResult.message,
            error: useResult.error
          }
        }
        
      } catch (inviteError) {
        return {
          success: false,
          message: '邀请码验证失败，请重试',
          error: 'invite_code_validation_failed'
        }
      }
    }
    
    // 准备更新数据
    const updateData = {
      updateTime: new Date()
    }
    
    // 添加要更新的字段
    if (nickname !== undefined) {
      updateData.nickName = nickname  // 修正：存储为数据库标准字段名nickName
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl
    }
    if (phone !== undefined) {
      updateData.phone = phone
    }
    if (gender !== undefined) {
      updateData.gender = gender
    }
    if (farmName !== undefined) {
      updateData.farmName = farmName
      updateData.department = farmName  // 保持兼容性字段同步
    }
    
    // 如果有邀请信息，更新相关字段
    if (inviteInfo) {
      updateData.inviteCode = inviteCode
      updateData.position = inviteInfo.position || ''
      if (inviteInfo.role) {
        updateData.role = inviteInfo.role
      }
      // 如果邀请信息中有部门/养殖场信息，使用邀请信息
      if (inviteInfo.department) {
        updateData.farmName = inviteInfo.department
        updateData.department = inviteInfo.department
      }
      // 保持待审批状态
      updateData.approvalStatus = 'pending'
    }
    
    // 更新用户信息
    const updateResult = await db.collection('users').doc(user._id).update({
      data: updateData
    })
    
    if (updateResult.stats.updated === 1) {
      // 获取更新后的用户信息
      const updatedUser = await db.collection('users').doc(user._id).get()
      
      return {
        success: true,
        message: '用户信息更新成功',
        user: {
          _id: updatedUser.data._id,
          openid: OPENID,
          nickname: updatedUser.data.nickname,
          avatarUrl: updatedUser.data.avatarUrl,
          phone: updatedUser.data.phone,
          gender: updatedUser.data.gender,
          farmName: updatedUser.data.farmName,
          createTime: updatedUser.data.createTime,
          updateTime: updatedUser.data.updateTime,
          lastLoginTime: updatedUser.data.lastLoginTime,
          loginCount: updatedUser.data.loginCount,
          isActive: updatedUser.data.isActive
        }
      }
    } else {
      return {
        success: false,
        message: '用户信息更新失败'
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}

// 验证邀请码
async function validateInviteCode(inviteCode, openid) {
  try {
    if (!inviteCode) {
      return {
        success: false,
        message: '缺少邀请码',
        error: 'missing_invite_code'
      }
    }

    // 查找邀请记录
    const inviteResult = await db.collection('employee_invites')
      .where({ inviteCode: inviteCode.toUpperCase() })
      .get()

    if (inviteResult.data.length === 0) {
      return {
        success: false,
        message: '邀请码不存在',
        error: 'invite_not_found'
      }
    }

    const invite = inviteResult.data[0]

    // 检查邀请状态
    if (invite.status === 'used') {
      return {
        success: false,
        message: '邀请码已被使用',
        error: 'invite_used'
      }
    }

    if (invite.status === 'revoked') {
      return {
        success: false,
        message: '邀请码已被撤销',
        error: 'invite_revoked'
      }
    }

    if (invite.status === 'expired') {
      return {
        success: false,
        message: '邀请码已过期',
        error: 'invite_expired'
      }
    }

    // 检查是否过期
    if (new Date() > new Date(invite.expiryTime)) {
      // 自动标记为过期
      await db.collection('employee_invites').doc(invite._id).update({
        data: { status: 'expired' }
      })

      return {
        success: false,
        message: '邀请码已过期',
        error: 'invite_expired'
      }
    }

    return {
      success: true,
      data: {
        invite: invite
      },
      message: '邀请码有效'
    }
  } catch (error) {
    return {
      success: false,
      message: '邀请码验证失败',
      error: 'validation_failed'
    }
  }
}

// 使用邀请码
async function useInviteCode(inviteCode, openid) {
  try {
    // 再次验证邀请码
    const validateResult = await validateInviteCode(inviteCode, openid)
    if (!validateResult.success) {
      return validateResult
    }

    const invite = validateResult.data.invite

    // 标记邀请码为已使用
    await db.collection('employee_invites').doc(invite._id).update({
      data: {
        status: 'used',
        usedTime: new Date(),
        usedByOpenId: openid
      }
    })

    return {
      success: true,
      data: {
        invite: invite
      },
      message: '邀请码使用成功'
    }
  } catch (error) {
    return {
      success: false,
      message: '使用邀请码失败',
      error: 'use_invite_failed'
    }
  }
}