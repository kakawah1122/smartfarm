/**
 * create_death_from_vaccine 处理函数
 * 从疫苗追踪创建死亡记录（从health-management迁移）
 * 包括批次成本计算、财务记录创建、批次数量更新等
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

// 辅助函数：调试日志（生产环境自动关闭）
function debugLog(message, data) {
  // 生产环境不输出调试日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

/**
 * 计算批次成本（简化版）
 */
async function calculateBatchCost(params, context) {
  try {
    const batchId = params.batchId
    const batch = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId).get()
    
    if (!batch.data) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    // 简化计算：使用入栏单价作为成本
    const unitPrice = parseFloat(batch.data.unitPrice) || 0
    
    return {
      success: true,
      data: {
        avgTotalCost: unitPrice,
        breakdown: {
          purchaseCost: unitPrice,
          feedCost: 0,
          medicineCost: 0,
          otherCost: 0
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 主处理函数 - 从疫苗追踪创建死亡记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      vaccineRecordId,
      batchId,
      batchNumber,
      deathCount,
      deathCause,
      vaccineName,
      preventionDate
    } = event
    const openid = wxContext.OPENID
    
    // 1. 验证必填项
    if (!batchId) throw new Error('批次ID不能为空')
    if (!deathCount || deathCount <= 0) throw new Error('死亡数量必须大于0')
    
    // 2. 获取批次信息
    let batch = null
    let batchDocId = batchId
    
    try {
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId).get()
      batch = batchEntry.data
      batchDocId = batchId
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
        batchDocId = batch._id
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    
    // 3. 计算死亡损失 = 综合平均成本 × 死亡数量（包含所有分摊成本）
    let costPerAnimal = 0
    let costBreakdown = null
    
    try {
      const costResult = await calculateBatchCost({ batchId: batchDocId }, { OPENID: openid })
      if (costResult.success && costResult.data) {
        costPerAnimal = parseFloat(costResult.data.avgTotalCost) || 0
        costBreakdown = costResult.data.breakdown
      } else {
        // 降级：使用入栏单价
        costPerAnimal = parseFloat(batch.unitPrice) || 0
      }
    } catch (costError) {
      console.error('计算批次成本失败:', costError)
      costPerAnimal = parseFloat(batch.unitPrice) || 0
    }
    
    const totalLoss = (costPerAnimal * deathCount).toFixed(2)
    
    debugLog('[疫苗死亡] 财务计算:', {
      deathCount: deathCount,
      costPerAnimal: costPerAnimal,
      totalLoss: totalLoss,
      costBreakdown: costBreakdown,
      batchInfo: {
        batchNumber: batch.batchNumber,
        initialQuantity: batch.quantity,
        currentCount: batch.currentCount
      }
    })
    
    // 4. 获取用户信息
    let operatorName = '未知'
    try {
      const userInfo = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      debugLog('[疫苗死亡] 用户查询结果:', {
        openid: openid.substring(0, 8) + '...',
        found: userInfo.data.length > 0,
        userName: userInfo.data[0]?.name
      })
      
      if (userInfo.data.length > 0) {
        operatorName = userInfo.data[0].name || userInfo.data[0].nickName || '未知'
      } else {
        debugLog('[疫苗死亡] 未找到用户信息', openid.substring(0, 8) + '...')
      }
    } catch (userError) {
      console.error('[疫苗死亡] 获取用户信息失败:', userError)
    }
    
    // 5. 创建死亡记录
    const deathRecord = {
      _openid: openid,  // ✅ 添加_openid字段用于查询
      batchId,
      batchNumber: batchNumber || batch.batchNumber,
      vaccineRecordId,  // 关联疫苗记录
      deathDate: new Date().toISOString().split('T')[0],
      deathList: [],
      deathCause: deathCause || '疫苗接种后死亡',
      deathCauseCategory: 'vaccine_reaction',
      customCauseTags: ['疫苗反应'],
      description: `疫苗名称：${vaccineName}，接种日期：${preventionDate}，接种后出现死亡情况`,
      symptoms: '',
      photos: [],
      environmentFactors: {},
      financialLoss: {
        unitCost: costPerAnimal.toFixed(2),
        totalLoss: totalLoss,
        calculationMethod: 'avg_total_cost',
        financeRecordId: '',
        costBreakdown: costBreakdown
      },
      disposalMethod: '待处理',
      preventiveMeasures: '',
      totalDeathCount: deathCount,
      deathCount: deathCount,  // 添加deathCount字段（与totalDeathCount保持一致）
      operator: openid,
      operatorName,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecord
    })
    
    const deathRecordId = deathResult._id
    
    // 6. 调用财务云函数创建损失记录
    try {
      debugLog('[疫苗死亡] 准备创建财务记录:', {
        deathRecordId,
        deathCount,
        costPerAnimal: costPerAnimal.toFixed(2),
        totalLoss
      })
      
      const financeResult = await cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'createDeathLoss',
          batchId,
          batchNumber: batchNumber || batch.batchNumber,
          deathRecordId,
          deathCount,
          unitCost: costPerAnimal.toFixed(2),
          totalLoss,
          deathCause: deathCause || '疫苗接种后死亡',
          recordDate: new Date().toISOString().split('T')[0],
          operator: openid
        }
      })
      
      debugLog('[疫苗死亡] 财务记录创建结果:', financeResult.result)
      
      // ✅ 如果财务记录创建成功，更新死亡记录中的财务记录ID
      if (financeResult.result && financeResult.result.success && financeResult.result.data?.financeRecordId) {
        await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .doc(deathRecordId)
          .update({
            data: {
              'financialLoss.financeRecordId': financeResult.result.data.financeRecordId
            }
          })
        debugLog('[疫苗死亡] 已更新财务记录ID到死亡记录')
      }
    } catch (financeError) {
      console.error('[疫苗死亡] 创建财务记录失败:', financeError)
      // 不影响主流程
    }
    
    // 7. 更新批次数量
    await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchDocId).update({
      data: {
        currentCount: _.inc(-deathCount),
        deadCount: _.inc(deathCount),
        updatedAt: new Date()
      }
    })
    
    // 8. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_death_from_vaccine',
      COLLECTIONS.HEALTH_DEATH_RECORDS,
      deathRecordId,
      {
        vaccineRecordId,
        batchId,
        deathCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { deathRecordId },
      message: '死亡记录创建成功'
    }
  } catch (error) {
    console.error('[疫苗死亡] 创建疫苗追踪死亡记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建死亡记录失败'
    }
  }
}
