// 添加测试数据的云函数
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('开始添加测试数据...')
  
  // 治疗记录测试数据
  const treatmentRecords = [
    {
      batchId: 'all',
      animalId: 'test-001',
      diagnosis: '肠炎',
      symptoms: '腹泻、食欲不振',
      costInfo: {
        medicationCost: 50,
        veterinaryCost: 100,
        totalCost: 150
      },
      treatmentDate: new Date().toISOString(),
      status: 'ongoing',
      isDeleted: false,
      createTime: new Date().toISOString()
    },
    {
      batchId: 'all',
      animalId: 'test-002',
      diagnosis: '呼吸道感染',
      symptoms: '咳嗽、流鼻涕',
      costInfo: {
        medicationCost: 80,
        veterinaryCost: 150,
        totalCost: 230
      },
      treatmentDate: new Date().toISOString(),
      status: 'completed',
      isDeleted: false,
      createTime: new Date().toISOString()
    }
  ]
  
  // 预防记录测试数据
  const preventionRecords = [
    {
      preventionType: 'medication',
      medicationName: '测试药品',
      dosage: '10ml',
      quantity: 100,
      batchId: 'all',
      costInfo: {
        totalCost: 200
      },
      preventionDate: new Date().toISOString(),
      isDeleted: false,
      createTime: new Date().toISOString()
    },
    {
      preventionType: 'vaccine',
      vaccineName: '测试疫苗',
      vaccinatedCount: 50,
      batchId: 'all',
      costInfo: {
        totalCost: 300
      },
      preventionDate: new Date().toISOString(),
      isDeleted: false,
      createTime: new Date().toISOString()
    }
  ]
  
  const results = {
    treatment: { success: 0, fail: 0 },
    prevention: { success: 0, fail: 0 }
  }
  
  // 添加治疗记录
  for (const record of treatmentRecords) {
    try {
      await db.collection('health_treatment_records').add({ data: record })
      results.treatment.success++
      console.log(`✅ 添加治疗记录成功: ${record.diagnosis}`)
    } catch (error) {
      results.treatment.fail++
      console.error(`❌ 添加治疗记录失败:`, error)
    }
  }
  
  // 添加预防记录
  for (const record of preventionRecords) {
    try {
      await db.collection('health_prevention_records').add({ data: record })
      results.prevention.success++
      console.log(`✅ 添加预防记录成功: ${record.preventionType}`)
    } catch (error) {
      results.prevention.fail++
      console.error(`❌ 添加预防记录失败:`, error)
    }
  }
  
  console.log('\n📊 添加完成统计:')
  console.log(`治疗记录: 成功${results.treatment.success}条，失败${results.treatment.fail}条`)
  console.log(`预防记录: 成功${results.prevention.success}条，失败${results.prevention.fail}条`)
  
  return {
    success: true,
    results: results
  }
}
