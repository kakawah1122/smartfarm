// 测试原始功能（不通过路由）
async function testOriginal() {
  console.log('🧪 测试原始 health-management 功能...\n');
  
  const tests = [
    { name: '健康率计算', action: 'calculate_health_rate', data: {} },
    { name: '预防看板', action: 'get_prevention_dashboard', data: { batchId: 'all' } }
  ];
  
  for (const test of tests) {
    console.log(`测试: ${test.name}`);
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
        console.log(`✅ 通过 (${time}ms)`);
        console.log('   数据:', JSON.stringify(res.result.data).substring(0, 100));
      } else {
        console.log(`❌ 失败:`, res.result?.error || res.result);
      }
    } catch (error) {
      console.log(`❌ 错误:`, error.message);
    }
    console.log('');
  }
}

// 测试直接调用新云函数
async function testDirectCall() {
  console.log('🚀 直接测试新云函数...\n');
  
  // 直接调用 health-cost
  try {
    console.log('测试 health-cost 直接调用:');
    const res = await wx.cloud.callFunction({
      name: 'health-cost',
      data: {
        action: 'calculate_health_rate'
      }
    });
    
    if (res.result?.success) {
      console.log('✅ health-cost 直接调用成功');
    } else {
      console.log('❌ health-cost 直接调用失败:', res.result);
    }
  } catch (error) {
    console.log('❌ health-cost 调用错误:', error.message);
  }
  
  console.log('');
  
  // 直接调用 health-overview
  try {
    console.log('测试 health-overview 直接调用:');
    const res = await wx.cloud.callFunction({
      name: 'health-overview',
      data: {
        action: 'get_homepage_health_overview'
      }
    });
    
    if (res.result?.success) {
      console.log('✅ health-overview 直接调用成功');
    } else {
      console.log('❌ health-overview 直接调用失败:', res.result);
    }
  } catch (error) {
    console.log('❌ health-overview 调用错误:', error.message);
  }
}

// 执行测试
console.log('1. 先测试原始功能');
await testOriginal();

console.log('\n2. 再测试直接调用');
await testDirectCall();
