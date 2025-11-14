// 修复治疗记录中错误的成本数据
// 用于清理使用旧逻辑创建的错误放大成本记录

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

async function fixTreatmentCostRecords() {
  console.log('🔍 开始检查治疗记录中的异常成本数据...')
  
  try {
    // 1. 查询所有治疗记录
    const result = await db.collection('health_treatment_records')
      .where({
        isDeleted: _.neq(true)
      })
      .get()
    
    console.log(`📊 共找到 ${result.data.length} 条治疗记录`)
    
    let suspiciousRecords = []
    let fixedCount = 0
    
    for (const record of result.data) {
      const totalCost = record.cost?.total || record.totalCost || 0
      const medicationCost = record.cost?.medication || 0
      
      // 检查是否存在异常的高成本（可能是放大后的结果）
      // 33366.67 这个数字表明可能存在 100 * 333.67 这样的放大
      const isSuspicious = totalCost > 10000 || medicationCost > 10000
      
      if (isSuspicious) {
        suspiciousRecords.push({
          _id: record._id,
          batchId: record.batchId,
          totalCost: totalCost,
          medicationCost: medicationCost,
          medications: record.medications || [],
          createdAt: record.createdAt,
          _openid: record._openid
        })
        
        console.log(`⚠️  发现异常记录: ${record._id}`)
        console.log(`   - 总成本: ${totalCost}`)
        console.log(`   - 药品成本: ${medicationCost}`)
        console.log(`   - 用药记录: ${record.medications?.length || 0} 条`)
        console.log(`   - 创建时间: ${record.createdAt}`)
      }
    }
    
    console.log(`\n🔍 检查完成，发现 ${suspiciousRecords.length} 条可疑记录`)
    
    if (suspiciousRecords.length > 0) {
      console.log('\n📋 可疑记录详情:')
      suspiciousRecords.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record._id}`)
        console.log(`   批次: ${record.batchId}`)
        console.log(`   总成本: ¥${record.totalCost}`)
        console.log(`   药品成本: ¥${record.medicationCost}`)
        console.log(`   用药数量: ${record.medications.length}`)
        console.log(`   创建者: ${record._openid}`)
        console.log('')
      })
      
      // 这里可以添加自动修复逻辑，但建议先手动检查
      console.log('⚠️  建议手动检查这些记录，确认是否需要修复')
      console.log('💡 如果确认需要修复，可以基于实际用药记录重新计算成本')
    }
    
    return {
      success: true,
      totalRecords: result.data.length,
      suspiciousCount: suspiciousRecords.length,
      suspiciousRecords: suspiciousRecords
    }
    
  } catch (error) {
    console.error('❌ 检查治疗记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 修复单条记录的成本（基于实际用药重新计算）
async function fixSingleRecord(recordId) {
  try {
    console.log(`🔧 开始修复记录: ${recordId}`)
    
    const recordResult = await db.collection('health_treatment_records')
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    const record = recordResult.data
    const medications = record.medications || []
    
    if (medications.length === 0) {
      console.log('⚠️  该记录没有用药信息，无法重新计算成本')
      return { success: false, message: '无用药信息' }
    }
    
    // 基于用药记录重新计算成本
    let totalMedicationCost = 0
    
    for (const med of medications) {
      // 查询药品信息获取单价
      const materialResult = await db.collection('prod_materials')
        .doc(med.materialId)
        .get()
      
      if (materialResult.data) {
        const unitPrice = materialResult.data.unitPrice || materialResult.data.avgCost || 0
        const medCost = unitPrice * (med.quantity || 0)
        totalMedicationCost += medCost
        
        console.log(`   - ${med.name}: ${med.quantity} × ¥${unitPrice} = ¥${medCost}`)
      }
    }
    
    console.log(`📊 重新计算的总成本: ¥${totalMedicationCost}`)
    console.log(`📊 原记录成本: ¥${record.cost?.total || record.totalCost || 0}`)
    
    // 更新记录
    await db.collection('health_treatment_records')
      .doc(recordId)
      .update({
        data: {
          'cost.medication': parseFloat(totalMedicationCost.toFixed(2)),
          'cost.total': parseFloat(totalMedicationCost.toFixed(2)),
          totalCost: parseFloat(totalMedicationCost.toFixed(2)),
          fixedAt: new Date(),
          fixedBy: 'cost-fix-script'
        }
      })
    
    console.log('✅ 记录修复完成')
    
    return {
      success: true,
      oldCost: record.cost?.total || record.totalCost || 0,
      newCost: totalMedicationCost
    }
    
  } catch (error) {
    console.error(`❌ 修复记录 ${recordId} 失败:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出函数
module.exports = {
  fixTreatmentCostRecords,
  fixSingleRecord
}

// 如果直接运行此脚本
if (require.main === module) {
  fixTreatmentCostRecords()
    .then(result => {
      console.log('\n✅ 检查完成:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ 检查失败:', error)
      process.exit(1)
    })
}
