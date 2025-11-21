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
    let feedCount = 0
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
      feedCount++
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
    
    // 3. 预防成本
    let preventionCost = 0
    let preventionCount = 0
    
    const preventionResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    preventionResult.data.forEach(record => {
      if (record.costInfo) {
        preventionCost += (Number(record.costInfo.totalCost) || 0)
        preventionCount++
      }
    })
    
    // 4. 治疗成本
    let treatmentCost = 0
    let treatmentCount = 0
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    treatmentResult.data.forEach(record => {
      if (record.costInfo) {
        treatmentCost += (Number(record.costInfo.totalCost) || 0)
        treatmentCount++
      }
    })
    
    // 计算平均成本（基于当前存栏数）
    const avgBreedingCost = currentQuantity > 0 ? breedingCost / currentQuantity : 0
    const avgPreventionCost = currentQuantity > 0 ? preventionCost / currentQuantity : 0
    const avgTreatmentCost = currentQuantity > 0 ? treatmentCost / currentQuantity : 0
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
            feedCount,
            materialCount
          },
          prevention: {
            unitCost: avgPreventionCost.toFixed(2),
            totalCost: preventionCost.toFixed(2),
            count: preventionCount
          },
          treatment: {
            unitCost: avgTreatmentCost.toFixed(2),
            totalCost: treatmentCost.toFixed(2),
            count: treatmentCount
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
    
    // 构建查询条件
    let conditions = {
      isDeleted: false
    }
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    // 移除openid限制，统计所有用户的治疗记录
    // else {
    //   conditions._openid = wxContext.OPENID
    // }
    
    if (dateRange && dateRange.start && dateRange.end) {
      conditions.createTime = _.and(_.gte(new Date(dateRange.start)), _.lte(new Date(dateRange.end)))
    }
    
    // 查询治疗记录
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(conditions)
      .get()
    
    let totalCost = 0
    let treatmentCount = 0
    let medicationCost = 0
    let veterinaryCost = 0
    let otherCost = 0
    
    result.data.forEach(record => {
      // 兼容两种数据结构
      let cost = 0
      
      // 1. 优先从 costInfo.totalCost 获取（新结构）
      if (record.costInfo && record.costInfo.totalCost) {
        cost = Number(record.costInfo.totalCost) || 0
        medicationCost += Number(record.costInfo.medicationCost) || 0
        veterinaryCost += Number(record.costInfo.veterinaryCost) || 0
        otherCost += Number(record.costInfo.otherCost) || 0
      } 
      // 2. 如果没有costInfo，从amount字段获取（旧结构）
      else if (record.amount) {
        cost = Number(record.amount) || 0
        // 根据category判断成本类型
        if (record.category === 'medication' || record.category === 'vaccine') {
          medicationCost += cost
        }
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
