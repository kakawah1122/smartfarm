// 简单的数据库直接查询测试
// 用于在health-prevention云函数的测试页面运行

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('=== 直接查询数据库测试 ===')
  
  const results = {}
  
  // 1. 查询medication记录
  try {
    const medicationRecords = await db.collection('health_prevention_records')
      .where({
        preventionType: 'medication'
      })
      .limit(5)
      .get()
    
    results.medication = {
      count: medicationRecords.data.length,
      records: medicationRecords.data
    }
    console.log(`找到 ${medicationRecords.data.length} 条medication记录`)
  } catch (error) {
    results.medication = { error: error.message }
    console.error('查询medication失败:', error)
  }
  
  // 2. 查询vaccine记录
  try {
    const vaccineRecords = await db.collection('health_prevention_records')
      .where({
        preventionType: 'vaccine'
      })
      .limit(5)
      .get()
    
    results.vaccine = {
      count: vaccineRecords.data.length,
      records: vaccineRecords.data
    }
    console.log(`找到 ${vaccineRecords.data.length} 条vaccine记录`)
  } catch (error) {
    results.vaccine = { error: error.message }
    console.error('查询vaccine失败:', error)
  }
  
  // 3. 查询所有记录（查看实际的preventionType值）
  try {
    const allRecords = await db.collection('health_prevention_records')
      .limit(10)
      .get()
    
    // 统计preventionType的分布
    const typeDistribution = {}
    allRecords.data.forEach(record => {
      const type = record.preventionType || 'undefined'
      typeDistribution[type] = (typeDistribution[type] || 0) + 1
    })
    
    results.all = {
      count: allRecords.data.length,
      typeDistribution: typeDistribution,
      sampleRecord: allRecords.data[0] || null
    }
    
    console.log('preventionType分布:', typeDistribution)
  } catch (error) {
    results.all = { error: error.message }
    console.error('查询所有记录失败:', error)
  }
  
  // 4. 诊断结论
  let diagnosis = ''
  
  if (results.all?.sampleRecord) {
    console.log('\n示例记录结构:')
    console.log('- _id:', results.all.sampleRecord._id)
    console.log('- preventionType:', results.all.sampleRecord.preventionType)
    console.log('- 其他字段:', Object.keys(results.all.sampleRecord).join(', '))
    
    if (!results.medication?.count && !results.vaccine?.count) {
      if (results.all?.typeDistribution) {
        diagnosis = `数据库有记录但preventionType不是medication或vaccine。实际值: ${JSON.stringify(results.all.typeDistribution)}`
      } else {
        diagnosis = '数据库有记录但查询失败'
      }
    } else {
      diagnosis = `数据正常：medication=${results.medication?.count || 0}条，vaccine=${results.vaccine?.count || 0}条`
    }
  } else {
    diagnosis = '数据库中没有预防记录，需要先添加数据'
  }
  
  console.log('\n诊断结论:', diagnosis)
  
  return {
    success: true,
    results: results,
    diagnosis: diagnosis
  }
}
