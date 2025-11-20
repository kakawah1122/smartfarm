// 测试 health-abnormal 云函数
async function testAbnormal() {
  console.log('🧪 测试 health-abnormal 云函数...\n');
  
  const tests = [
    {
      name: '获取异常统计',
      action: 'get_abnormal_stats',
      data: { batchId: 'all' }
    },
    {
      name: '获取异常记录列表',
      action: 'list_abnormal_records',
      data: { page: 1, pageSize: 10 }
    }
  ];
  
  let passed = 0;
  
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
        passed++;
        console.log(`✅ 通过 (${time}ms)`);
        console.log('   数据:', JSON.stringify(res.result.data).substring(0, 100));
      } else {
        console.log(`❌ 失败:`, res.result?.error);
      }
    } catch (error) {
      console.log(`❌ 错误:`, error.message);
    }
    console.log('');
  }
  
  console.log(`结果: ${passed}/${tests.length} 通过`);
  
  if (passed === tests.length) {
    console.log('🎉 health-abnormal 云函数工作正常！');
  }
  
  return passed === tests.length;
}

// 执行测试
testAbnormal();
