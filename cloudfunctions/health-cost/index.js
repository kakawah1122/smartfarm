/**
 * health-cost 云函数
 * 负责健康管理相关的成本计算
 * 从 health-management 拆分出来的独立模块
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 引入共享的集合配置
const { COLLECTIONS } = require('./collections.js')

/**
 * 计算批次平均成本
 * 包括鹅苗成本、饲养成本、预防成本、治疗成本
 */
async function calculateBatchCost(event, wxContext) {
  try {
    const { batchId } = event
    
    if (!batchId) {
      return {
        success: false,
        error: '缺少批次ID'
      }
    }
    
    // 获取批次信息
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    const batch = batchResult.data
    const entryQuantity = batch.quantity || 0
    const currentQuantity = batch.currentQuantity || 0
    const entryUnitPrice = batch.unitPrice || 0
    
    // 1. 鹅苗成本（入栏单价）
    const entryUnitCost = entryUnitPrice
    
    // 2. 饲养成本（饲料 + 物料）
    let breedingCost = 0
    let totalFeedCount = 0  // 累计饲喂数量
    let materialCount = 0
    
    // 获取投喂记录
    const feedResult = await db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
      .where({
        batchNumber: batch.batchNumber,
        isDeleted: _.neq(true)
      })
      .get()
    
    feedResult.data.forEach(record => {
      breedingCost += (Number(record.totalCost) || 0)
      // 累计实际饲喂数量（如果有feedCount字段）
      totalFeedCount += (Number(record.feedCount) || Number(record.quantity) || currentQuantity)
    })
    
    // 获取物料使用记录  
    const materialResult = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where({
        batchId: batchId,
        type: 'use',
        isDeleted: _.neq(true)
      })
      .get()
    
    materialResult.data.forEach(record => {
      breedingCost += (Number(record.totalCost) || 0)
      materialCount++
    })
    
    // 如果没有饲喂记录，使用当前存栏数作为默认值
    if (totalFeedCount === 0) {
      totalFeedCount = currentQuantity || 1
    }
    
    // 3. 预防成本（来自待办任务执行）
    let preventionCost = 0
    let totalPreventionCount = 0  // 累计实际预防数量
    
    const preventionResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    preventionResult.data.forEach(record => {
      if (record.costInfo) {
        preventionCost += (Number(record.costInfo.totalCost) || 0)
        // 获取实际预防数量（可能来自任务的目标数量）
        const targetCount = Number(record.targetCount) || Number(record.animalCount) || currentQuantity
        totalPreventionCount += targetCount
      }
    })
    
    // 如果没有预防记录，使用当前存栏数
    if (totalPreventionCount === 0) {
      totalPreventionCount = currentQuantity || 1
    }
    
    // 4. 治疗成本（基于病鹅数量）
    let treatmentCost = 0
    let totalAffectedCount = 0  // 累计病鹅数量
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        batchId: batchId
      })
      .get()
    
    // 获取关联的AI诊断记录ID列表
    const diagnosisIds = []
    
    treatmentResult.data.forEach(record => {
      // 兼容多种数据结构，与calculateTreatmentCost保持一致
      let cost = 0
      
      // 1. 标准结构：costInfo.totalCost
      if (record.costInfo && record.costInfo.totalCost) {
        cost = Number(record.costInfo.totalCost) || 0
      }
      // 2. 治疗统计记录：curedMedicationCost
      else if (record.treatmentType === 'medication' && record.curedMedicationCost !== undefined) {
        cost = Number(record.curedMedicationCost) || 0
      }
      // 3. 根级别的totalCost
      else if (record.totalCost !== undefined) {
        cost = Number(record.totalCost) || 0
      }
      // 4. amount字段
      else if (record.amount) {
        cost = Number(record.amount) || 0
      }
      
      if (cost > 0) {
        treatmentCost += cost
        // 收集诊断ID
        if (record.diagnosisId) {
          diagnosisIds.push(record.diagnosisId)
        }
        // 如果记录中直接有受影响数量
        if (record.affectedCount) {
          totalAffectedCount += Number(record.affectedCount)
        }
      }
    })
    
    // 如果有诊断ID，查询AI诊断记录获取受影响数量
    if (diagnosisIds.length > 0 && totalAffectedCount === 0) {
      const diagnosisResult = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
        .where({
          _id: _.in(diagnosisIds)
        })
        .get()
      
      diagnosisResult.data.forEach(diagnosis => {
        totalAffectedCount += Number(diagnosis.affectedCount || diagnosis.animalCount || 0)
      })
    }
    
    // 如果没有受影响数量，使用当前存栏数
    if (totalAffectedCount === 0) {
      totalAffectedCount = currentQuantity || 1
    }
    
    // 计算平均成本（基于实际分摊基数）
    const avgBreedingCost = totalFeedCount > 0 ? breedingCost / totalFeedCount : 0
    const avgPreventionCost = totalPreventionCount > 0 ? preventionCost / totalPreventionCount : 0
    const avgTreatmentCost = totalAffectedCount > 0 ? treatmentCost / totalAffectedCount : 0
    
    // 单只综合成本（用于死亡损失计算）
    const totalAvgCost = entryUnitCost + avgBreedingCost + avgPreventionCost + avgTreatmentCost
    
    
    return {
      success: true,
      data: {
        batchId,
        batchNumber: batch.batchNumber,
        entryQuantity,
        currentQuantity,
        costs: {
          entry: {
            unitCost: entryUnitCost.toFixed(2),
            totalCost: (entryUnitCost * entryQuantity).toFixed(2)
          },
          breeding: {
            unitCost: avgBreedingCost.toFixed(2),
            totalCost: breedingCost.toFixed(2),
            baseCount: totalFeedCount,  // 分摊基数：总饲喂数量
            materialCount
          },
          prevention: {
            unitCost: avgPreventionCost.toFixed(2),
            totalCost: preventionCost.toFixed(2),
            baseCount: totalPreventionCount  // 分摊基数：实际预防数量
          },
          treatment: {
            unitCost: avgTreatmentCost.toFixed(2),
            totalCost: treatmentCost.toFixed(2),
            baseCount: totalAffectedCount  // 分摊基数：病鹅数量
          },
          total: {
            unitCost: totalAvgCost.toFixed(2),
            totalCost: (totalAvgCost * currentQuantity).toFixed(2)
          }
        },
        breakdown: {
          entryUnitCost: entryUnitCost.toFixed(2),
          breedingCost: avgBreedingCost.toFixed(2),
          preventionCost: avgPreventionCost.toFixed(2),
          treatmentCost: avgTreatmentCost.toFixed(2),
          totalCost: totalAvgCost.toFixed(2)
        }
      }
    }
  } catch (error) {
    console.error('[calculateBatchCost] 错误:', error)
    return {
      success: false,
      error: error.message || '计算批次成本失败'
    }
  }
}

