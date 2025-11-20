// 测试所有已部署的云函数模块
async function testAllModules() {
  console.log('🧪 测试所有云函数模块...\n');
  
  const modules = [
    {
      name: 'health-cost',
      tests: [
        { action: 'calculate_health_rate', data: {} },
        { action: 'calculate_treatment_cost', data: { batchId: 'all' } }
      ]
    },
    {
      name: 'health-overview',
      tests: [
        { action: 'get_homepage_health_overview', data: {} },
        { action: 'get_dashboard_snapshot', data: { batchId: 'all' } }
      ]
    },
    {
      name: 'health-abnormal',
      tests: [
        { action: 'get_abnormal_stats', data: { batchId: 'all' } },
        { action: 'list_abnormal_records', data: { page: 1, pageSize: 10 } }
      ]
    },
    {
      name: 'health-prevention',
      tests: [
        { action: 'get_prevention_dashboard', data: { batchId: 'all' } },
        { action: 'list_prevention_records', data: { page: 1, pageSize: 10 } }
      ]
    }
  ];
  
  const results = {};
  
  for (const module of modules) {
    console.log(`📦 测试 ${module.name}:`);
    results[module.name] = { passed: 0, failed: 0 };
    
    for (const test of module.tests) {
      const start = Date.now();
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: test.action,
            ...test.data
          }
        });
        
        const time = Date.now() - start;
        
        if (res.result?.success) {
          results[module.name].passed++;
          console.log(`  ✅ ${test.action} (${time}ms)`);
        } else {
          results[module.name].failed++;
          console.log(`  ❌ ${test.action}: ${res.result?.error}`);
        }
      } catch (error) {
        results[module.name].failed++;
        console.log(`  ❌ ${test.action}: ${error.message}`);
      }
    }
    console.log('');
  }
  
  // 总结报告
  console.log('=' .repeat(50));
  console.log('📊 测试总结');
  console.log('=' .repeat(50));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const [module, result] of Object.entries(results)) {
    totalPassed += result.passed;
    totalFailed += result.failed;
    
    const status = result.failed === 0 ? '✅' : '❌';
    console.log(`${status} ${module}: ${result.passed}/${result.passed + result.failed} 通过`);
  }
  
  console.log('');
  console.log(`总计: ${totalPassed}/${totalPassed + totalFailed} 通过`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 所有云函数模块工作正常！');
    console.log('✅ 云函数拆分优化成功！');
  } else {
    console.log('\n⚠️ 有 ' + totalFailed + ' 个测试失败');
    console.log('请检查失败的模块并重新部署');
  }
  
  return totalFailed === 0;
}

// 执行测试
testAllModules();
