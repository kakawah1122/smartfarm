/**
 * 健康管理模块化云函数实时测试脚本
 * 功能：测试部署后的云函数是否正常工作
 * 注意：需要在微信开发者工具控制台中执行
 */

// 测试配置
const testConfig = {
  // 如果有测试批次ID，请替换这里
  testBatchId: null,  // 设置为实际的批次ID或保持null使用默认
  showDetails: true   // 是否显示详细结果
};

// 测试用例定义
const testCases = [
  {
    module: 'health-cost',
    tests: [
      {
        name: '健康率计算',
        action: 'calculate_health_rate',
        data: {},
        validate: (result) => result.success === true
      },
      {
        name: '治疗成本统计（全部批次）',
        action: 'calculate_treatment_cost',
        data: {
          batchId: 'all',
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        },
        validate: (result) => result.success && result.data
      }
    ]
  },
  {
    module: 'health-overview',
    tests: [
      {
        name: '首页健康概览',
        action: 'get_homepage_health_overview',
        data: {},
        validate: (result) => result.success && result.data && 'totalQuantity' in result.data
      },
      {
        name: '仪表盘快照',
        action: 'get_dashboard_snapshot',
        data: {
          batchId: testConfig.testBatchId || 'all'
        },
        validate: (result) => result.success && result.data && 'today' in result.data
      },
      {
        name: '批次健康汇总',
        action: 'get_all_batches_health_summary',
        data: {},
        validate: (result) => result.success && result.data && 'totalBatches' in result.data
      }
    ]
  }
];

// 测试执行函数
async function runTests() {
  console.log('🚀 开始健康管理模块化云函数测试');
  console.log('==================================\n');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  for (const moduleTests of testCases) {
    console.log(`📦 测试模块: ${moduleTests.module}`);
    console.log('------------------------');
    
    for (const test of moduleTests.tests) {
      results.total++;
      console.log(`  🧪 ${test.name}...`);
      
      try {
        const startTime = Date.now();
        
        // 调用云函数
        const res = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: test.action,
            ...test.data
          }
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 验证结果
        if (test.validate(res.result)) {
          results.passed++;
          console.log(`    ✅ 通过 (${duration}ms)`);
          
          if (testConfig.showDetails && res.result.data) {
            console.log('    📊 返回数据:', 
              typeof res.result.data === 'object' 
                ? JSON.stringify(res.result.data, null, 2).substring(0, 200) + '...'
                : res.result.data
            );
          }
        } else {
          results.failed++;
          console.log(`    ❌ 失败 - 验证未通过`);
          results.errors.push({
            test: test.name,
            reason: '验证失败',
            result: res.result
          });
        }
        
        // 检查是否使用了新云函数（通过响应时间判断）
        if (duration < 500) {
          console.log('    ⚡ 可能使用了新云函数（响应快速）');
        }
        
      } catch (error) {
        results.failed++;
        console.log(`    ❌ 错误: ${error.message}`);
        results.errors.push({
          test: test.name,
          reason: error.message,
          stack: error.stack
        });
      }
      
      console.log('');
    }
  }
  
  // 输出测试报告
  console.log('\n==================================');
  console.log('📊 测试报告');
  console.log('==================================');
  console.log(`总计测试: ${results.total}`);
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`通过率: ${(results.passed / results.total * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ 失败详情:');
    results.errors.forEach((err, index) => {
      console.log(`\n${index + 1}. ${err.test}`);
      console.log(`   原因: ${err.reason}`);
      if (err.result) {
        console.log(`   结果:`, err.result);
      }
    });
  }
  
  // 测试降级机制
  console.log('\n🔧 测试降级机制...');
  try {
    // 故意调用不存在的action测试降级
    const res = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'test_fallback_action_not_exists'
      }
    });
    console.log('降级测试结果:', res.result);
  } catch (error) {
    console.log('✅ 降级机制正常（返回错误）');
  }
  
  // 总结
  console.log('\n==================================');
  if (results.passed === results.total) {
    console.log('🎉 所有测试通过！云函数拆分成功！');
    console.log('建议：可以继续部署其他模块');
  } else if (results.passed > 0) {
    console.log('⚠️ 部分测试通过，请检查失败的功能');
    console.log('建议：修复问题后再继续');
  } else {
    console.log('❌ 测试全部失败，可能需要回滚');
    console.log('建议：检查云函数部署状态');
  }
  
  return results;
}

// 执行测试
console.log('💡 提示：请在微信开发者工具控制台中执行以下命令：');
console.log('runTests()');
console.log('\n或直接复制粘贴整个脚本到控制台执行');