/**
 * 计算治疗成本统计
 */
async function calculateTreatmentCost(event, wxContext) {
  try {
    const { dateRange, batchId } = event
    
    // 构建查询条件 - 兼容没有isDeleted字段的记录
    let conditions = {}
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    
    // 暂时不限制日期和删除状态，确保能查到数据
    // if (dateRange && dateRange.start && dateRange.end) {
    //   conditions.createTime = _.and(_.gte(new Date(dateRange.start)), _.lte(new Date(dateRange.end)))
    // }
    
    // 使用统一的集合配置进行查询
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(conditions)
      .get()
    
    let totalCost = 0
    let treatmentCount = 0
    let medicationCost = 0
    let veterinaryCost = 0
    let otherCost = 0
    
    result.data.forEach(record => {
      // 兼容多种数据结构
      let cost = 0
      
      // 1. 优先从 costInfo.totalCost 获取（标准治疗记录结构）
      if (record.costInfo && record.costInfo.totalCost) {
        cost = Number(record.costInfo.totalCost) || 0
        medicationCost += Number(record.costInfo.medicationCost) || 0
        veterinaryCost += Number(record.costInfo.veterinaryCost) || 0
        otherCost += Number(record.costInfo.otherCost) || 0
      } 
      // 2. 从治疗统计记录获取（您的数据是汇总统计）
      else if (record.treatmentType === 'medication') {
        // 这是一个治疗统计记录，包含所有治疗成本
        // curedMedicationCost 是所有用药成本（不管结果如何）
        if (record.curedMedicationCost !== undefined) {
          cost = Number(record.curedMedicationCost) || 0
          medicationCost = cost
        }
        // 如果没有curedMedicationCost，使用其他字段
        else if (record.totalCost !== undefined) {
          cost = Number(record.totalCost) || 0
        }
      }
      // 3. 从根级别的totalCost获取（其他数据结构）
      else if (record.totalCost !== undefined) {
        cost = Number(record.totalCost) || 0
      }
      // 4. 从amount字段获取（另一种结构）
      else if (record.amount) {
        cost = Number(record.amount) || 0
      }
      
      if (cost > 0) {
        totalCost += cost
        treatmentCount++
      }
    })
    
    return {
      success: true,
      data: {
        totalCost: totalCost.toFixed(2),
        treatmentCount,
        avgCost: treatmentCount > 0 ? (totalCost / treatmentCount).toFixed(2) : '0.00',
        breakdown: {
          medicationCost: medicationCost.toFixed(2),
          veterinaryCost: veterinaryCost.toFixed(2),
          otherCost: otherCost.toFixed(2)
        }
      }
    }
  } catch (error) {
    console.error('[calculateTreatmentCost] 错误:', error)
    return {
      success: false,
      error: error.message || '计算治疗成本失败'
    }
  }
}

/**
 * 计算批次治疗成本
 */
