/**
 * 测试治疗记录死亡功能
 * 验证修复后的health-management云函数是否正常工作
 */

// 测试用例
const testCases = [
  {
    name: '正常情况',
    treatmentId: 'test-treatment-001',
    count: 2,
    deathCause: '治疗无效死亡',
    notes: '测试正常死亡记录',
    expectedResult: true
  },
  {
    name: '边界情况 - 无成本数据',
    treatmentId: 'test-treatment-002',
    count: 1,
    deathCause: '测试无成本',
    notes: '批次可能缺少成本数据',
    expectedResult: false  // 应该报错：缺少成本数据
  },
  {
    name: '累加更新',
    treatmentId: 'test-treatment-003',
    count: 3,
    deathCause: '累加测试',
    notes: '测试累加更新功能',
    expectedResult: true
  }
]

// 测试主函数
async function runTests() {
  console.log('========== 开始测试治疗记录死亡功能 ==========')
  
  for (const testCase of testCases) {
    console.log(`\n测试用例：${testCase.name}`)
    console.log('参数：', {
      treatmentId: testCase.treatmentId,
      count: testCase.count,
      deathCause: testCase.deathCause,
      notes: testCase.notes
    })
    
    try {
      // 调用云函数
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'record_treatment_death',
          treatmentId: testCase.treatmentId,
          count: testCase.count,
          deathCause: testCase.deathCause,
          notes: testCase.notes
        }
      })
      
      if (result.result.success) {
        console.log('✅ 成功：', result.result.data)
        if (!testCase.expectedResult) {
          console.error('⚠️ 警告：预期失败但实际成功')
        }
      } else {
        console.error('❌ 失败：', result.result.error)
        if (testCase.expectedResult) {
          console.error('⚠️ 警告：预期成功但实际失败')
        }
      }
      
    } catch (error) {
      console.error('❌ 错误：', error.message)
      if (error.message.includes('toFixed')) {
        console.error('🔥 toFixed错误仍然存在！需要进一步修复')
      }
      if (testCase.expectedResult) {
        console.error('⚠️ 警告：预期成功但实际出错')
      }
    }
  }
  
  console.log('\n========== 测试完成 ==========')
}

// 验证成本计算
async function testCostCalculation() {
  console.log('\n========== 测试成本计算 ==========')
  
  const testBatchIds = [
    'QY-20251118',  // 正常批次
    'test-batch-001', // 可能不存在的批次
    'batch-no-cost'   // 缺少成本数据的批次
  ]
  
  for (const batchId of testBatchIds) {
    console.log(`\n测试批次：${batchId}`)
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'calculate_batch_cost',
          batchId: batchId
        }
      })
      
      if (result.result.success) {
        const data = result.result.data
        console.log('成本计算结果：')
        console.log('- 综合平均成本：', data.avgTotalCost)
        console.log('- 入栏单价：', data.entryUnitCost)
        console.log('- 饲养成本：', data.avgBreedingCost)
        
        // 检查是否有NaN或无效值
        if (isNaN(parseFloat(data.avgTotalCost))) {
          console.error('⚠️ 警告：avgTotalCost是NaN')
        }
        if (isNaN(parseFloat(data.entryUnitCost))) {
          console.error('⚠️ 警告：entryUnitCost是NaN')
        }
      } else {
        console.error('❌ 计算失败：', result.result.error)
      }
    } catch (error) {
      console.error('❌ 错误：', error.message)
    }
  }
}

// 主测试入口
async function main() {
  try {
    // 先测试成本计算
    await testCostCalculation()
    
    // 再测试死亡记录
    await runTests()
    
    console.log('\n✅ 所有测试完成')
  } catch (error) {
    console.error('\n❌ 测试过程出错：', error)
  }
}

// 导出供小程序调用
module.exports = {
  main,
  runTests,
  testCostCalculation
}

// 如果是命令行运行
if (typeof wx === 'undefined') {
  console.log('请在小程序开发者工具中运行此脚本')
  console.log('或在页面中调用：')
  console.log('const test = require("./scripts/test-treatment-death-record.js")')
  console.log('test.main()')
}
