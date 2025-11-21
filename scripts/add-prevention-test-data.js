// 添加预防记录测试数据的脚本
// 在云开发控制台数据库页面运行

const db = cloud.database()

// 添加测试数据
async function addTestData() {
  const testRecords = [
    // 用药记录
    {
      preventionType: 'medication',
      medicationName: '禽流感疫苗',
      medicationType: 'vaccine',
      dosage: '0.5ml/只',
      quantity: 100,
      usageMethod: '肌肉注射',
      batchId: 'all',
      preventionDate: new Date().toISOString(),
      costInfo: {
        unitPrice: 2,
        totalCost: 200
      },
      operator: '系统管理员',
      notes: '常规防疫',
      createTime: new Date().toISOString(),
      isDeleted: false
    },
    {
      preventionType: 'medication',
      medicationName: '电解多维',
      medicationType: 'nutrition',
      dosage: '1g/L',
      quantity: 50,
      usageMethod: '饮水',
      batchId: 'all',
      preventionDate: new Date().toISOString(),
      costInfo: {
        unitPrice: 1.5,
        totalCost: 75
      },
      operator: '系统管理员',
      notes: '增强免疫',
      createTime: new Date().toISOString(),
      isDeleted: false
    },
    // 疫苗记录
    {
      preventionType: 'vaccine',
      vaccineName: '新城疫疫苗',
      vaccineType: 'live',
      dosage: '0.3ml/只',
      vaccinatedCount: 80,
      vaccineInfo: {
        manufacturer: '某生物科技公司',
        batchNumber: 'VAC202501',
        validityDate: '2025-12-31'
      },
      batchId: 'all',
      preventionDate: new Date().toISOString(),
      costInfo: {
        unitPrice: 3,
        totalCost: 240
      },
      operator: '系统管理员',
      notes: '定期免疫',
      createTime: new Date().toISOString(),
      isDeleted: false
    },
    {
      preventionType: 'vaccine',
      vaccineName: '鹅副粘病毒疫苗',
      vaccineType: 'inactivated',
      dosage: '0.5ml/只',
      vaccinatedCount: 120,
      vaccineInfo: {
        manufacturer: '某动物药业',
        batchNumber: 'VAC202502',
        validityDate: '2025-11-30'
      },
      batchId: 'all',
      preventionDate: new Date().toISOString(),
      costInfo: {
        unitPrice: 2.5,
        totalCost: 300
      },
      operator: '系统管理员',
      notes: '预防副粘病毒',
      createTime: new Date().toISOString(),
      isDeleted: false
    },
    // 消毒记录
    {
      preventionType: 'disinfection',
      disinfectantName: '84消毒液',
      disinfectionArea: '鹅舍A区',
      concentration: '1:200',
      usageAmount: '20L',
      batchId: 'all',
      preventionDate: new Date().toISOString(),
      costInfo: {
        unitPrice: 10,
        totalCost: 10
      },
      operator: '系统管理员',
      notes: '日常消毒',
      createTime: new Date().toISOString(),
      isDeleted: false
    }
  ]
  
  console.log('开始添加测试数据...')
  
  for (const record of testRecords) {
    try {
      const result = await db.collection('health_prevention_records').add({
        data: record
      })
      console.log(`✅ 添加成功: ${record.preventionType} - ${record.medicationName || record.vaccineName || record.disinfectantName}`)
    } catch (error) {
      console.error(`❌ 添加失败:`, error)
    }
  }
  
  // 统计数据
  const stats = await Promise.all([
    db.collection('health_prevention_records').where({ preventionType: 'medication' }).count(),
    db.collection('health_prevention_records').where({ preventionType: 'vaccine' }).count(),
    db.collection('health_prevention_records').where({ preventionType: 'disinfection' }).count()
  ])
  
  console.log('\n📊 数据统计:')
  console.log(`- medication记录: ${stats[0].total}条`)
  console.log(`- vaccine记录: ${stats[1].total}条`)
  console.log(`- disinfection记录: ${stats[2].total}条`)
  
  return {
    success: true,
    message: '测试数据添加完成',
    stats: {
      medication: stats[0].total,
      vaccine: stats[1].total,
      disinfection: stats[2].total
    }
  }
}

// 执行
addTestData()
