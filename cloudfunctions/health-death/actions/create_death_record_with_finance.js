/**
 * create_death_record_with_finance 处理函数
 * 创建死亡记录并关联财务（死因剖析专用）（从health-management迁移）
 * 涉及AI诊断修正、批次成本计算、财务记录创建、异常记录状态更新等
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
 * 主处理函数 - 创建死亡记录并关联财务（死因剖析专用）
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      diagnosisId,
      batchId,
      deathCount,
      deathCause,
      deathCategory = 'disease',
      autopsyFindings,
      diagnosisResult,
      images = []
    } = event
    
    const openid = wxContext.OPENID
    
    // 验证必填参数
    if (!batchId || !deathCount || deathCount <= 0) {
      throw new Error('批次ID和死亡数量不能为空')
    }
    
    // 1. 获取批次信息，计算单位成本（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    let batchDocId = batchId  // ✅ 批次文档的真实_id
    
    try {
      // 先尝试作为文档ID查询
      const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get()
      batch = batchResult.data
      batchDocId = batchId  // 文档ID就是传入的batchId
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      debugLog('批次ID查询失败，尝试通过批次号查询:', batchId)
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
        batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
        debugLog('通过批次号查询成功，批次号:', batch.batchNumber, '文档ID:', batchDocId)
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    
    // ========== 内联成本计算（避免嵌套云函数调用导致超时）==========
    const entryQuantity = batch.quantity || 0
    const currentQuantity = batch.currentQuantity || batch.currentCount || entryQuantity
    const entryUnitCost = parseFloat(batch.unitPrice) || 0
    
    if (entryUnitCost === 0) {
      throw new Error(`批次 ${batch.batchNumber} 缺少入栏单价，请先在入栏记录中补充单价`)
    }
    
    // 1. 饲养成本（饲料 + 物料）
    let breedingCostTotal = 0
    let totalFeedCount = 0
    
    try {
      const feedResult = await db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
        .where({
          batchNumber: batch.batchNumber,
          isDeleted: _.neq(true)
        })
        .limit(100)
        .get()
      
      feedResult.data.forEach(record => {
        breedingCostTotal += (Number(record.totalCost) || 0)
        totalFeedCount += (Number(record.feedCount) || Number(record.quantity) || currentQuantity)
      })
    } catch (e) {
      debugLog('[AI死因剖析] 获取饲养记录失败:', e.message)
    }
    
    if (totalFeedCount === 0) totalFeedCount = currentQuantity || 1
    const avgBreedingCost = breedingCostTotal / totalFeedCount
    
    // 2. 预防成本
    let preventionCostTotal = 0
    let totalPreventionCount = 0
    
    try {
      const preventionResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where({
          batchId: batchDocId,
          isDeleted: false
        })
        .limit(100)
        .get()
      
      preventionResult.data.forEach(record => {
        if (record.costInfo) {
          preventionCostTotal += (Number(record.costInfo.totalCost) || 0)
          totalPreventionCount += (Number(record.targetCount) || Number(record.animalCount) || currentQuantity)
        }
      })
    } catch (e) {
      debugLog('[AI死因剖析] 获取预防记录失败:', e.message)
    }
    
    if (totalPreventionCount === 0) totalPreventionCount = currentQuantity || 1
    const avgPreventionCost = preventionCostTotal / totalPreventionCount
    
    // 3. 治疗成本
    let treatmentCostTotal = 0
    let totalAffectedCount = 0
    
    try {
      const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          batchId: batchDocId
        })
        .limit(100)
        .get()
      
      treatmentResult.data.forEach(record => {
        let cost = 0
        if (record.costInfo && record.costInfo.totalCost) {
          cost = Number(record.costInfo.totalCost) || 0
        } else if (record.totalCost !== undefined) {
          cost = Number(record.totalCost) || 0
        } else if (record.amount) {
          cost = Number(record.amount) || 0
        }
        
        if (cost > 0) {
          treatmentCostTotal += cost
          totalAffectedCount += Number(record.affectedCount) || 0
        }
      })
    } catch (e) {
      debugLog('[AI死因剖析] 获取治疗记录失败:', e.message)
    }
    
    if (totalAffectedCount === 0) totalAffectedCount = currentQuantity || 1
    const avgTreatmentCost = treatmentCostTotal / totalAffectedCount
    
    // 计算单只综合成本
    const totalUnitCost = entryUnitCost + avgBreedingCost + avgPreventionCost + avgTreatmentCost
    const financeLoss = totalUnitCost * deathCount
    
    // 构建成本分解
    const costBreakdown = {
      entryUnitCost: entryUnitCost.toFixed(2),
      breedingCost: avgBreedingCost.toFixed(2),
      preventionCost: avgPreventionCost.toFixed(2),
      treatmentCost: avgTreatmentCost.toFixed(2),
      totalCost: totalUnitCost.toFixed(2)
    }
    
    debugLog('[AI死因剖析] 成本计算:', {
      deathCount,
      entryUnitCost: entryUnitCost.toFixed(2),
      breedingCost: avgBreedingCost.toFixed(2),
      preventionCost: avgPreventionCost.toFixed(2),
      treatmentCost: avgTreatmentCost.toFixed(2),
      totalUnitCost: totalUnitCost.toFixed(2),
      totalLoss: financeLoss.toFixed(2)
    })
    
    // 获取用户信息
    let userName = 'KAKA'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || 'KAKA'
      }
    } catch (userError) {
      console.error('获取用户信息失败:', userError)
    }
    
    // ✅ 获取AI诊断记录的修正状态（如果存在）
    let aiDiagnosisCorrection = null
    let finalDeathCause = deathCause  // 保存最终的死因
    if (diagnosisId) {
      try {
        const aiDiagnosisResult = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .get()
        
        if (aiDiagnosisResult.data && aiDiagnosisResult.data.isCorrected) {
          aiDiagnosisCorrection = {
            isCorrected: true,
            originalAiCause: aiDiagnosisResult.data.result?.primaryCause?.disease || aiDiagnosisResult.data.result?.primaryDiagnosis?.disease || deathCause,
            correctedCause: aiDiagnosisResult.data.correctedDiagnosis || deathCause,
            correctionReason: aiDiagnosisResult.data.correctionReason || aiDiagnosisResult.data.veterinarianDiagnosis || '',
            correctionType: aiDiagnosisResult.data.correctionType || 'veterinarian_correction',
            aiAccuracyRating: aiDiagnosisResult.data.aiAccuracyRating || 3,
            correctedBy: aiDiagnosisResult.data.correctedBy || openid,
            correctedByName: aiDiagnosisResult.data.correctedByName || userName,
            correctedAt: aiDiagnosisResult.data.correctedAt || new Date()
          }
          
          // 如果已修正，使用修正后的死因作为记录的死因
          finalDeathCause = aiDiagnosisCorrection.correctedCause
          
          debugLog('[AI死因剖析] 检测到AI诊断已修正:', {
            原始死因: aiDiagnosisCorrection.originalAiCause,
            修正死因: aiDiagnosisCorrection.correctedCause,
            修正依据: aiDiagnosisCorrection.correctionReason
          })
        }
      } catch (aiDiagnosisError) {
        console.error('获取AI诊断修正状态失败（不影响主流程）:', aiDiagnosisError)
      }
    }
    
    // 创建死亡记录
    const deathRecordData = {
      _openid: openid,
      openid: openid,
      batchId: batchId,
      batchNumber: batch.batchNumber || '',
      deathDate: new Date().toISOString().split('T')[0],
      deathCount: deathCount,
      totalDeathCount: deathCount,  // ✅ 添加标准字段
      deathCause: finalDeathCause || '待确定',  // 使用最终的死因
      deathCategory: deathCategory,
      source: 'ai_diagnosis',  // ✅ 标记来源为AI死因剖析（需要兽医确认和修正）
      disposalMethod: 'burial',
      autopsyFindings: autopsyFindings || '',
      photos: images || [],
      aiDiagnosisId: diagnosisId || null,
      diagnosisResult: diagnosisResult || null,
      // ✅ 修正：使用标准的financialLoss结构，包含完整成本分解
      financialLoss: {
        unitCost: parseFloat(totalUnitCost.toFixed(2)),  // 单只综合成本
        totalLoss: parseFloat(financeLoss.toFixed(2)),  // 总损失 = 单只综合成本 × 死亡数
        calculationMethod: 'comprehensive_cost',
        // ✅ 完整成本分解
        costBreakdown: costBreakdown
      },
      // ✅ 同时在根级别存储 costBreakdown（兼容前端读取）
      costBreakdown: costBreakdown,
      // ✅ 同步AI诊断的修正状态到死亡记录
      ...(aiDiagnosisCorrection ? {
        isCorrected: aiDiagnosisCorrection.isCorrected,
        originalAiCause: aiDiagnosisCorrection.originalAiCause,
        correctedCause: aiDiagnosisCorrection.correctedCause,
        correctionReason: aiDiagnosisCorrection.correctionReason,
        correctionType: aiDiagnosisCorrection.correctionType,
        aiAccuracyRating: aiDiagnosisCorrection.aiAccuracyRating,
        correctedBy: aiDiagnosisCorrection.correctedBy,
        correctedByName: aiDiagnosisCorrection.correctedByName,
        correctedAt: aiDiagnosisCorrection.correctedAt,
        veterinarianNote: `从AI诊断修正：${aiDiagnosisCorrection.correctionReason}`
      } : {
        isCorrected: false
      }),
      operator: openid,
      operatorName: userName,  // ✅ 使用标准字段名
      reporterName: userName,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
    
    const deathRecordResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecordData
    })
    
    const deathRecordId = deathRecordResult._id
    
    // 3. 调用财务管理云函数创建成本记录
    try {
      await cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'createDeathLossRecord',
          batchId: batchId,
          relatedRecordId: deathRecordId,
          relatedDiagnosisId: diagnosisId,
          deathCount: deathCount,
          unitCost: unitCost,
          totalLoss: financeLoss,
          deathCause: finalDeathCause,
          description: `死因剖析：${finalDeathCause}，损失${deathCount}只，单位成本${unitCost.toFixed(2)}元`
        }
      })
    } catch (financeError) {
      console.error('创建财务记录失败:', financeError)
      // 即使财务记录失败，死亡记录也已创建，继续返回成功
    }
    
    // 4. ✅ 更新原异常记录的状态为 'dead'（已死亡），从异常数中移除
    if (diagnosisId) {
      try {
        const abnormalRecordsResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            recordType: 'ai_diagnosis',
            status: 'abnormal',
            relatedDiagnosisId: diagnosisId,
            ...dbManager.buildNotDeletedCondition(true)
          })
          .get()
        
        if (abnormalRecordsResult.data && abnormalRecordsResult.data.length > 0) {
          // 批量更新所有相关异常记录的状态
          const updatePromises = abnormalRecordsResult.data.map(record => {
            return db.collection(COLLECTIONS.HEALTH_RECORDS).doc(record._id).update({
              data: {
                status: 'dead',  // ✅ 更新状态为已死亡
                relatedDeathRecordId: deathRecordId,  // 关联死亡记录
                updatedAt: new Date()
              }
            })
          })
          
          await Promise.all(updatePromises)
        }
      } catch (updateError) {
        console.error('更新异常记录状态失败（不影响主流程）:', updateError)
      }
    }
    
    // 4.1 ✅ 同步更新AI诊断记录的处理状态，避免继续计入待处理
    if (diagnosisId) {
      try {
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .update({
            data: {
              hasTreatment: true, // ✅ 标记已有处置（死亡归档）
              status: 'archived',
              resolutionType: 'death_record',
              relatedDeathRecordId: deathRecordId,
              latestTreatmentId: null,
              updatedAt: new Date()
            }
          })
      } catch (aiUpdateError) {
        console.error('[AI死因剖析] 更新诊断状态失败（不影响主流程）:', aiUpdateError)
      }
    }

    // 5. 更新批次存栏量（✅ 修复：使用批次文档ID而不是传入的batchId）
    try {
      await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchDocId)
        .update({
          data: {
            currentCount: _.inc(-deathCount),
            deadCount: _.inc(deathCount),
            updatedAt: new Date()
          }
        })
    } catch (updateError) {
      console.error('更新批次信息失败:', updateError)
    }
    
    return {
      success: true,
      data: {
        deathRecordId: deathRecordId,
        financeLoss: financeLoss,
        unitCost: unitCost
      },
      message: '死亡记录创建成功，已关联财务损失'
    }
    
  } catch (error) {
    console.error('[create_death_record_with_finance] 创建死亡记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建死亡记录失败'
    }
  }
}
