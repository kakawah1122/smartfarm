/**
 * 调试死亡记录成本分解数据
 * 用于检查最新死亡记录的costBreakdown字段
 */

// 在小程序开发工具控制台运行此代码
wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'get_death_records_list'
  }
}).then(res => {
  console.log('=== 死亡记录列表 ===')
  console.log('成功:', res.result.success)
  console.log('记录数:', res.result.data?.length || 0)
  
  if (res.result.success && res.result.data && res.result.data.length > 0) {
    // 获取最新的记录
    const latestRecord = res.result.data[0]
    
    console.log('\n=== 最新死亡记录 ===')
    console.log('记录ID:', latestRecord._id)
    console.log('批次ID:', latestRecord.batchId)
    console.log('死亡数量:', latestRecord.deathCount)
    console.log('死亡原因:', latestRecord.deathCause)
    console.log('创建时间:', latestRecord.createdAt)
    
    console.log('\n=== 财务损失对象 ===')
    console.log('financialLoss:', JSON.stringify(latestRecord.financialLoss, null, 2))
    
    if (latestRecord.financialLoss) {
      console.log('\n=== 成本分解详情 ===')
      console.log('unitCost:', latestRecord.financialLoss.unitCost)
      console.log('totalLoss:', latestRecord.financialLoss.totalLoss)
      console.log('calculationMethod:', latestRecord.financialLoss.calculationMethod)
      
      const breakdown = latestRecord.financialLoss.costBreakdown
      if (breakdown) {
        console.log('\n=== costBreakdown 字段 ===')
        console.log('完整对象:', JSON.stringify(breakdown, null, 2))
        console.log('\n各项成本:')
        console.log('- entryCostTotal:', breakdown.entryCostTotal)
        console.log('- materialCostTotal:', breakdown.materialCostTotal)
        console.log('- preventionCostTotal:', breakdown.preventionCostTotal)
        console.log('- treatmentCostTotal:', breakdown.treatmentCostTotal)
        console.log('- entryUnitCost:', breakdown.entryUnitCost)
        console.log('- breedingCost:', breakdown.breedingCost)
        console.log('- preventionCost:', breakdown.preventionCost)
        console.log('- treatmentCost:', breakdown.treatmentCost)
      } else {
        console.warn('⚠️ costBreakdown 字段不存在！')
      }
    } else {
      console.warn('⚠️ financialLoss 字段不存在！')
    }
  } else {
    console.warn('⚠️ 没有找到死亡记录')
  }
}).catch(err => {
  console.error('❌ 调用失败:', err)
})

// ============ 或者直接查询数据库 ============

// 在云函数中运行此代码查看原始数据
/*
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const result = await db.collection('health_death_records')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  
  if (result.data.length > 0) {
    const record = result.data[0]
    console.log('最新死亡记录:', JSON.stringify(record, null, 2))
    return {
      success: true,
      record: record
    }
  } else {
    return {
      success: false,
      message: '没有找到死亡记录'
    }
  }
}
*/
