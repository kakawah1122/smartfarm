/**
 * add_treatment_medication 处理函数
 * 追加用药（扣减库存）（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，包含事务处理
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
 * 生成物资领用单据号（根据物料分类）
 * 保持原有逻辑不变
 */
function generateRecordNumber(category) {
  // 根据物料分类生成前缀（英文缩写）
  let categoryPrefix = 'MAT' // 默认物料
  if (category) {
    const categoryMap = {
      '饲料': 'FEED',
      '药品': 'MED',
      '设备': 'EQP',
      '营养品': 'NUT',
      '疫苗': 'VAC',
      '消毒剂': 'DIS',
      '耗材': 'SUP',      // 耗材 Supplies
      '其他': 'OTH'
    }
    categoryPrefix = categoryMap[category] || 'MAT'
  }
  
  // 生成6位随机数
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  
  // 格式：物资类型英文缩写-6位随机代码（如：MED-123456、FEED-789012）
  return `${categoryPrefix}-${random}`
}

/**
 * 主处理函数 - 追加用药并扣减库存
 * 保持与原health-management完全一致的逻辑，包括事务处理
 */
exports.main = async (event, wxContext) => {
  try {
    const { treatmentId, medication } = event
    const openid = wxContext.OPENID
    
    // 参数验证（保持原有验证逻辑）
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    if (!medication || !medication.materialId) {
      throw new Error('药品信息不完整')
    }
    
    const quantity = parseInt(medication.quantity)
    if (!quantity || quantity <= 0) {
      throw new Error('数量必须大于0')
    }
    
    // 获取治疗记录
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!treatmentResult.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentResult.data
    
    // 权限验证（兼容 _openid 和 createdBy 两种字段）
    if (treatment._openid !== openid && treatment.createdBy !== openid) {
      throw new Error('无权操作此治疗记录')
    }
    
    // 检查库存
    const materialResult = await db.collection(COLLECTIONS.PROD_MATERIALS)
      .doc(medication.materialId)
      .get()
    
    if (!materialResult.data) {
      throw new Error('药品不存在')
    }
    
    const material = materialResult.data
    if (material.currentStock < quantity) {
      throw new Error(`库存不足，当前库存：${material.currentStock}${material.unit}`)
    }
    
    // ✅ 计算该药品的成本
    const unitPrice = material.unitPrice || material.avgCost || 0
    const medicationCost = unitPrice * quantity
    
    // 开始事务
    const transaction = await db.startTransaction()
    
    try {
      // 1. 扣减库存
      await transaction.collection(COLLECTIONS.PROD_MATERIALS)
        .doc(medication.materialId)
        .update({
          data: {
            currentStock: _.inc(-quantity),
            updateTime: db.serverDate()
          }
        })
      
      // 2. ✅ 创建物资领用记录（主记录）
      // 生成单据号
      const recordNumber = generateRecordNumber(medication.category || '药品')
      
      const materialRecordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
        data: {
          type: 'use',  // 领用类型
          recordNumber: recordNumber,  // 添加单据号
          materialId: medication.materialId,
          materialCode: medication.materialCode || '',
          materialName: medication.name,
          category: medication.category || 'medicine',
          quantity: quantity,
          unit: medication.unit,
          recordDate: new Date().toISOString().split('T')[0],
          relatedModule: 'health_treatment',
          relatedId: treatmentId,
          notes: `治疗领用 - ${treatment.diagnosis || '待确定'} - 用法：${medication.dosage || '无'}`,
          operator: openid,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      // 3. 创建库存流水（追踪记录）
      await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
        data: {
          materialId: medication.materialId,
          recordId: materialRecordResult._id,  // ✅ 关联物资记录
          materialCode: medication.materialCode,
          materialName: medication.name,
          category: medication.category,
          operation: '治疗领用',
          operationType: '治疗领用',
          quantity: -quantity,  // 负数表示出库
          unit: medication.unit,
          beforeStock: material.currentStock,
          afterStock: material.currentStock - quantity,
          relatedModule: 'health_treatment',
          relatedId: treatmentId,
          notes: `制定治疗方案领用：${medication.name}，用法：${medication.dosage || '无'}`,
          operator: openid,
          createTime: db.serverDate()
        }
      })
      
      // 4. 添加用药记录到治疗记录
      const medicationRecord = {
        type: 'medication_added',
        medication: {
          materialId: medication.materialId,
          name: medication.name,
          quantity: quantity,
          unit: medication.unit,
          dosage: medication.dosage || '',
          category: medication.category
        },
        createdAt: new Date().toISOString(),
        createdBy: openid
      }
      
      // ✅ 更新治疗记录的累计成本
      const previousMedicationCost = Number(treatment.cost?.medication || 0)
      const baseTotalCost = Number(treatment.cost?.total || treatment.totalCost || 0)

      const updatedMedicationCost = parseFloat((previousMedicationCost + medicationCost).toFixed(2))
      const updatedTotalCost = parseFloat((baseTotalCost + medicationCost).toFixed(2))

      await transaction.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .doc(treatmentId)
        .update({
          data: {
            medications: _.push({
              materialId: medication.materialId,
              name: medication.name,
              quantity: quantity,
              unit: medication.unit,
              dosage: medication.dosage || '',
              category: medication.category
            }),
            treatmentHistory: _.push(medicationRecord),
            'cost.medication': updatedMedicationCost,
            'cost.total': updatedTotalCost,
            totalCost: updatedTotalCost,  // 兼容字段
            updateTime: db.serverDate()
          }
        })
      
      // 提交事务
      await transaction.commit()
      
      // 返回结果（保持与原函数完全一致的返回格式）
      return {
        success: true,
        message: '用药追加成功，库存已扣减'
      }
    } catch (error) {
      // 回滚事务
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error('[add_treatment_medication] 追加用药失败:', error)
    return {
      success: false,
      error: error.message,
      message: '追加用药失败'
    }
  }
}
