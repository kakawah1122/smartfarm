// 修复生产管理数据库中的 quantity 类型问题
// 问题：quantity 字段存储为字符串类型，导致累加时变成字符串拼接
// 解决方案：将所有 quantity 相关字段转换为数字类型

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'goose-5gl0fvr953d48a2e'
})

const db = cloud.database()

// 修复入栏记录中的 quantity 类型
async function fixEntryRecords() {
  console.log('开始修复入栏记录...')
  
  try {
    // 获取所有入栏记录
    const { data: records } = await db.collection('prod_batch_entries').limit(500).get()
    
    let fixedCount = 0
    let errorCount = 0
    
    for (const record of records) {
      try {
        // 检查需要修复的字段
        const needsFix = 
          typeof record.quantity === 'string' ||
          typeof record.unitPrice === 'string' ||
          typeof record.totalAmount === 'string' ||
          typeof record.currentQuantity === 'string' ||
          typeof record.currentCount === 'string'
        
        if (needsFix) {
          // 准备更新数据
          const updateData = {}
          
          // 转换 quantity 相关字段为数字
          if (typeof record.quantity === 'string') {
            updateData.quantity = Number(record.quantity) || 0
          }
          if (typeof record.unitPrice === 'string') {
            updateData.unitPrice = Number(record.unitPrice) || 0
          }
          if (typeof record.totalAmount === 'string') {
            updateData.totalAmount = Number(record.totalAmount) || 0
          }
          if (typeof record.currentQuantity === 'string') {
            updateData.currentQuantity = Number(record.currentQuantity) || 0
          }
          if (typeof record.currentCount === 'string') {
            updateData.currentCount = Number(record.currentCount) || 0
          }
          if (typeof record.deadCount === 'string') {
            updateData.deadCount = Number(record.deadCount) || 0
          }
          
          // 更新记录
          if (Object.keys(updateData).length > 0) {
            await db.collection('prod_batch_entries').doc(record._id).update({
              data: updateData
            })
            
            console.log(`✅ 修复入栏记录: ${record.batchNumber}`, updateData)
            fixedCount++
          }
        }
      } catch (error) {
        console.error(`❌ 修复入栏记录失败: ${record._id}`, error.message)
        errorCount++
      }
    }
    
    console.log(`入栏记录修复完成: 成功 ${fixedCount} 条, 失败 ${errorCount} 条`)
    return { fixedCount, errorCount }
  } catch (error) {
    console.error('修复入栏记录失败:', error)
    throw error
  }
}

// 修复出栏记录中的 quantity 类型
async function fixExitRecords() {
  console.log('开始修复出栏记录...')
  
  try {
    // 获取所有出栏记录
    const { data: records } = await db.collection('prod_batch_exits').limit(500).get()
    
    let fixedCount = 0
    let errorCount = 0
    
    for (const record of records) {
      try {
        // 检查需要修复的字段
        const needsFix = 
          typeof record.quantity === 'string' ||
          typeof record.unitPrice === 'string' ||
          typeof record.totalRevenue === 'string' ||
          typeof record.avgWeight === 'string'
        
        if (needsFix) {
          // 准备更新数据
          const updateData = {}
          
          // 转换字段为数字
          if (typeof record.quantity === 'string') {
            updateData.quantity = Number(record.quantity) || 0
          }
          if (typeof record.unitPrice === 'string') {
            updateData.unitPrice = Number(record.unitPrice) || 0
          }
          if (typeof record.totalRevenue === 'string') {
            updateData.totalRevenue = Number(record.totalRevenue) || 0
          }
          if (typeof record.avgWeight === 'string') {
            updateData.avgWeight = Number(record.avgWeight) || 0
          }
          
          // 更新记录
          if (Object.keys(updateData).length > 0) {
            await db.collection('prod_batch_exits').doc(record._id).update({
              data: updateData
            })
            
            console.log(`✅ 修复出栏记录: ${record.batchNumber}`, updateData)
            fixedCount++
          }
        }
      } catch (error) {
        console.error(`❌ 修复出栏记录失败: ${record._id}`, error.message)
        errorCount++
      }
    }
    
    console.log(`出栏记录修复完成: 成功 ${fixedCount} 条, 失败 ${errorCount} 条`)
    return { fixedCount, errorCount }
  } catch (error) {
    console.error('修复出栏记录失败:', error)
    throw error
  }
}

// 修复死亡记录中的 deathCount 类型
async function fixDeathRecords() {
  console.log('开始修复死亡记录...')
  
  try {
    // 获取所有死亡记录
    const { data: records } = await db.collection('health_death_records').limit(500).get()
    
    let fixedCount = 0
    let errorCount = 0
    
    for (const record of records) {
      try {
        // 检查需要修复的字段
        const needsFix = typeof record.deathCount === 'string'
        
        if (needsFix) {
          // 转换为数字
          const updateData = {
            deathCount: Number(record.deathCount) || 0
          }
          
          // 更新记录
          await db.collection('health_death_records').doc(record._id).update({
            data: updateData
          })
          
          console.log(`✅ 修复死亡记录: ${record.batchNumber}`, updateData)
          fixedCount++
        }
      } catch (error) {
        console.error(`❌ 修复死亡记录失败: ${record._id}`, error.message)
        errorCount++
      }
    }
    
    console.log(`死亡记录修复完成: 成功 ${fixedCount} 条, 失败 ${errorCount} 条`)
    return { fixedCount, errorCount }
  } catch (error) {
    console.error('修复死亡记录失败:', error)
    throw error
  }
}

// 主函数
exports.main = async (event, context) => {
  console.log('========================================')
  console.log('开始修复生产管理数量类型问题')
  console.log('========================================')
  
  try {
    const results = {
      entry: { fixedCount: 0, errorCount: 0 },
      exit: { fixedCount: 0, errorCount: 0 },
      death: { fixedCount: 0, errorCount: 0 }
    }
    
    // 修复入栏记录
    results.entry = await fixEntryRecords()
    
    // 修复出栏记录
    results.exit = await fixExitRecords()
    
    // 修复死亡记录
    results.death = await fixDeathRecords()
    
    // 汇总结果
    const totalFixed = results.entry.fixedCount + results.exit.fixedCount + results.death.fixedCount
    const totalError = results.entry.errorCount + results.exit.errorCount + results.death.errorCount
    
    console.log('========================================')
    console.log('修复完成！')
    console.log(`总计修复: ${totalFixed} 条记录`)
    console.log(`失败: ${totalError} 条记录`)
    console.log('========================================')
    
    return {
      success: true,
      message: '数据修复完成',
      results,
      summary: {
        totalFixed,
        totalError
      }
    }
  } catch (error) {
    console.error('修复过程出错:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
