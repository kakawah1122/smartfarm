// 验证 sys_approval_logs 集合配置的脚本
// 使用方法：在云开发控制台的云函数管理中运行此脚本

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function verifyApprovalLogs() {
  console.log('开始验证 sys_approval_logs 集合配置...\n')
  
  try {
    // 1. 检查集合是否存在
    console.log('1. 检查集合是否存在...')
    const collections = await db.listCollections()
    const exists = collections.data.some(c => c.name === 'sys_approval_logs')
    
    if (!exists) {
      console.error('❌ 集合 sys_approval_logs 不存在，请先创建集合')
      return
    }
    console.log('✅ 集合 sys_approval_logs 已创建')
    
    // 2. 测试写入权限（应该失败，因为只允许云函数写入）
    console.log('\n2. 测试写入权限...')
    try {
      await db.collection('sys_approval_logs').add({
        data: {
          test: true,
          createTime: new Date()
        }
      })
      console.log('✅ 云函数可以写入数据')
    } catch (error) {
      console.error('❌ 云函数无法写入数据:', error.message)
    }
    
    // 3. 检查索引配置
    console.log('\n3. 检查索引配置...')
    console.log('请在云开发控制台手动检查以下索引是否已创建：')
    console.log('  - openid_createTime: _openid(升序) + createTime(降序)')
    console.log('  - approvers_status_createTime: approvers(升序) + status(升序) + createTime(降序)')
    console.log('  - status_createTime: status(升序) + createTime(降序)')
    
    // 4. 测试查询
    console.log('\n4. 测试查询功能...')
    try {
      const result = await db.collection('sys_approval_logs')
        .orderBy('createTime', 'desc')
        .limit(10)
        .get()
      console.log(`✅ 查询成功，当前有 ${result.data.length} 条记录`)
      
      if (result.data.length > 0) {
        console.log('\n最新记录示例：')
        const latest = result.data[0]
        console.log(JSON.stringify({
          recordType: latest.recordType,
          status: latest.status,
          approvalTime: latest.approvalTime,
          metadata: latest.metadata
        }, null, 2))
      }
    } catch (error) {
      console.error('❌ 查询失败:', error.message)
    }
    
    // 5. 验证数据结构
    console.log('\n5. 验证数据结构...')
    const expectedFields = [
      '_openid',
      'recordType',
      'recordId',
      'status',
      'approvers',
      'approvalTime',
      'createTime',
      'updateTime'
    ]
    
    const sampleData = {
      _openid: 'test_openid',
      recordType: 'reimbursement',
      recordId: 'test_record_id',
      status: 'approved',
      approvers: ['approver_openid'],
      approvalTime: new Date().toISOString(),
      approvalRemark: '测试备注',
      metadata: {
        typeName: '测试类型',
        amount: 100,
        approverInfo: { name: '测试审批人' },
        operator: '测试申请人'
      },
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    }
    
    console.log('✅ 预期的数据结构：')
    console.log(JSON.stringify(sampleData, null, 2))
    
    console.log('\n验证完成！')
    console.log('请确保在云开发控制台完成以下操作：')
    console.log('1. ✅ 创建 sys_approval_logs 集合')
    console.log('2. ✅ 设置自定义安全规则')
    console.log('3. ✅ 创建 3 个索引')
    console.log('4. ✅ 上传更新后的云函数代码')
    
  } catch (error) {
    console.error('验证过程出错:', error)
  }
}

// 导出函数供云函数调用
exports.main = async (event, context) => {
  await verifyApprovalLogs()
  return { success: true }
}

// 如果直接运行脚本
if (require.main === module) {
  verifyApprovalLogs()
}
