// 测试新的路由机制
async function testNewRouting() {
  console.log('🧪 测试新路由机制...\n');
  
  const tests = [
    {
      name: '健康率计算（health-cost）',
      function: 'health-cost',
      action: 'calculate_health_rate'
    },
    {
      name: '仪表盘快照（health-overview）',
      function: 'health-overview',
      action: 'get_dashboard_snapshot',
      batchId: 'all'
    },
    {
      name: '异常统计（health-abnormal）',
      function: 'health-abnormal',
      action: 'get_abnormal_stats',
      batchId: 'all'
    },
    {
      name: '预防看板（health-prevention）',
      function: 'health-prevention',
      action: 'get_prevention_dashboard',
      batchId: 'all'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`测试: ${test.name}`);
    const start = Date.now();
    
    try {
      const res = await wx.cloud.callFunction({
        name: test.function,
        data: {
          action: test.action,
          batchId: test.batchId
        }
      });
      
      const time = Date.now() - start;
      
      if (res.result?.success) {
        passed++;
        console.log(`✅ 通过 (${time}ms)`);
        console.log('   数据:', JSON.stringify(res.result.data).substring(0, 80) + '...');
      } else {
        failed++;
        console.log(`❌ 失败:`, res.result?.error);
      }
    } catch (error) {
      failed++;
      console.log(`❌ 错误:`, error.message);
    }
    console.log('');
  }
  
  console.log('='.repeat(50));
  console.log(`总计: ${passed}/${tests.length} 通过`);
  
  if (passed === tests.length) {
    console.log('\n🎉 所有新云函数直接调用成功！');
    console.log('✅ 前端可以开始使用新的路由工具了');
  } else {
    console.log(`\n⚠️ 有 ${failed} 个测试失败`);
  }
  
  return passed === tests.length;
}

// 执行测试
testNewRouting();
