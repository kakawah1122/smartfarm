/**
 * 清理并重建批次的完整脚本
 * 用于彻底解决任务重复问题
 * 
 * 使用方法：
 * 1. 在云开发控制台创建临时云函数
 * 2. 粘贴此代码
 * 3. 修改下面的批次号
 * 4. 执行云函数
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  // ========== 配置区域 ==========
  const BATCH_NUMBER = 'QY-20251103'  // 🔥 修改为你的批次号
  
  console.log(`========== 开始清理批次: ${BATCH_NUMBER} ==========`)
  
  try {
    // 1. 查找批次
    const batchResult = await db.collection('production_batch_entries')
      .where({ batchNumber: BATCH_NUMBER })
      .get()
    
    if (batchResult.data.length === 0) {
      console.log('❌ 未找到批次')
      return {
        success: false,
        message: `未找到批次 ${BATCH_NUMBER}`
      }
    }
    
    const batch = batchResult.data[0]
    const batchId = batch._id
    
    console.log('✅ 找到批次:', {
      _id: batchId,
      batchNumber: batch.batchNumber,
      entryDate: batch.entryDate,
      quantity: batch.quantity
    })
    
    // 2. 清理相关数据
    const cleanupResults = {}
    
    // 2.1 删除任务
    console.log('\n--- 清理任务 ---')
    const tasksResult = await db.collection('task_batch_schedules')
      .where({ batchId })
      .count()
    console.log(`找到 ${tasksResult.total} 个任务`)
    
    if (tasksResult.total > 0) {
      const deleteTasksResult = await db.collection('task_batch_schedules')
        .where({ batchId })
        .remove()
      cleanupResults.tasks = deleteTasksResult.stats.removed
      console.log(`✅ 已删除 ${deleteTasksResult.stats.removed} 个任务`)
    } else {
      cleanupResults.tasks = 0
      console.log('无任务需要删除')
    }
    
    // 2.2 删除任务完成记录
    console.log('\n--- 清理任务完成记录 ---')
    const completionsResult = await db.collection('task_completions')
      .where({ batchId })
      .count()
    console.log(`找到 ${completionsResult.total} 个完成记录`)
    
    if (completionsResult.total > 0) {
      const deleteCompletionsResult = await db.collection('task_completions')
        .where({ batchId })
        .remove()
      cleanupResults.completions = deleteCompletionsResult.stats.removed
      console.log(`✅ 已删除 ${deleteCompletionsResult.stats.removed} 个完成记录`)
    } else {
      cleanupResults.completions = 0
      console.log('无完成记录需要删除')
    }
    
    // 2.3 删除健康记录
    console.log('\n--- 清理健康记录 ---')
    const healthResult = await db.collection('health_records')
      .where({ batchId })
      .count()
    console.log(`找到 ${healthResult.total} 个健康记录`)
    
    if (healthResult.total > 0) {
      const deleteHealthResult = await db.collection('health_records')
        .where({ batchId })
        .remove()
      cleanupResults.health = deleteHealthResult.stats.removed
      console.log(`✅ 已删除 ${deleteHealthResult.stats.removed} 个健康记录`)
    } else {
      cleanupResults.health = 0
      console.log('无健康记录需要删除')
    }
    
    // 2.4 删除预防记录
    console.log('\n--- 清理预防记录 ---')
    const preventionResult = await db.collection('health_prevention_records')
      .where({ batchId })
      .count()
    console.log(`找到 ${preventionResult.total} 个预防记录`)
    
    if (preventionResult.total > 0) {
      const deletePreventionResult = await db.collection('health_prevention_records')
        .where({ batchId })
        .remove()
      cleanupResults.prevention = deletePreventionResult.stats.removed
      console.log(`✅ 已删除 ${deletePreventionResult.stats.removed} 个预防记录`)
    } else {
      cleanupResults.prevention = 0
      console.log('无预防记录需要删除')
    }
    
    // 2.5 删除治疗记录
    console.log('\n--- 清理治疗记录 ---')
    const treatmentResult = await db.collection('health_treatment_records')
      .where({ batchId })
      .count()
    console.log(`找到 ${treatmentResult.total} 个治疗记录`)
    
    if (treatmentResult.total > 0) {
      const deleteTreatmentResult = await db.collection('health_treatment_records')
        .where({ batchId })
        .remove()
      cleanupResults.treatment = deleteTreatmentResult.stats.removed
      console.log(`✅ 已删除 ${deleteTreatmentResult.stats.removed} 个治疗记录`)
    } else {
      cleanupResults.treatment = 0
      console.log('无治疗记录需要删除')
    }
    
    // 2.6 删除死亡记录
    console.log('\n--- 清理死亡记录 ---')
    const deathResult = await db.collection('death_records')
      .where({ batchId })
      .count()
    console.log(`找到 ${deathResult.total} 个死亡记录`)
    
    if (deathResult.total > 0) {
      const deleteDeathResult = await db.collection('death_records')
        .where({ batchId })
        .remove()
      cleanupResults.death = deleteDeathResult.stats.removed
      console.log(`✅ 已删除 ${deleteDeathResult.stats.removed} 个死亡记录`)
    } else {
      cleanupResults.death = 0
      console.log('无死亡记录需要删除')
    }
    
    // 3. 删除批次本身（可选）
    console.log('\n--- 删除批次记录 ---')
    await db.collection('production_batch_entries')
      .doc(batchId)
      .remove()
    console.log('✅ 已删除批次记录')
    
    console.log('\n========== 清理完成 ==========')
    console.log('清理统计:', cleanupResults)
    console.log('\n请在小程序中重新创建入栏记录')
    
    return {
      success: true,
      batchId,
      batchNumber: BATCH_NUMBER,
      cleanupResults,
      message: `批次 ${BATCH_NUMBER} 已彻底清理，请重新创建入栏记录`
    }
    
  } catch (error) {
    console.error('清理失败:', error)
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}

