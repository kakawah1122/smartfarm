// 测试采购记录同步到财务管理的修复效果
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 集合配置
const COLLECTIONS = {
  PROD_MATERIAL_RECORDS: 'prod_material_records',
  PROD_MATERIALS: 'prod_materials'
}

async function testPurchaseFinanceSync() {
  console.log('=== 测试采购记录同步到财务管理 ===')
  
  try {
    // 1. 查询最近的采购记录
    console.log('\n1. 查询最近的采购记录...')
    const recentPurchases = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where({
        type: 'purchase'
      })
      .orderBy('createTime', 'desc')
      .limit(3)
      .get()
    
    console.log(`找到 ${recentPurchases.data.length} 条采购记录`)
    recentPurchases.data.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record._id}`)
      console.log(`     物料名称: ${record.materialName || '未知'}`)
      console.log(`     数量: ${record.quantity}`)
      console.log(`     单价: ${record.unitPrice}`)
      console.log(`     总金额: ${record.totalAmount}`)
      console.log(`     供应商: ${record.supplier}`)
      console.log(`     是否有isDeleted字段: ${record.hasOwnProperty('isDeleted') ? '是' : '否'}`)
      console.log(`     isDeleted值: ${record.isDeleted}`)
      console.log(`     创建时间: ${record.createTime}`)
      console.log('     ---')
    })
    
    // 2. 测试修复后的财务查询条件
    console.log('\n2. 测试修复后的财务查询条件...')
    
    // 模拟财务查询条件（修复后的）
    const purchaseConditions = [
      _.or([
        { isDeleted: false },
        { isDeleted: _.exists(false) }  // 兼容没有 isDeleted 字段的记录
      ]),
      { type: 'purchase' }
    ]
    
    const financeQueryResult = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where(_.and(purchaseConditions))
      .orderBy('createTime', 'desc')
      .limit(5)
      .get()
    
    console.log(`财务查询找到 ${financeQueryResult.data.length} 条采购记录`)
    financeQueryResult.data.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record._id}`)
      console.log(`     物料名称: ${record.materialName || '未知'}`)
      console.log(`     总金额: ${record.totalAmount}`)
      console.log(`     供应商: ${record.supplier}`)
      console.log(`     创建时间: ${record.createTime}`)
      console.log('     ---')
    })
    
    // 3. 测试旧的查询条件（修复前的）
    console.log('\n3. 测试旧的查询条件（修复前的）...')
    
    const oldConditions = [
      { isDeleted: false },  // 旧的严格条件
      { type: 'purchase' }
    ]
    
    const oldQueryResult = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where(_.and(oldConditions))
      .orderBy('createTime', 'desc')
      .limit(5)
      .get()
    
    console.log(`旧查询条件找到 ${oldQueryResult.data.length} 条采购记录`)
    
    // 4. 对比结果
    console.log('\n4. 对比查询结果...')
    console.log(`修复后查询结果: ${financeQueryResult.data.length} 条记录`)
    console.log(`修复前查询结果: ${oldQueryResult.data.length} 条记录`)
    
    if (financeQueryResult.data.length > oldQueryResult.data.length) {
      console.log('✅ 修复成功！新的查询条件能够找到更多记录')
      console.log(`增加了 ${financeQueryResult.data.length - oldQueryResult.data.length} 条记录`)
    } else if (financeQueryResult.data.length === oldQueryResult.data.length) {
      console.log('ℹ️  查询结果相同，可能所有记录都已有 isDeleted 字段')
    } else {
      console.log('⚠️  异常：修复后的查询结果反而更少')
    }
    
    // 5. 检查没有 isDeleted 字段的记录
    console.log('\n5. 检查没有 isDeleted 字段的记录...')
    const recordsWithoutIsDeleted = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where({
        type: 'purchase',
        isDeleted: _.exists(false)
      })
      .get()
    
    console.log(`没有 isDeleted 字段的采购记录: ${recordsWithoutIsDeleted.data.length} 条`)
    
    if (recordsWithoutIsDeleted.data.length > 0) {
      console.log('这些记录在修复前无法被财务查询找到：')
      recordsWithoutIsDeleted.data.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record._id}`)
        console.log(`     创建时间: ${record.createTime}`)
        console.log(`     总金额: ${record.totalAmount}`)
      })
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error)
  }
  
  console.log('\n=== 测试完成 ===')
}

// 如果直接运行此脚本
if (require.main === module) {
  testPurchaseFinanceSync()
}

module.exports = { testPurchaseFinanceSync }
