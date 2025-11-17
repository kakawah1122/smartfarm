/**
 * 测试健康管理云函数性能优化
 * 用于验证优化后的云函数是否能在3秒内返回结果
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'smartfarm-8gv9x5zu2f903fa6'  // 请替换为您的环境ID
})

const db = cloud.database()

async function testHealthPerformance() {
  console.log('========================================')
  console.log('健康管理云函数性能测试')
  console.log('========================================\n')
  
  try {
    // 1. 获取一个活跃批次进行测试
    console.log('1. 获取活跃批次...')
    const batchResult = await db.collection('prod_batch_entries')
      .where({ 
        status: 'active',
        isDeleted: false 
      })
      .limit(1)
      .get()
    
    if (!batchResult.data || batchResult.data.length === 0) {
      console.log('❌ 没有找到活跃批次，无法进行测试')
      return
    }
    
    const testBatchId = batchResult.data[0]._id
    const testBatchNumber = batchResult.data[0].batchNumber
    console.log(`✅ 找到测试批次: ${testBatchNumber} (ID: ${testBatchId})`)
    
    // 2. 测试优化后的 get_batch_complete_data
    console.log('\n2. 测试优化后的 get_batch_complete_data 函数...')
    const startTime = Date.now()
    
    const testResult = await cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'get_batch_complete_data',
        batchId: testBatchId,
        includes: ['prevention', 'treatment', 'diagnosis', 'abnormal', 'pending_diagnosis'],
        diagnosisLimit: 10,
        preventionLimit: 20
      }
    })
    
    const endTime = Date.now()
    const executionTime = endTime - startTime
    
    console.log(`⏱️ 执行时间: ${executionTime}ms`)
    
    if (executionTime < 3000) {
      console.log('✅ 性能测试通过！执行时间少于3秒')
    } else {
      console.log(`⚠️ 性能警告：执行时间超过3秒 (${executionTime}ms)`)
    }
    
    // 3. 验证返回数据的完整性
    console.log('\n3. 验证返回数据完整性...')
    if (testResult.result && testResult.result.success) {
      const data = testResult.result.data
      
      const checks = [
        { name: '健康统计', field: 'healthStats', value: data.healthStats },
        { name: '预防统计', field: 'preventionStats', value: data.preventionStats },
        { name: '治疗统计', field: 'treatmentStats', value: data.treatmentStats },
        { name: '诊断历史', field: 'diagnosisHistory', value: data.diagnosisHistory },
        { name: '异常记录', field: 'abnormalRecords', value: data.abnormalRecords },
        { name: '待诊断数量', field: 'pendingDiagnosisCount', value: data.pendingDiagnosisCount }
      ]
      
      let allFieldsValid = true
      checks.forEach(check => {
        if (check.value !== undefined && check.value !== null) {
          console.log(`  ✅ ${check.name}: 已获取`)
        } else {
          console.log(`  ❌ ${check.name}: 缺失`)
          allFieldsValid = false
        }
      })
      
      if (allFieldsValid) {
        console.log('\n✅ 数据完整性验证通过')
      } else {
        console.log('\n⚠️ 部分数据缺失，请检查')
      }
      
      // 4. 显示关键性能指标
      console.log('\n4. 关键性能指标:')
      if (data.healthStats) {
        console.log(`  - 健康率: ${data.healthStats.healthyRate}%`)
        console.log(`  - 死亡率: ${data.healthStats.mortalityRate}%`)
        console.log(`  - 异常数量: ${data.healthStats.abnormalCount}`)
        console.log(`  - 治疗中数量: ${data.healthStats.treatingCount}`)
      }
      
      if (data.treatmentStats) {
        console.log(`  - 治疗成本: ¥${data.treatmentStats.totalCost}`)
        console.log(`  - 治愈率: ${data.treatmentStats.cureRate}%`)
      }
      
    } else {
      console.log('❌ 函数执行失败:', testResult.result?.error || '未知错误')
    }
    
    // 5. 测试原版函数作为对比（如果需要）
    console.log('\n5. 性能对比测试（可选）...')
    console.log('  提示：如果需要对比原版性能，可以调用未优化的函数进行测试')
    
    // 6. 测试建议
    console.log('\n6. 优化建议:')
    if (executionTime < 1000) {
      console.log('  🎉 性能优秀！响应时间小于1秒')
    } else if (executionTime < 2000) {
      console.log('  ✅ 性能良好，响应时间在1-2秒之间')
    } else if (executionTime < 3000) {
      console.log('  ⚠️ 性能一般，考虑进一步优化')
      console.log('  建议：')
      console.log('  - 检查是否有大量数据的批次')
      console.log('  - 考虑添加缓存机制')
      console.log('  - 进一步优化聚合管道查询')
    } else {
      console.log('  ❌ 性能不达标，需要进一步优化')
      console.log('  建议：')
      console.log('  - 检查数据库索引是否正确创建')
      console.log('  - 减少并行查询的数量')
      console.log('  - 考虑分页或延迟加载部分数据')
    }
    
  } catch (error) {
    console.error('测试过程中发生错误:', error)
  }
  
  console.log('\n========================================')
  console.log('测试完成')
  console.log('========================================')
}

// 执行测试
testHealthPerformance()
