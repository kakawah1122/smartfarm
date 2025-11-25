/**
 * complete_treatment_as_died 处理函数
 * 完成治疗（死亡）（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')
const DatabaseManager = require('../database-manager')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

/**
 * 主处理函数 - 完成治疗（标记为死亡）
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { treatmentId, diedCount, deathDetails } = event
    const openid = wxContext.OPENID
    
    // 参数验证
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    
    // 1. 获取治疗记录
    const treatmentRecord = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId).get()
    
    if (!treatmentRecord.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentRecord.data
    const actualDiedCount = diedCount || treatment.initialCount
    
    // ✅ 保留原有逻辑：计算每只动物的摊销治疗成本（用于财务损失计算）
    const totalTreated = treatment.outcome?.totalTreated || treatment.initialCount || 1
    const treatmentCostPerAnimal = totalTreated > 0 ? (treatment.totalCost || 0) / totalTreated : 0
    const amortizedTreatmentCost = treatmentCostPerAnimal * actualDiedCount
    
    // ✅ 2. 查询是否已存在该治疗记录的死亡记录
    const existingDeathRecords = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        treatmentRecordId: treatmentId,
        ...dbManager.buildNotDeletedCondition(true)
      })
      .limit(1)
      .get()
    
    // 获取批次信息计算损失（容错处理）
    let batch = null
    let batchDocId = treatment.batchId
    let costPerAnimal = 0
    let costBreakdown = null
    
    try {
      try {
        const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .doc(treatment.batchId).get()
        batch = batchEntry.data
        batchDocId = treatment.batchId
      } catch (err) {
        const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .where({
            batchNumber: treatment.batchId,
            ...dbManager.buildNotDeletedCondition(true)
          })
          .limit(1)
          .get()
        
        if (batchQueryResult.data && batchQueryResult.data.length > 0) {
          batch = batchQueryResult.data[0]
          batchDocId = batch._id
        }
      }
      
      if (batch) {
        // TODO: calculateBatchCost需要在finance模块迁移后通过云函数间调用
        // 暂时使用入栏单价作为降级方案
        costPerAnimal = parseFloat(batch.unitPrice) || 0
        // 暂时使用入栏单价
      }
    } catch (costError) {
      console.error('计算财务损失失败:', costError.message)
    }
    
    let deathRecordId = null
    let isUpdate = false
    
    // ✅ 3. 如果已存在死亡记录，则更新；否则创建新记录
    if (existingDeathRecords.data && existingDeathRecords.data.length > 0) {
      // 已存在，累加更新
      const existingRecord = existingDeathRecords.data[0]
      deathRecordId = existingRecord._id
      isUpdate = true
      
      const oldDeathCount = existingRecord.deathCount || existingRecord.totalDeathCount || 0
      const newDeathCount = oldDeathCount + actualDiedCount
      
      const oldTotalLoss = existingRecord.financialLoss?.totalLoss || 0
      const incrementLoss = costPerAnimal * actualDiedCount
      const newTotalLoss = oldTotalLoss + incrementLoss
      
      const oldTreatmentCost = existingRecord.financialLoss?.treatmentCost || 0
      const newTreatmentCost = oldTreatmentCost + amortizedTreatmentCost
      
      await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).doc(deathRecordId).update({
        data: {
          deathCount: newDeathCount,
          totalDeathCount: newDeathCount, // 兼容旧字段
          'financialLoss.totalLoss': newTotalLoss,
          'financialLoss.treatmentCost': newTreatmentCost,
          updatedAt: new Date()
        }
      })
      
      // 更新死亡记录成功
      
    } else {
      // 不存在，创建新记录
      const totalLoss = costPerAnimal * actualDiedCount
      
      const deathRecordData = {
        _openid: openid,  // ✅ 添加_openid字段用于查询
        batchId: treatment.batchId,
        batchNumber: batch?.batchNumber || treatment.batchId,
        treatmentRecordId: treatmentId,
        treatmentId: treatmentId,  // 兼容字段
        diagnosisId: treatment.diagnosisId || null,
        deathDate: new Date().toISOString().split('T')[0],
        deathCause: treatment.diagnosis || '治疗无效',
        deathCategory: 'disease',
        deathCount: actualDiedCount,
        totalDeathCount: actualDiedCount, // 兼容旧字段
        description: deathDetails?.description || `治疗失败导致死亡 - ${treatment.diagnosis}`,
        disposalMethod: deathDetails?.disposalMethod || 'burial',
        operator: openid,
        operatorName: deathDetails?.operatorName || '系统',
        financialLoss: {
          costPerAnimal,
          totalLoss,
          treatmentCost: amortizedTreatmentCost,
          calculationMethod: 'avg_total_cost',
          currency: 'CNY',
          costBreakdown: costBreakdown
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      }
      
      const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
        data: deathRecordData
      })
      
      deathRecordId = deathResult._id
      
      // 创建死亡记录成功
    }
    
    // 4. 更新治疗记录的 outcome
    const currentOutcome = treatment.outcome || {}
    const oldDiedCount = currentOutcome.deathCount || 0
    const newTotalDiedCount = oldDiedCount + actualDiedCount
    
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).doc(treatmentId).update({
      data: {
        'outcome.deathCount': newTotalDiedCount,
        'outcome.status': 'partial_died', // 部分死亡状态
        deathRecordId: deathRecordId,
        updatedAt: new Date()
      }
    })
    
    // 5. 调用财务云函数记录损失（保留原有逻辑）
    const incrementLoss = (costPerAnimal * actualDiedCount) + amortizedTreatmentCost
    if (incrementLoss > 0) {
      try {
        await cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'createDeathLossRecord',
            deathRecordId: deathRecordId,
            batchId: treatment.batchId,
            deathCount: actualDiedCount,
            totalLoss: incrementLoss,
            treatmentCost: amortizedTreatmentCost,
            description: `死亡损失 - ${treatment.diagnosis} - ${actualDiedCount}只`
          }
        })
      } catch (financeError) {
        console.error('记录死亡损失失败:', financeError)
      }
    }
    
    // 6. 更新批次存栏数和死亡数
    await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchDocId).update({
      data: {
        currentCount: _.inc(-actualDiedCount),
        deadCount: _.inc(actualDiedCount),
        updatedAt: new Date()
      }
    })
    
    // 7. 记录审计日志（保持原有审计逻辑）
    await dbManager.createAuditLog(
      openid,
      'complete_treatment_as_died',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        batchId: treatment.batchId,
        diedCount: actualDiedCount,
        deathRecordId: deathRecordId,
        isUpdate: isUpdate,
        financialLoss: incrementLoss,
        result: 'success'
      }
    )
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: {
        treatmentId,
        deathRecordId: deathRecordId,
        diedCount: actualDiedCount,
        isUpdate: isUpdate,
        financialLoss: incrementLoss
      },
      message: isUpdate ? '死亡记录已更新' : '死亡记录已创建'
    }
    
  } catch (error) {
    console.error('[complete_treatment_as_died] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '标记死亡失败'
    }
  }
}
