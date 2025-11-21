// 添加治疗记录测试数据的脚本
// 在云开发控制台数据库页面运行

const db = cloud.database()

// 添加测试数据
async function addTestData() {
  const testRecords = [
    // 治疗记录1
    {
      batchId: 'all',
      animalId: 'test-animal-001',
      animalTag: 'A001',
      diagnosis: '肠炎',
      symptoms: '腹泻、食欲不振',
      treatmentPlan: '口服抗生素+益生菌调理',
      medications: [
        {
          name: '氟苯尼考',
          dosage: '10mg/kg',
          frequency: '每日2次',
          duration: '5天'
        },
        {
          name: '益生菌',
          dosage: '5g/只',
          frequency: '每日1次',
          duration: '7天'
        }
      ],
      costInfo: {
        medicationCost: 50,
        veterinaryCost: 100,
        otherCost: 0,
        totalCost: 150
      },
      treatmentDate: new Date().toISOString(),
      status: 'ongoing',
      veterinarian: '张兽医',
      notes: '需要密切观察',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    },
    // 治疗记录2
    {
      batchId: 'all',
      animalId: 'test-animal-002',
      animalTag: 'A002',
      diagnosis: '呼吸道感染',
      symptoms: '咳嗽、流鼻涕、呼吸急促',
      treatmentPlan: '注射抗生素+雾化治疗',
      medications: [
        {
          name: '头孢噻呋',
          dosage: '5mg/kg',
          frequency: '每日1次',
          duration: '7天'
        },
        {
          name: '氨茶碱',
          dosage: '10mg/kg',
          frequency: '每日2次',
          duration: '3天'
        }
      ],
      costInfo: {
        medicationCost: 80,
        veterinaryCost: 150,
        otherCost: 20,
        totalCost: 250
      },
      treatmentDate: new Date().toISOString(),
      status: 'completed',
      veterinarian: '李兽医',
      notes: '已康复',
      createTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天前
      updateTime: new Date().toISOString(),
      isDeleted: false
    },
    // 治疗记录3
    {
      batchId: 'all',
      animalId: 'test-animal-003',
      animalTag: 'A003',
      diagnosis: '外伤',
      symptoms: '腿部撕裂伤',
      treatmentPlan: '清创缝合+抗生素预防感染',
      medications: [
        {
          name: '青霉素',
          dosage: '20000IU/kg',
          frequency: '每日2次',
          duration: '5天'
        },
        {
          name: '碘伏',
          dosage: '外用',
          frequency: '每日换药',
          duration: '7天'
        }
      ],
      costInfo: {
        medicationCost: 30,
        veterinaryCost: 200,
        otherCost: 50,
        totalCost: 280
      },
      treatmentDate: new Date().toISOString(),
      status: 'ongoing',
      veterinarian: '王兽医',
      notes: '伤口恢复良好',
      createTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3天前
      updateTime: new Date().toISOString(),
      isDeleted: false
    },
    // 治疗记录4
    {
      batchId: 'all',
      animalId: 'test-animal-004',
      animalTag: 'A004',
      diagnosis: '寄生虫感染',
      symptoms: '消瘦、贫血、精神萎靡',
      treatmentPlan: '驱虫治疗+营养补充',
      medications: [
        {
          name: '伊维菌素',
          dosage: '0.2mg/kg',
          frequency: '单次给药',
          duration: '1天'
        },
        {
          name: '复合维生素',
          dosage: '1片/只',
          frequency: '每日1次',
          duration: '14天'
        }
      ],
      costInfo: {
        medicationCost: 40,
        veterinaryCost: 80,
        otherCost: 0,
        totalCost: 120
      },
      treatmentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5天前
      status: 'completed',
      veterinarian: '赵兽医',
      notes: '已完成驱虫，需复查',
      createTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }
  ]
  
  console.log('开始添加治疗记录测试数据...')
  
  let successCount = 0
  let failCount = 0
  let totalCost = 0
  
  for (const record of testRecords) {
    try {
      const result = await db.collection('health_treatment_records').add({
        data: record
      })
      successCount++
      totalCost += record.costInfo.totalCost
      console.log(`✅ 添加成功: ${record.diagnosis} - ${record.animalTag} (成本: ¥${record.costInfo.totalCost})`)
    } catch (error) {
      failCount++
      console.error(`❌ 添加失败:`, error)
    }
  }
  
  // 统计数据
  const stats = await db.collection('health_treatment_records')
    .where({
      isDeleted: false
    })
    .count()
  
  console.log('\n📊 治疗记录统计:')
  console.log(`- 本次添加成功: ${successCount}条`)
  console.log(`- 本次添加失败: ${failCount}条`)
  console.log(`- 总治疗成本: ¥${totalCost}`)
  console.log(`- 数据库总记录数: ${stats.total}条`)
  
  return {
    success: true,
    message: '治疗记录测试数据添加完成',
    stats: {
      added: successCount,
      failed: failCount,
      totalCost: totalCost,
      totalRecords: stats.total
    }
  }
}

// 执行
addTestData()
