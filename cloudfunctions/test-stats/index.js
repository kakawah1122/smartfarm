// 测试预防统计数据的云函数
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const results = {
    cloudFunctionTests: {},
    databaseTests: {},
    summary: {}
  }
  
  console.log('=== 开始测试预防统计数据 ===')
  
  // 1. 测试health-prevention云函数
  console.log('\n1. 测试云函数调用')
  
  try {
    // 测试getPreventionDashboard
    const dashboardResult = await cloud.callFunction({
      name: 'health-prevention',
      data: {
        action: 'getPreventionDashboard',
        batchId: 'all'
      }
    })
    results.cloudFunctionTests.dashboard = dashboardResult.result
    console.log('✅ getPreventionDashboard成功')
  } catch (error) {
    results.cloudFunctionTests.dashboard = { error: error.message }
    console.error('❌ getPreventionDashboard失败:', error.message)
  }
  
  try {
    // 测试list_prevention_records - medication
    const medicationResult = await cloud.callFunction({
      name: 'health-prevention',
      data: {
        action: 'list_prevention_records',
        preventionType: 'medication',
        batchId: 'all',
        page: 1,
        pageSize: 1
      }
    })
    results.cloudFunctionTests.medication = medicationResult.result
    console.log('✅ list_prevention_records(medication)成功')
  } catch (error) {
    results.cloudFunctionTests.medication = { error: error.message }
    console.error('❌ list_prevention_records(medication)失败:', error.message)
  }
  
  try {
    // 测试list_prevention_records - vaccine
    const vaccineResult = await cloud.callFunction({
      name: 'health-prevention',
      data: {
        action: 'list_prevention_records',
        preventionType: 'vaccine',
        batchId: 'all',
        page: 1,
        pageSize: 1
      }
    })
    results.cloudFunctionTests.vaccine = vaccineResult.result
    console.log('✅ list_prevention_records(vaccine)成功')
  } catch (error) {
    results.cloudFunctionTests.vaccine = { error: error.message }
    console.error('❌ list_prevention_records(vaccine)失败:', error.message)
  }
  
  // 2. 直接查询数据库
  console.log('\n2. 直接查询数据库')
  
  try {
    // 查询medication记录数
    const medicationCount = await db.collection('health_prevention_records')
      .where({
        preventionType: 'medication',
        isDeleted: db.command.neq(true)
      })
      .count()
    results.databaseTests.medicationCount = medicationCount.total
    console.log(`✅ medication记录数: ${medicationCount.total}`)
  } catch (error) {
    results.databaseTests.medicationCount = 0
    console.error('❌ 查询medication记录失败:', error.message)
  }
  
  try {
    // 查询vaccine记录数
    const vaccineCount = await db.collection('health_prevention_records')
      .where({
        preventionType: 'vaccine',
        isDeleted: db.command.neq(true)
      })
      .count()
    results.databaseTests.vaccineCount = vaccineCount.total
    console.log(`✅ vaccine记录数: ${vaccineCount.total}`)
  } catch (error) {
    results.databaseTests.vaccineCount = 0
    console.error('❌ 查询vaccine记录失败:', error.message)
  }
  
  try {
    // 查询所有预防记录数
    const allCount = await db.collection('health_prevention_records')
      .where({
        isDeleted: db.command.neq(true)
      })
      .count()
    results.databaseTests.totalCount = allCount.total
    console.log(`✅ 所有预防记录数: ${allCount.total}`)
  } catch (error) {
    results.databaseTests.totalCount = 0
    console.error('❌ 查询所有记录失败:', error.message)
  }
  
  try {
    // 获取一条示例记录查看结构
    const sampleRecord = await db.collection('health_prevention_records')
      .limit(1)
      .get()
    if (sampleRecord.data.length > 0) {
      results.databaseTests.sampleRecord = sampleRecord.data[0]
      console.log('✅ 获取示例记录成功')
    } else {
      results.databaseTests.sampleRecord = null
      console.log('⚠️ 数据库中没有预防记录')
    }
  } catch (error) {
    results.databaseTests.sampleRecord = null
    console.error('❌ 获取示例记录失败:', error.message)
  }
  
  // 3. 生成测试总结
  console.log('\n3. 测试总结')
  
  results.summary = {
    hasData: results.databaseTests.totalCount > 0,
    medicationDataOK: results.databaseTests.medicationCount > 0,
    vaccineDataOK: results.databaseTests.vaccineCount > 0,
    cloudFunctionOK: !results.cloudFunctionTests.dashboard?.error,
    recommendation: ''
  }
  
  if (!results.summary.hasData) {
    results.summary.recommendation = '数据库中没有预防记录，需要先添加测试数据'
  } else if (!results.summary.medicationDataOK && !results.summary.vaccineDataOK) {
    results.summary.recommendation = '数据库有记录但preventionType字段可能不是medication或vaccine'
  } else if (!results.summary.cloudFunctionOK) {
    results.summary.recommendation = '云函数调用失败，请检查云函数部署和权限'
  } else {
    results.summary.recommendation = '数据和云函数都正常，请检查前端代码逻辑'
  }
  
  console.log('\n=== 测试完成 ===')
  console.log('建议:', results.summary.recommendation)
  
  return {
    success: true,
    data: results
  }
}
