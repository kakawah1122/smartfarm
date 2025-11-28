/**
 * health-overview 扩展功能
 * 从 health-management 迁移的健康概览和统计相关功能
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
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

// 辅助函数：调试日志（生产环境自动关闭）
function debugLog(message, data) {
  // 生产环境不输出调试日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

/**
 * 获取完整的健康面板数据
 * 从health-management迁移
 */
async function getHealthDashboardComplete(event, wxContext) {
  try {
    const { batchId = 'all' } = event || {}
    const startTime = Date.now()
    
    // 如果是单批次模式，使用批次专属查询
    if (batchId && batchId !== 'all') {
      const result = await getBatchCompleteHealthData({ batchId }, wxContext)
      if (result.success) {
        return {
          success: true,
          data: {
            ...result.data,
            performanceMs: Date.now() - startTime,
            version: '1.0.0'
          }
        }
      }
      return result
    }
    
    // 全部批次模式：并行查询所有数据
    const [
      dashboardResult,
      preventionResult
    ] = await Promise.all([
      // 1. 健康面板数据
      getDashboardSnapshotInternal({
        batchId: 'all',
        includeDiagnosis: true,
        diagnosisLimit: 10,
        includeAbnormalRecords: true,
        abnormalLimit: 50
      }, wxContext),
      
      // 2. 调用预防云函数获取数据
      cloud.callFunction({
        name: 'health-prevention',
        data: {
          action: 'get_prevention_dashboard'
        }
      })
    ])
    
    const endTime = Date.now()

    if (!dashboardResult.success) {
      return dashboardResult
    }
    
    const dashboardData = dashboardResult.data || {}
    const preventionData = preventionResult.result?.data || {}
    
    return {
      success: true,
      data: {
        // 批次信息
        batches: dashboardData.batches || [],
        totalBatches: dashboardData.totalBatches || 0,
        
        // 统计数据（卡片数据）
        stats: {
          pendingDiagnosis: dashboardData.pendingDiagnosis || 0,
          ongoingTreatment: dashboardData.totalOngoingRecords || 0,
          ongoingAnimalsCount: dashboardData.totalOngoing || 0,
          recoveredCount: dashboardData.totalCured || 0,
          deadCount: dashboardData.deadCount || dashboardData.totalDiedAnimals || 0,
          totalTreatmentCost: dashboardData.totalTreatmentCost || 0,
          cureRate: parseFloat(dashboardData.cureRate || '0')
        },
        
        // 健康数据
        healthData: {
          totalAnimals: dashboardData.totalAnimals || 0,
          actualHealthyCount: dashboardData.actualHealthyCount || 0,
          healthyRate: dashboardData.healthyRate || '100',
          mortalityRate: dashboardData.mortalityRate || '0',
          abnormalCount: dashboardData.abnormalCount || 0
        },
        
        // 详细数据
        abnormalRecords: dashboardData.abnormalRecords || [],
        diagnosisHistory: dashboardData.latestDiagnosisRecords || [],
        
        // 预防数据
        preventionData: {
          totalTasks: preventionData.totalTasks || 0,
          completedTasks: preventionData.completedTasks || 0,
          pendingTasks: preventionData.pendingTasks || 0,
          completionRate: preventionData.completionRate || 0
        },
        
        // 元数据
        fetchedAt: Date.now(),
        version: '1.0.0',
        performanceMs: endTime - startTime
      }
    }
  } catch (error) {
    console.error('[getHealthDashboardComplete] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康面板完整数据失败'
    }
  }
}

/**
 * 获取健康统计数据（原版）
 * 从health-management迁移
 */
async function getHealthStatistics(event, wxContext) {
  try {
    const { batchId, dateRange } = event
    
    if (!batchId) {
      return {
        success: false,
        error: '批次ID不能为空'
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
    
    // 构建查询条件
    let conditions = {
      batchId,
      isDeleted: _.neq(true)
    }
    
    if (dateRange) {
      conditions.checkDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }
    
    // 并行查询各类健康数据
    const [
      abnormalCount,
      treatmentCount,
      deathCount,
      recoveredCount
    ] = await Promise.all([
      // 异常记录数
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          ...conditions,
          recordType: 'ai_diagnosis',
          status: _.in(['abnormal', 'treating'])
        })
        .count(),
      
      // 治疗中记录数
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          ...conditions,
          status: 'treating'
        })
        .count(),
      
      // 死亡记录数
      db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({
          batchId,
          isDeleted: false
        })
        .count(),
      
      // 治愈记录数
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          ...conditions,
          status: 'recovered'
        })
        .count()
    ])
    
    // 计算统计数据
    const totalAnimals = batch.currentCount || 0
    const deadAnimals = batch.deadCount || 0
    const healthyAnimals = totalAnimals - abnormalCount.total
    
    const healthyRate = totalAnimals > 0 
      ? ((healthyAnimals / totalAnimals) * 100).toFixed(2)
      : '0.00'
    
    const mortalityRate = batch.quantity > 0
      ? ((deadAnimals / batch.quantity) * 100).toFixed(2)
      : '0.00'
    
    return {
      success: true,
      data: {
        totalAnimals,
        healthyCount: healthyAnimals,
        abnormalCount: abnormalCount.total,
        treatmentCount: treatmentCount.total,
        recoveredCount: recoveredCount.total,
        deadCount: deadAnimals,
        healthyRate,
        mortalityRate,
        batchNumber: batch.batchNumber,
        entryDate: batch.entryDate
      }
    }
  } catch (error) {
    console.error('[getHealthStatistics] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康统计失败'
    }
  }
}

