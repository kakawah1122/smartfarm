/**
 * 修复死亡记录成本计算
 * 使用实际操作数量作为分母进行成本分摊
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 集合名称
const COLLECTIONS = {
  HEALTH_DEATH_RECORDS: 'health_death_records',
  PROD_BATCH_ENTRIES: 'prod_batch_entries'
}

/**
 * 修复单个死亡记录的成本计算
 */
async function fixSingleDeathRecord(recordId) {
  try {
    // 1. 获取死亡记录
    const deathRecord = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!deathRecord.data) {
      throw new Error('死亡记录不存在')
    }
    
    const record = deathRecord.data
    const batchId = record.batchId
    const deathCount = record.deathCount || 1
    
    // 2. 重新计算批次成本
    const costResult = await cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'calculate_batch_cost',
        batchId: batchId
      }
    })
    
    if (!costResult.result.success) {
      throw new Error('计算批次成本失败')
    }
    
    const costData = costResult.result.data
    const costPerAnimal = parseFloat(costData.avgTotalCost)
    const totalLoss = (costPerAnimal * deathCount).toFixed(2)
    
    // 3. 更新死亡记录
    await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .update({
        data: {
          'financialLoss.unitCost': costPerAnimal.toFixed(2),
          'financialLoss.totalLoss': totalLoss,
          'financialLoss.costBreakdown': costData.breakdown,
          'financialLoss.calculationMethod': 'actual_target_count',
          updatedAt: new Date()
        }
      })
    
    console.log(`✅ 修复成功: ${recordId}`)
    console.log(`  死亡数量: ${deathCount}`)
    console.log(`  单只成本: ¥${costPerAnimal.toFixed(2)}`)
    console.log(`  总损失: ¥${totalLoss}`)
    console.log('  成本分解:')
    console.log(`    - 鹅苗成本: ¥${costData.breakdown.entryUnitCost}`)
    console.log(`    - 饲养成本: ¥${costData.breakdown.breedingCost} (基于${costData.breakdown.feedTargetCount}只投喂)`)
    console.log(`    - 预防成本: ¥${costData.breakdown.preventionCost} (基于${costData.breakdown.preventionTargetCount}只预防)`)
    console.log(`    - 治疗成本: ¥${costData.breakdown.treatmentCost} (基于${costData.breakdown.treatmentTargetCount}只治疗)`)
    
    return {
      success: true,
      recordId: recordId,
      unitCost: costPerAnimal.toFixed(2),
      totalLoss: totalLoss
    }
    
  } catch (error) {
    console.error(`❌ 修复失败: ${recordId}`, error.message)
    return {
      success: false,
      recordId: recordId,
      error: error.message
    }
  }
}

/**
 * 批量修复所有死亡记录
 */
async function fixAllDeathRecords() {
  try {
    console.log('开始批量修复死亡记录成本...')
    
    // 获取所有未删除的死亡记录
    const deathRecords = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        isDeleted: _.neq(true)
      })
      .limit(1000)  // 一次处理1000条
      .get()
    
    console.log(`找到 ${deathRecords.data.length} 条死亡记录`)
    
    let successCount = 0
    let failCount = 0
    const results = []
    
    // 按批次分组，减少重复计算
    const batchGroups = {}
    for (const record of deathRecords.data) {
      const batchId = record.batchId
      if (!batchGroups[batchId]) {
        batchGroups[batchId] = []
      }
      batchGroups[batchId].push(record)
    }
    
    console.log(`共涉及 ${Object.keys(batchGroups).length} 个批次`)
    
    // 按批次处理
    for (const [batchId, records] of Object.entries(batchGroups)) {
      console.log(`\n处理批次: ${batchId} (${records.length}条记录)`)
      
      // 计算一次批次成本
      let costData = null
      try {
        const costResult = await cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'calculate_batch_cost',
            batchId: batchId
          }
        })
        
        if (costResult.result.success) {
          costData = costResult.result.data
        }
      } catch (error) {
        console.error(`计算批次 ${batchId} 成本失败:`, error.message)
      }
      
      if (!costData) {
        failCount += records.length
        continue
      }
      
      // 更新该批次的所有死亡记录
      for (const record of records) {
        try {
          const deathCount = record.deathCount || 1
          const costPerAnimal = parseFloat(costData.avgTotalCost)
          const totalLoss = (costPerAnimal * deathCount).toFixed(2)
          
          await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
            .doc(record._id)
            .update({
              data: {
                'financialLoss.unitCost': costPerAnimal.toFixed(2),
                'financialLoss.totalLoss': totalLoss,
                'financialLoss.costBreakdown': costData.breakdown,
                'financialLoss.calculationMethod': 'actual_target_count',
                updatedAt: new Date()
              }
            })
          
          successCount++
          console.log(`  ✅ ${record._id}: ¥${costPerAnimal.toFixed(2)}/只 × ${deathCount} = ¥${totalLoss}`)
          
        } catch (error) {
          failCount++
          console.error(`  ❌ ${record._id}: ${error.message}`)
        }
      }
    }
    
    console.log('\n=== 修复完成 ===')
    console.log(`成功: ${successCount} 条`)
    console.log(`失败: ${failCount} 条`)
    console.log(`成功率: ${(successCount / (successCount + failCount) * 100).toFixed(1)}%`)
    
    return {
      success: true,
      total: deathRecords.data.length,
      successCount,
      failCount
    }
    
  } catch (error) {
    console.error('批量修复失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出函数供云函数调用
module.exports = {
  fixSingleDeathRecord,
  fixAllDeathRecords
}