async function calculateBatchTreatmentCosts(event, wxContext) {
  try {
    const { batchIds } = event
    
    if (!batchIds || !Array.isArray(batchIds)) {
      return {
        success: false,
        error: '缺少批次ID列表'
      }
    }
    
    const results = {}
    
    for (const batchId of batchIds) {
      const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          batchId,
          isDeleted: false
        })
        .get()
      
      let totalCost = 0
      let count = 0
      
      result.data.forEach(record => {
        if (record.costInfo && record.costInfo.totalCost) {
          totalCost += Number(record.costInfo.totalCost) || 0
          count++
        }
      })
      
      results[batchId] = {
        totalCost: totalCost.toFixed(2),
        count,
        avgCost: count > 0 ? (totalCost / count).toFixed(2) : '0.00'
      }
    }
    
    return {
      success: true,
      data: results
    }
  } catch (error) {
    console.error('[calculateBatchTreatmentCosts] 错误:', error)
    return {
      success: false,
      error: error.message || '计算批次治疗成本失败'
    }
  }
}

/**
 * 重新计算死亡记录成本
 * 修复历史数据的成本计算错误
 */
async function recalculateDeathCost(event, wxContext) {
  try {
    const { deathRecordId } = event
    
    if (!deathRecordId) {
      return {
        success: false,
        error: '缺少死亡记录ID'
      }
    }
    
    // 获取死亡记录
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(deathRecordId)
      .get()
    
    if (!deathResult.data) {
      return {
        success: false,
        error: '死亡记录不存在'
      }
    }
    
    const deathRecord = deathResult.data
    const { batchId } = deathRecord
    
    // 调用计算批次成本
    const costResult = await calculateBatchCost({ batchId }, wxContext)
    
    if (!costResult.success) {
      return costResult
    }
    
    // 更新死亡记录的成本信息
    await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(deathRecordId)
      .update({
        data: {
          costBreakdown: costResult.data.breakdown,
          totalCost: costResult.data.costs.total.unitCost,
          updateTime: db.serverDate()
        }
      })
    
    return {
      success: true,
      data: {
        deathRecordId,
        costBreakdown: costResult.data.breakdown
      }
    }
  } catch (error) {
    console.error('[recalculateDeathCost] 错误:', error)
    return {
      success: false,
      error: error.message || '重算死亡成本失败'
    }
  }
}

/**
 * 批量重算所有死亡记录成本
 */
async function recalculateAllDeathCosts(event, wxContext) {
  try {
    const { batchId } = event
    
    // 构建查询条件
    let conditions = {
      _openid: wxContext.OPENID
    }
    
    if (batchId) {
      conditions.batchId = batchId
    }
    
    // 获取需要重算的死亡记录
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where(conditions)
      .get()
    
    if (deathResult.data.length === 0) {
      return {
        success: true,
        data: {
          message: '没有需要重算的记录',
          count: 0
        }
      }
    }
    
    // 按批次分组
    const batchGroups = {}
    deathResult.data.forEach(record => {
      if (!batchGroups[record.batchId]) {
        batchGroups[record.batchId] = []
      }
      batchGroups[record.batchId].push(record._id)
    })
    
    let successCount = 0
    let failCount = 0
    const errors = []
    
    // 按批次计算（避免重复计算同一批次）
    for (const [batchId, recordIds] of Object.entries(batchGroups)) {
      // 计算该批次的成本
      const costResult = await calculateBatchCost({ batchId }, wxContext)
      
      if (costResult.success) {
        // 批量更新该批次的所有死亡记录
        for (const recordId of recordIds) {
          try {
            await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
              .doc(recordId)
              .update({
                data: {
                  costBreakdown: costResult.data.breakdown,
                  totalCost: costResult.data.costs.total.unitCost,
                  updateTime: db.serverDate()
                }
              })
            successCount++
          } catch (err) {
            failCount++
            errors.push(`记录${recordId}: ${err.message}`)
          }
        }
      } else {
        failCount += recordIds.length
        errors.push(`批次${batchId}: ${costResult.error}`)
      }
    }
    
    return {
      success: true,
      data: {
        totalCount: deathResult.data.length,
        successCount,
        failCount,
        errors: errors.slice(0, 10) // 只返回前10个错误
      }
    }
  } catch (error) {
    console.error('[recalculateAllDeathCosts] 错误:', error)
    return {
      success: false,
      error: error.message || '批量重算死亡成本失败'
    }
  }
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'calculate_batch_cost':
      case 'calculateBatchCost':
        return await calculateBatchCost(event, wxContext)
      
      case 'calculate_treatment_cost':
        return await calculateTreatmentCost(event, wxContext)
      
      case 'calculate_batch_treatment_costs':
        return await calculateBatchTreatmentCosts(event, wxContext)
      
      case 'recalculate_death_cost':
        return await recalculateDeathCost(event, wxContext)
      
      case 'recalculate_all_death_costs':
        return await recalculateAllDeathCosts(event, wxContext)
      
      case 'sync_vaccine_costs_to_finance':
        const sync_vaccine_costs_to_finance = require('./actions/sync_vaccine_costs_to_finance')
        return await sync_vaccine_costs_to_finance.main(event, wxContext)
      
      case 'calculate_health_rate':
        // 简单的健康率计算，直接返回
        return {
          success: true,
          data: {
            message: '健康率计算已移至前端处理'
          }
        }
      
      default:
        return {
          success: false,
          error: `未知的 action: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-cost] 云函数错误:', error)
    return {
      success: false,
      error: error.message || '云函数执行失败'
    }
  }
}