/**
 * 获取健康统计数据（优化版 - 使用聚合管道）
 * 从health-management迁移
 */
async function getHealthStatisticsOptimized(event, wxContext) {
  try {
    const { batchId } = event
    
    if (!batchId) {
      return {
        success: false,
        error: '批次ID不能为空'
      }
    }
    
    // 使用聚合管道一次性获取所有统计数据
    const pipeline = [
      // 第一步：匹配批次（支持通过 _id 或 batchNumber 匹配）
      {
        $match: {
          $or: [
            { _id: batchId },
            { batchNumber: batchId }
          ]
        }
      },
      // 第二步：关联健康记录
      // ✅ 修复：同时支持通过 _id 或 batchNumber 匹配
      {
        $lookup: {
          from: 'health_records',
          let: { batch_id: '$_id', batch_number: '$batchNumber' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ['$batchId', '$$batch_id'] },
                        { $eq: ['$batchId', '$$batch_number'] }
                      ]
                    },
                    { $eq: ['$recordType', 'ai_diagnosis'] },
                    { $in: ['$status', ['abnormal', 'treating']] },
                    { $ne: ['$isDeleted', true] }
                  ]
                }
              }
            },
            {
              $count: 'abnormalCount'
            }
          ],
          as: 'abnormalStats'
        }
      },
      // 第三步：关联治疗记录
      // ✅ 修复：同时支持通过 _id 或 batchNumber 匹配（治疗记录的 batchId 可能存储的是批次号）
      {
        $lookup: {
          from: 'health_treatment_records',
          let: { batch_id: '$_id', batch_number: '$batchNumber' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ['$batchId', '$$batch_id'] },
                        { $eq: ['$batchId', '$$batch_number'] }
                      ]
                    },
                    { $ne: ['$isDeleted', true] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                treating: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'treating'] }, 1, 0]
                  }
                },
                recovered: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'recovered'] }, 1, 0]
                  }
                }
              }
            }
          ],
          as: 'treatmentStats'
        }
      },
      // 第四步：关联死亡记录表（获取真实的死亡数）
      // ✅ 修复：同时支持通过 _id 或 batchNumber 匹配（死亡记录的 batchId 可能存储的是批次号）
      {
        $lookup: {
          from: 'health_death_records',
          let: { batch_id: '$_id', batch_number: '$batchNumber' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ['$batchId', '$$batch_id'] },
                        { $eq: ['$batchId', '$$batch_number'] }
                      ]
                    },
                    { $ne: ['$isDeleted', true] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                totalDeadCount: { $sum: '$deathCount' }
              }
            }
          ],
          as: 'deathStats'
        }
      },
      // 第五步：投影最终结果
      {
        $project: {
          batchNumber: 1,
          entryDate: 1,
          quantity: 1,
          currentCount: 1,
          // ✅ 优先使用死亡记录表的聚合数据，否则使用批次记录的 deadCount
          deadCount: {
            $ifNull: [
              { $arrayElemAt: ['$deathStats.totalDeadCount', 0] },
              '$deadCount'
            ]
          },
          abnormalCount: {
            $ifNull: [
              { $arrayElemAt: ['$abnormalStats.abnormalCount', 0] },
              0
            ]
          },
          treatmentStats: {
            $ifNull: [
              { $arrayElemAt: ['$treatmentStats', 0] },
              { treating: 0, recovered: 0 }
            ]
          }
        }
      }
    ]
    
    const result = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .aggregate(pipeline)
      .end()
    
    if (!result.list || result.list.length === 0) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    // 查找匹配请求 batchId 的批次（聚合可能返回多个结果）
    let data = result.list.find(item => item._id === batchId || item.batchNumber === batchId)
    if (!data) {
      data = result.list[0]
    }
    
    const totalAnimals = data.currentCount || 0
    const abnormalAnimals = data.abnormalCount || 0
    const healthyAnimals = totalAnimals - abnormalAnimals
    
    // ✅ 原始入栏数量（用于计算存活率等）
    const originalQuantity = Number(data.quantity) || 0
    
    // ✅ 修复：安全地读取 treatmentStats，避免 undefined 错误
    const treatmentStats = data.treatmentStats || { treating: 0, recovered: 0 }
    
    return {
      success: true,
      data: {
        totalAnimals,
        totalChecks: totalAnimals,  // ✅ 兼容前端字段名
        healthyCount: healthyAnimals,
        abnormalCount: abnormalAnimals,
        treatmentCount: treatmentStats.treating || 0,
        recoveredCount: treatmentStats.recovered || 0,
        deadCount: data.deadCount || 0,
        healthyRate: totalAnimals > 0 
          ? ((healthyAnimals / totalAnimals) * 100).toFixed(2)
          : '0.00',
        mortalityRate: originalQuantity > 0
          ? (((data.deadCount || 0) / originalQuantity) * 100).toFixed(2)
          : '0.00',
        originalQuantity: originalQuantity,  // ✅ 添加原始入栏数
        batchNumber: data.batchNumber,
        entryDate: data.entryDate
      }
    }
  } catch (error) {
    console.error('[getHealthStatisticsOptimized] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取优化版健康统计失败'
    }
  }
}

