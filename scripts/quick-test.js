// 快速测试脚本 - 复制到控制台执行

async function quickTest() {
  console.log('🚀 开始快速测试...\n');
  
  const tests = [
    // health-cost 模块
    {
      name: '健康率计算',
      action: 'calculate_health_rate'
    },
    {
      name: '治疗成本统计',
      action: 'calculate_treatment_cost',
      batchId: 'all'
    },
    
    // health-overview 模块  
    {
      name: '首页健康概览',
      action: 'get_homepage_health_overview'
    },
    {
      name: '仪表盘快照',
      action: 'get_dashboard_snapshot',
      batchId: 'all'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`测试: ${test.name}`);
      const start = Date.now();
      
      const res = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: test.action,
          batchId: test.batchId
        }
      });
      
      const time = Date.now() - start;
      
      if (res.result?.success) {
        passed++;
        console.log(`✅ 通过 (${time}ms)`);
        console.log('   数据:', JSON.stringify(res.result.data).substring(0, 100));
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
  
  console.log('================');
  console.log(`总结: ${passed}/${tests.length} 通过`);
  
  if (passed === tests.length) {
    console.log('🎉 所有测试通过！');
    console.log('✅ 云函数拆分成功验证');
    console.log('💡 建议：可以继续部署其他模块');
  } else {
    console.log('⚠️ 有测试失败，请检查');
  }
}

// 执行测试
quickTest();
