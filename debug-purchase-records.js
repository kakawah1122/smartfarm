// 调试采购记录同步到财务管理的问题
// 检查最近的采购记录是否正确创建和显示

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 集合配置
const COLLECTIONS = {
  PROD_MATERIAL_RECORDS: 'prod_material_records',
  PROD_MATERIALS: 'prod_materials',
  FINANCE_COST_RECORDS: 'finance_cost_records'
}

async function debugPurchaseRecords() {
  console.log('=== 开始调试采购记录同步问题 ===')
  
  try {
    // 1. 查询最近的采购记录
    console.log('\n1. 查询最近的采购记录...')
    const recentPurchases = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where({
        type: 'purchase'
      })
      .orderBy('createTime', 'desc')
      .limit(5)
      .get()
    
    console.log(`找到 ${recentPurchases.data.length} 条采购记录:`)
    recentPurchases.data.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record._id}`)
      console.log(`     物料ID: ${record.materialId}`)
      console.log(`     类型: ${record.type}`)
      console.log(`     数量: ${record.quantity}`)
      console.log(`     单价: ${record.unitPrice}`)
      console.log(`     总金额: ${record.totalAmount}`)
      console.log(`     供应商: ${record.supplier}`)
      console.log(`     记录日期: ${record.recordDate}`)
      console.log(`     创建时间: ${record.createTime}`)
      console.log(`     关联批次: ${record.relatedBatch}`)
      console.log('     ---')
    })
    
    // 2. 检查对应的物料信息
    console.log('\n2. 检查对应的物料信息...')
    for (const record of recentPurchases.data) {
      if (record.materialId) {
        try {
          const material = await db.collection(COLLECTIONS.PROD_MATERIALS)
            .doc(record.materialId)
            .get()
          
          if (material.data) {
            console.log(`  物料 ${record.materialId}:`)
            console.log(`    名称: ${material.data.name}`)
            console.log(`    分类: ${material.data.category}`)
            console.log(`    单价: ${material.data.unitPrice}`)
            console.log(`    供应商: ${material.data.supplier}`)
          } else {
            console.log(`  物料 ${record.materialId}: 未找到`)
          }
        } catch (error) {
          console.log(`  物料 ${record.materialId}: 查询失败 - ${error.message}`)
        }
      }
    }
    
    // 3. 模拟财务记录查询逻辑
    console.log('\n3. 模拟财务记录查询逻辑...')
    const purchaseConditions = [
      { type: 'purchase' },
      { status: _.neq('deleted') }
    ]
    
    const purchaseResult = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where(_.and(purchaseConditions))
      .orderBy('createTime', 'desc')
      .limit(10)
      .get()
    
    console.log(`财务查询找到 ${purchaseResult.data.length} 条采购记录`)
    
    // 转换为财务记录格式
    const financeRecords = []
    for (const record of purchaseResult.data) {
      let costType = 'other'
      let materialName = record.materialName || '物料'
      
      if (record.materialId) {
        try {
          const material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(record.materialId).get()
          if (material.data) {
            materialName = material.data.name || material.data.materialName || materialName
            const category = material.data.category || material.data.type || ''
            if (category === '饲料') {
              costType = 'feed'
            } else if (category === '药品' || category === 'medicine' || category === '营养品') {
              costType = 'health'
            }
          }
        } catch (e) {
          console.log(`    查询物料失败: ${e.message}`)
        }
      } else if (record.category) {
        const category = record.category
        if (category === '饲料') {
          costType = 'feed'
        } else if (category === '药品' || category === 'medicine' || category === '营养品') {
          costType = 'health'
        }
      }
      
      // 计算总金额
      let amount = record.totalAmount || 0
      if (amount === 0 && record.quantity && record.unitPrice) {
        amount = Number(record.quantity) * Number(record.unitPrice)
      }
      
      financeRecords.push({
        id: `purchase_${record._id}`,
        type: 'expense',
        source: 'purchase',
        costType: costType,
        amount: amount,
        description: `${costType === 'health' ? '药品' : costType === 'feed' ? '饲料' : '物料'}采购 - ${materialName} - ${record.supplier || '供应商'} - ${record.quantity || 0}${record.unit || '件'}`,
        date: record.recordDate || record.createTime,
        createTime: record.createTime,
        status: 'confirmed',
        relatedRecordId: record._id,
        batchId: record.relatedBatch,
        rawRecord: record
      })
    }
    
    console.log('\n转换后的财务记录:')
    financeRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.description}`)
      console.log(`     金额: ¥${record.amount}`)
      console.log(`     类型: ${record.costType}`)
      console.log(`     日期: ${record.date}`)
      console.log('     ---')
    })
    
    // 4. 检查是否有直接的财务成本记录
    console.log('\n4. 检查直接的财务成本记录...')
    const directFinanceRecords = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
      .orderBy('createTime', 'desc')
      .limit(5)
      .get()
    
    console.log(`找到 ${directFinanceRecords.data.length} 条直接财务记录`)
    directFinanceRecords.data.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.description || record.type}`)
      console.log(`     金额: ¥${record.amount}`)
      console.log(`     日期: ${record.date}`)
    })
    
  } catch (error) {
    console.error('调试过程中出错:', error)
  }
  
  console.log('\n=== 调试完成 ===')
}

// 如果直接运行此脚本
if (require.main === module) {
  debugPurchaseRecords()
}

module.exports = { debugPurchaseRecords }
