/**
 * 报销系统数据库初始化脚本
 * 
 * 功能：
 * 1. 为 finance_cost_records 集合创建索引
 * 2. 迁移现有数据，添加新字段
 * 3. 验证数据完整性
 * 
 * 使用方法：
 * 在微信开发者工具的云开发控制台中运行此脚本
 */

// 云开发初始化
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV  // 使用动态环境变量
})

const db = cloud.database()
const _ = db.command

// 主函数
async function setupReimbursementDatabase() {
  console.log('========== 开始初始化报销系统数据库 ==========')
  
  try {
    // 步骤1: 创建索引
    await createIndexes()
    
    // 步骤2: 迁移现有数据
    await migrateExistingData()
    
    // 步骤3: 验证数据
    await verifyData()
    
    console.log('========== 数据库初始化完成 ==========')
    return {
      success: true,
      message: '数据库初始化成功'
    }
  } catch (error) {
    console.error('数据库初始化失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 创建索引
 */
async function createIndexes() {
  console.log('\n--- 步骤1: 创建索引 ---')
  
  const collection = db.collection('finance_cost_records')
  
  try {
    // 索引1: 用户报销记录查询
    // 用于：员工查看自己的报销记录
    console.log('创建索引1: _openid + isReimbursement + createTime')
    // 注意：在微信云开发控制台手动创建索引，这里仅作说明
    console.log('  索引字段: { "_openid": 1, "isReimbursement": 1, "createTime": -1 }')
    console.log('  用途: 查询用户的报销记录')
    
    // 索引2: 待审批报销查询
    // 用于：管理员查看待审批的报销列表
    console.log('创建索引2: isReimbursement + reimbursement.status + createTime')
    console.log('  索引字段: { "isReimbursement": 1, "reimbursement.status": 1, "createTime": -1 }')
    console.log('  用途: 查询待审批报销')
    
    // 索引3: 日期范围查询
    // 用于：财务统计和报表
    console.log('创建索引3: date + recordType + isDeleted')
    console.log('  索引字段: { "date": 1, "recordType": 1, "isDeleted": 1 }')
    console.log('  用途: 按日期范围统计财务数据')
    
    // 索引4: 用户+状态查询
    // 用于：查询用户特定状态的报销
    console.log('创建索引4: _openid + reimbursement.status + createTime')
    console.log('  索引字段: { "_openid": 1, "reimbursement.status": 1, "createTime": -1 }')
    console.log('  用途: 查询用户特定状态的报销')
    
    console.log('\n⚠️  请在微信云开发控制台手动创建以上索引')
    console.log('   数据库 → finance_cost_records → 索引管理 → 新建索引')
    
  } catch (error) {
    console.error('创建索引失败:', error)
    throw error
  }
}

/**
 * 迁移现有数据
 */
async function migrateExistingData() {
  console.log('\n--- 步骤2: 迁移现有数据 ---')
  
  try {
    // 查询所有没有 recordType 字段的记录（旧数据）
    const oldRecords = await db.collection('finance_cost_records')
      .where({
        recordType: _.exists(false)
      })
      .count()
    
    console.log(`找到 ${oldRecords.total} 条需要迁移的旧数据`)
    
    if (oldRecords.total === 0) {
      console.log('✅ 无需迁移，所有数据已是新格式')
      return
    }
    
    // 分批更新数据
    const batchSize = 100
    let migratedCount = 0
    
    while (migratedCount < oldRecords.total) {
      const records = await db.collection('finance_cost_records')
        .where({
          recordType: _.exists(false)
        })
        .limit(batchSize)
        .get()
      
      // 批量更新
      const promises = records.data.map(record => {
        return db.collection('finance_cost_records')
          .doc(record._id)
          .update({
            data: {
              recordType: 'other',
              isReimbursement: false,
              updateTime: new Date().toISOString()
            }
          })
      })
      
      await Promise.all(promises)
      migratedCount += records.data.length
      
      console.log(`已迁移 ${migratedCount}/${oldRecords.total} 条记录`)
    }
    
    console.log('✅ 数据迁移完成')
    
  } catch (error) {
    console.error('数据迁移失败:', error)
    throw error
  }
}

/**
 * 验证数据完整性
 */
async function verifyData() {
  console.log('\n--- 步骤3: 验证数据完整性 ---')
  
  try {
    // 统计总记录数
    const totalCount = await db.collection('finance_cost_records').count()
    console.log(`总记录数: ${totalCount.total}`)
    
    // 统计报销记录数
    const reimbursementCount = await db.collection('finance_cost_records')
      .where({
        isReimbursement: true
      })
      .count()
    console.log(`报销记录数: ${reimbursementCount.total}`)
    
    // 统计各类型记录数
    const typeStats = await db.collection('finance_cost_records')
      .aggregate()
      .group({
        _id: '$recordType',
        count: _.sum(1)
      })
      .end()
    
    console.log('记录类型分布:')
    typeStats.list.forEach(item => {
      console.log(`  ${item._id || '未分类'}: ${item.count} 条`)
    })
    
    // 验证是否所有记录都有 recordType 字段
    const missingType = await db.collection('finance_cost_records')
      .where({
        recordType: _.exists(false)
      })
      .count()
    
    if (missingType.total > 0) {
      console.warn(`⚠️  警告: 仍有 ${missingType.total} 条记录缺少 recordType 字段`)
    } else {
      console.log('✅ 所有记录都已包含必要字段')
    }
    
    // 验证报销记录的完整性
    if (reimbursementCount.total > 0) {
      const invalidReimbursements = await db.collection('finance_cost_records')
        .where({
          isReimbursement: true,
          'reimbursement.status': _.exists(false)
        })
        .count()
      
      if (invalidReimbursements.total > 0) {
        console.warn(`⚠️  警告: 有 ${invalidReimbursements.total} 条报销记录数据不完整`)
      } else {
        console.log('✅ 所有报销记录数据完整')
      }
    }
    
  } catch (error) {
    console.error('数据验证失败:', error)
    throw error
  }
}

/**
 * 测试函数：创建示例报销数据
 */
async function createSampleReimbursement() {
  console.log('\n--- 创建示例报销数据 ---')
  
  try {
    const sampleData = {
      _openid: 'test_user_openid',  // 替换为实际的 openid
      
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
        type: 'travel',
        typeName: '差旅费',
        
        applicant: {
          openid: 'test_user_openid',
          name: '张三',
          role: 'employee',
          phone: '138****8888'
        },
        
        status: 'pending',
        approver: null,
        approvalTime: null,
        rejectionReason: null,
        
        vouchers: [],
        
        detail: '3月13-14日前往南京参加养殖技术交流会，高铁往返费用180元，住宿费用100元。',
        remark: '已提前获得经理口头同意'
      },
      
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }
    
    const result = await db.collection('finance_cost_records').add({
      data: sampleData
    })
    
    console.log('✅ 示例报销数据创建成功:', result._id)
    return result._id
    
  } catch (error) {
    console.error('创建示例数据失败:', error)
    throw error
  }
}

// 导出函数（用于云函数调用）
module.exports = {
  setupReimbursementDatabase,
  createSampleReimbursement
}

// 如果直接运行此脚本
if (require.main === module) {
  setupReimbursementDatabase()
    .then(result => {
      console.log('\n最终结果:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n脚本执行失败:', error)
      process.exit(1)
    })
}


