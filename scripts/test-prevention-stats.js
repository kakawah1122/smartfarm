// 测试预防统计数据的脚本
// 在云开发控制台运行，检查实际返回的数据

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 测试health-prevention云函数
async function testHealthPrevention() {
  console.log('=== 测试health-prevention云函数 ===')
  
  // 测试getPreventionDashboard
  try {
    const result1 = await cloud.callFunction({
      name: 'health-prevention',
      data: {
        action: 'getPreventionDashboard',
        batchId: 'all'
      }
    })
    console.log('getPreventionDashboard返回:', JSON.stringify(result1.result, null, 2))
  } catch (error) {
    console.error('getPreventionDashboard错误:', error)
  }
  
  // 测试list_prevention_records - medication
  try {
    const result2 = await cloud.callFunction({
      name: 'health-prevention',
      data: {
        action: 'list_prevention_records',
        preventionType: 'medication',
        batchId: 'all',
        page: 1,
        pageSize: 1
      }
    })
    console.log('list_prevention_records(medication)返回:', JSON.stringify(result2.result, null, 2))
  } catch (error) {
    console.error('list_prevention_records(medication)错误:', error)
  }
  
  // 测试list_prevention_records - vaccine
  try {
    const result3 = await cloud.callFunction({
      name: 'health-prevention',
      data: {
        action: 'list_prevention_records',
        preventionType: 'vaccine',
        batchId: 'all',
        page: 1,
        pageSize: 1
      }
    })
    console.log('list_prevention_records(vaccine)返回:', JSON.stringify(result3.result, null, 2))
  } catch (error) {
    console.error('list_prevention_records(vaccine)错误:', error)
  }
}

// 直接查询数据库
async function testDatabase() {
  console.log('\n=== 直接查询数据库 ===')
  
  try {
    // 查询medication记录
    const medicationCount = await db.collection('health_prevention_records')
      .where({
        preventionType: 'medication',
        isDeleted: false
      })
      .count()
    console.log('medication记录数:', medicationCount.total)
    
    // 查询vaccine记录
    const vaccineCount = await db.collection('health_prevention_records')
      .where({
        preventionType: 'vaccine',
        isDeleted: false
      })
      .count()
    console.log('vaccine记录数:', vaccineCount.total)
    
    // 查询所有预防记录
    const allCount = await db.collection('health_prevention_records')
      .where({
        isDeleted: false
      })
      .count()
    console.log('所有预防记录数:', allCount.total)
    
    // 获取一条示例记录
    const sampleRecord = await db.collection('health_prevention_records')
      .limit(1)
      .get()
    if (sampleRecord.data.length > 0) {
      console.log('示例记录结构:', JSON.stringify(sampleRecord.data[0], null, 2))
    }
    
  } catch (error) {
    console.error('数据库查询错误:', error)
  }
}

// 执行测试
async function runTests() {
  await testHealthPrevention()
  await testDatabase()
}

runTests()