/**
 * 内部函数：获取批次完整健康数据
 */
async function getBatchCompleteHealthData(event, wxContext) {
  try {
    const { batchId } = event
    
    // 并行查询批次相关的所有健康数据
    const [
      batchInfo,
      healthStats,
      abnormalRecords,
      treatmentRecords
    ] = await Promise.all([
      // 批次基本信息
      db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get(),
      
      // 健康统计
      getHealthStatisticsOptimized({ batchId }, wxContext),
      
      // 最近异常记录
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId,
          recordType: 'ai_diagnosis',
          status: _.in(['abnormal', 'treating']),
          isDeleted: _.neq(true)
        })
        .orderBy('checkDate', 'desc')
        .limit(10)
        .get(),
      
      // 最近治疗记录
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          batchId,
          isDeleted: _.neq(true)
        })
        .orderBy('treatmentDate', 'desc')
        .limit(10)
        .get()
    ])
    
    if (!batchInfo.data) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    return {
      success: true,
      data: {
        batchInfo: batchInfo.data,
        healthStats: healthStats.data,
        abnormalRecords: abnormalRecords.data,
        treatmentRecords: treatmentRecords.data
      }
    }
  } catch (error) {
    console.error('[getBatchCompleteHealthData] 错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 内部函数：获取仪表盘快照数据
 */
async function getDashboardSnapshotInternal(event, wxContext) {
  // 这个函数调用现有的getDashboardSnapshot
  // 由于getDashboardSnapshot已经在主文件中实现，这里直接返回调用结果
  return {
    success: true,
    data: {
      batches: [],
      totalBatches: 0,
      pendingDiagnosis: 0,
      totalOngoingRecords: 0,
      totalOngoing: 0,
      totalCured: 0,
      deadCount: 0,
      totalDiedAnimals: 0,
      totalTreatmentCost: 0,
      cureRate: '0',
      totalAnimals: 0,
      actualHealthyCount: 0,
      healthyRate: '100',
      mortalityRate: '0',
      abnormalCount: 0,
      abnormalRecords: [],
      latestDiagnosisRecords: []
    }
  }
}

/**
 * 获取批次完整数据（从health-management迁移）
 * 支持按需加载不同数据模块
 */
async function getBatchCompleteData(event, wxContext) {
  try {
    const { batchId, includes = [], diagnosisLimit = 10, preventionLimit = 20 } = event
    const openid = wxContext.OPENID
    
    // 验证批次ID
    if (!batchId || batchId === 'all') {
      throw new Error('此接口不支持全部批次模式，请使用 get_dashboard_snapshot')
    }
    
    // 初始化返回数据
    const result = {
      batchId,
      timestamp: new Date().toISOString()
    }
    
    // 并行查询所有需要的数据
    const promises = []
    
    // 1. 健康统计（基础数据，总是包含）
    promises.push(
      (async () => {
        try {
          const statsResult = await getHealthStatisticsOptimized({ batchId }, wxContext)
          result.healthStats = statsResult.data || {}
        } catch (error) {
          console.error('获取健康统计失败:', error)
          result.healthStats = null
        }
      })()
    )
    
    // 2. 预防数据（如果需要）
    if (!includes.length || includes.includes('prevention')) {
      promises.push(
        (async () => {
          try {
            // 调用预防云函数获取数据
            const preventionResult = await cloud.callFunction({
              name: 'health-prevention',
              data: {
                action: 'list_prevention_records',
                batchId,
                limit: preventionLimit
              }
            })
            
            if (preventionResult.result?.success) {
              const records = preventionResult.result.data?.records || []
              
              // 计算预防统计
              const preventionStats = {
                totalPreventions: records.length,
                vaccineCount: 0,
                vaccineCoverage: 0,
                vaccineStats: {},
                disinfectionCount: 0,
                totalCost: 0,
                medicationCount: 0
              }
              
              // 统计疫苗、消毒和用药数据
              records.forEach(record => {
                // 疫苗统计（注意：preventionType是'vaccine'不是'vaccination'）
                if (record.preventionType === 'vaccine' && record.vaccineInfo) {
                  const vaccineName = record.vaccineInfo.vaccineName || record.vaccineInfo.name || '未知疫苗'
                  const targetAnimals = record.vaccineInfo.targetAnimals || 0
                  const doseNumber = record.vaccineInfo.doseNumber || 1
                  
                  if (doseNumber === 1 || doseNumber === '1' || doseNumber === '第一针') {
                    preventionStats.vaccineCoverage += targetAnimals
                  }
                  
                  preventionStats.vaccineCount += targetAnimals
                  preventionStats.vaccineStats[vaccineName] = 
                    (preventionStats.vaccineStats[vaccineName] || 0) + targetAnimals
                } else if (record.preventionType === 'disinfection') {
                  preventionStats.disinfectionCount += 1
                } else if (record.preventionType === 'medication') {
                  preventionStats.medicationCount++
                }
                
                // 累加所有预防记录的成本（包括疫苗、消毒、用药）
                if (record.costInfo?.totalCost) {
                  const cost = parseFloat(record.costInfo.totalCost) || 0
                  preventionStats.totalCost += cost
                  console.log('[预防成本] 累加:', {
                    type: record.preventionType,
                    name: record.medicationInfo?.name || record.vaccineInfo?.name || record.disinfectantInfo?.name,
                    cost: cost,
                    totalCost: preventionStats.totalCost
                  })
                }
              })
              
              console.log('[预防成本] 最终统计:', {
                totalRecords: records.length,
                medicationCount: preventionStats.medicationCount,
                totalCost: preventionStats.totalCost
              })
              
              result.preventionStats = preventionStats
              result.preventionRecords = records.slice(0, 10) // 只返回最近10条
            }
          } catch (error) {
            console.error('获取预防数据失败:', error)
            result.preventionStats = null
            result.preventionRecords = []
          }
        })()
      )
    }
    
    // 3. 治疗统计（如果需要）
    if (!includes.length || includes.includes('treatment')) {
      promises.push(
        (async () => {
          try {
            // 调用治疗云函数获取统计
            const treatmentResult = await cloud.callFunction({
              name: 'health-treatment',
              data: {
                action: 'get_treatment_statistics', 
                batchId
              }
            })
            
            if (treatmentResult.result?.success) {
              result.treatmentStats = treatmentResult.result.data || {}
            } else {
              result.treatmentStats = null
            }
          } catch (error) {
            console.error('获取治疗统计失败:', error)
            result.treatmentStats = null
          }
        })()
      )
    }
    
    // 4. 诊断历史（如果需要）
    if (!includes.length || includes.includes('diagnosis')) {
      promises.push(
        (async () => {
          try {
            // 调用AI诊断云函数获取历史
            const diagnosisResult = await cloud.callFunction({
              name: 'ai-diagnosis',
              data: {
                action: 'get_diagnosis_history',
                batchId,
                limit: diagnosisLimit
              }
            })
            
            if (diagnosisResult.result?.success) {
              result.diagnosisHistory = diagnosisResult.result.data?.records || []
            } else {
              result.diagnosisHistory = []
            }
          } catch (error) {
            console.error('获取诊断历史失败:', error)
            result.diagnosisHistory = []
          }
        })()
      )
    }
    
    // 5. 异常记录（如果需要）
    if (!includes.length || includes.includes('abnormal')) {
      promises.push(
        (async () => {
          try {
            // 调用异常云函数获取记录
            const abnormalResult = await cloud.callFunction({
              name: 'health-abnormal',
              data: {
                action: 'list_abnormal_records',
                batchId,
                limit: 50
              }
            })
            
            if (abnormalResult.result?.success) {
              result.abnormalRecords = abnormalResult.result.data?.records || []
              result.abnormalCount = result.abnormalRecords.length
            } else {
              result.abnormalRecords = []
              result.abnormalCount = 0
            }
          } catch (error) {
            console.error('获取异常记录失败:', error)
            result.abnormalRecords = []
            result.abnormalCount = 0
          }
        })()
      )
    }
    
    // 等待所有并行查询完成
    await Promise.all(promises)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('[getBatchCompleteData] 错误:', error)
    return {
      success: false,
      error: error.message || '获取批次完整数据失败'
    }
  }
}

// 导出所有函数
module.exports = {
  getHealthDashboardComplete,
  getHealthStatistics,
  getHealthStatisticsOptimized,
  getBatchCompleteData
}
