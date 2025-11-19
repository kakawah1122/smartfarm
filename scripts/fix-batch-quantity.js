/**
 * 修复批次quantity字段脚本
 * 用途：检查并修复 prod_batch_entries 集合中缺失或错误的 quantity 字段
 * 
 * 使用方法：
 * 1. 在微信开发者工具控制台运行
 * 2. 或者在云函数中调用
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function fixBatchQuantity() {
  console.log('开始检查批次数据...')
  
  try {
    // 1. 查询所有批次入栏记录
    const allBatches = await db.collection('prod_batch_entries')
      .where({
        isDeleted: _.neq(true)
      })
      .get()
    
    console.log(`找到 ${allBatches.data.length} 条批次记录`)
    
    let fixedCount = 0
    let errorCount = 0
    const issues = []
    
    // 2. 检查每条记录
    for (const batch of allBatches.data) {
      const problems = []
      let needsUpdate = false
      const updates = {}
      
      // 检查 quantity 字段
      if (batch.quantity === undefined || batch.quantity === null) {
        problems.push('缺少quantity字段')
        needsUpdate = true
        updates.quantity = 0
      } else if (typeof batch.quantity === 'string') {
        problems.push('quantity是字符串类型')
        needsUpdate = true
        updates.quantity = Number(batch.quantity) || 0
      } else if (batch.quantity === 0) {
        problems.push('quantity为0')
      }
      
      // 检查 batchNumber 字段
      if (!batch.batchNumber) {
        problems.push('缺少batchNumber字段')
        needsUpdate = true
        // 尝试从 _id 或其他字段生成
        updates.batchNumber = batch._id
      }
      
      if (problems.length > 0) {
        issues.push({
          _id: batch._id,
          batchNumber: batch.batchNumber,
          quantity: batch.quantity,
          problems: problems,
          needsUpdate: needsUpdate
        })
      }
      
      // 3. 如果需要更新，执行修复
      if (needsUpdate && Object.keys(updates).length > 0) {
        try {
          await db.collection('prod_batch_entries')
            .doc(batch._id)
            .update({
              data: updates
            })
          fixedCount++
          console.log(`✅ 修复批次 ${batch.batchNumber || batch._id}:`, updates)
        } catch (error) {
          errorCount++
          console.error(`❌ 修复失败 ${batch._id}:`, error)
        }
      }
    }
    
    // 4. 输出总结报告
    console.log('\n========== 修复完成 ==========')
    console.log(`总批次数: ${allBatches.data.length}`)
    console.log(`发现问题: ${issues.length}`)
    console.log(`已修复: ${fixedCount}`)
    console.log(`修复失败: ${errorCount}`)
    
    if (issues.length > 0) {
      console.log('\n问题详情:')
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. 批次 ${issue.batchNumber || issue._id}`)
        console.log(`   quantity: ${issue.quantity}`)
        console.log(`   问题: ${issue.problems.join(', ')}`)
        console.log(`   需要更新: ${issue.needsUpdate ? '是' : '否'}`)
      })
    }
    
    return {
      success: true,
      total: allBatches.data.length,
      issuesFound: issues.length,
      fixed: fixedCount,
      errors: errorCount,
      issues: issues
    }
  } catch (error) {
    console.error('修复过程出错:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出函数供云函数使用
module.exports = {
  fixBatchQuantity
}

// 如果在本地运行（非云函数环境）
if (typeof wx !== 'undefined') {
  console.log('在微信开发者工具中运行修复脚本...')
  fixBatchQuantity().then(result => {
    console.log('修复结果:', result)
  })
}
