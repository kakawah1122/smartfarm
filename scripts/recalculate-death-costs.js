/**
 * 重新计算死亡记录成本
 * 用于更新旧记录的成本分解数据
 * 
 * 使用方法：
 * 1. 在小程序开发工具控制台运行此脚本
 * 2. 或者通过云函数调用（需要先在云函数中实现）
 */

// ========== 方法1：在小程序控制台运行 ==========

// 重新计算单条死亡记录
function recalculateSingleRecord(deathRecordId) {
  wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'recalculate_death_cost',
      deathRecordId: deathRecordId
    }
  }).then(res => {
    console.log('重新计算成功:', res)
    wx.showToast({
      title: '成本已更新',
      icon: 'success'
    })
    
    // 刷新页面数据
    // 需要根据实际页面调用刷新方法
  }).catch(err => {
    console.error('重新计算失败:', err)
    wx.showToast({
      title: '更新失败',
      icon: 'error'
    })
  })
}

// 批量重新计算所有死亡记录
function recalculateAllRecords() {
  wx.showLoading({ title: '计算中...' })
  
  wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'recalculate_all_death_costs'
    }
  }).then(res => {
    wx.hideLoading()
    console.log('批量计算结果:', res)
    wx.showModal({
      title: '计算完成',
      content: `已更新 ${res.result.updatedCount} 条记录`,
      showCancel: false
    })
  }).catch(err => {
    wx.hideLoading()
    console.error('批量计算失败:', err)
    wx.showModal({
      title: '计算失败',
      content: err.message || '未知错误',
      showCancel: false
    })
  })
}

// ========== 使用示例 ==========

// 示例1：重新计算特定记录
// recalculateSingleRecord('死亡记录ID')

// 示例2：批量重新计算所有记录（谨慎使用）
// recalculateAllRecords()


// ========== 方法2：直接在控制台运行（临时方案）==========

/**
 * 手动更新单条记录的成本分解
 * 适合临时修复少量记录
 */
async function manualUpdateDeathCost(deathRecordId, batchId) {
  const db = wx.cloud.database()
  
  // 1. 重新计算成本
  const costResult = await wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'calculate_batch_cost',
      batchId: batchId
    }
  })
  
  if (!costResult.result.success) {
    console.error('计算失败:', costResult.result)
    return
  }
  
  const costData = costResult.result.data
  console.log('新成本数据:', costData)
  
  // 2. 更新死亡记录
  const deathRecord = await db.collection('health_death_records')
    .doc(deathRecordId)
    .get()
  
  const deathCount = deathRecord.data.deathCount || 1
  const costPerAnimal = parseFloat(costData.avgTotalCost)
  const totalLoss = (costPerAnimal * deathCount).toFixed(2)
  
  await db.collection('health_death_records')
    .doc(deathRecordId)
    .update({
      data: {
        'financialLoss.unitCost': costPerAnimal.toFixed(2),
        'financialLoss.totalLoss': totalLoss,
        'financialLoss.costBreakdown': costData.breakdown,
        'financialLoss.calculationMethod': 'avg_total_cost',
        updatedAt: new Date()
      }
    })
  
  console.log('✅ 更新成功！')
  console.log('新的成本分解:', costData.breakdown)
  
  wx.showToast({
    title: '更新成功',
    icon: 'success'
  })
}

// 使用示例：
// manualUpdateDeathCost('死亡记录ID', 'QY-20251117')


// ========== 快速测试 ==========

/**
 * 快速测试云函数是否正常工作
 */
function testCalculateBatchCost() {
  const batchId = 'QY-20251117'  // 替换为实际批次ID
  
  console.log('测试批次:', batchId)
  
  wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'calculate_batch_cost',
      batchId: batchId
    }
  }).then(res => {
    console.log('✅ 云函数调用成功')
    console.log('返回数据:', JSON.stringify(res.result, null, 2))
    
    const breakdown = res.result.data.breakdown
    console.log('\n=== 成本分解详情 ===')
    console.log('鹅苗成本:', breakdown.entryUnitCost)
    console.log('饲养成本:', breakdown.breedingCost, '(物料:', breakdown.materialCostTotal, '+ 投喂:', breakdown.feedCostTotal, ')')
    console.log('预防成本:', breakdown.preventionCost)
    console.log('治疗成本:', breakdown.treatmentCost)
  }).catch(err => {
    console.error('❌ 云函数调用失败:', err)
  })
}

// 运行测试：
// testCalculateBatchCost()


// ========== 导出 ==========
module.exports = {
  recalculateSingleRecord,
  recalculateAllRecords,
  manualUpdateDeathCost,
  testCalculateBatchCost
}
