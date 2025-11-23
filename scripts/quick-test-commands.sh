#!/bin/bash

# 快速测试命令集合
# 用于在开发者工具控制台快速测试新架构

echo "========================================="
echo "  🚀 新架构快速测试命令"
echo "========================================="
echo ""
echo "📋 将以下命令复制到小程序开发者工具控制台执行："
echo ""
echo "----------------------------------------"
echo "1. 测试健康记录模块"
echo "----------------------------------------"
cat << 'EOF'
// 测试健康记录创建
wx.cloud.callFunction({
  name: 'health-records',
  data: {
    action: 'create_health_record',
    recordData: {
      recordType: 'daily_check',
      batchId: 'test-batch-001',
      checkDate: new Date().toISOString(),
      healthStatus: 'normal',
      remarks: '新架构测试'
    }
  }
}).then(res => {
  console.log('✅ 健康记录创建成功:', res);
}).catch(err => {
  console.error('❌ 健康记录创建失败:', err);
});
EOF

echo ""
echo "----------------------------------------"
echo "2. 测试治疗管理模块"
echo "----------------------------------------"
cat << 'EOF'
// 测试治疗记录列表
wx.cloud.callFunction({
  name: 'health-treatment',
  data: {
    action: 'list_treatment_records',
    page: 1,
    pageSize: 10
  }
}).then(res => {
  console.log('✅ 治疗记录列表获取成功:', res);
  console.log('记录数量:', res.result.data?.records?.length || 0);
}).catch(err => {
  console.error('❌ 治疗记录列表获取失败:', err);
});
EOF

echo ""
echo "----------------------------------------"
echo "3. 测试预防管理模块（重点）"
echo "----------------------------------------"
cat << 'EOF'
// 测试今日预防任务
wx.cloud.callFunction({
  name: 'health-prevention',
  data: {
    action: 'get_today_prevention_tasks'
  }
}).then(res => {
  console.log('✅ 今日预防任务获取成功:', res);
  console.log('任务数量:', res.result.data?.tasks?.length || 0);
}).catch(err => {
  console.error('❌ 今日预防任务获取失败:', err);
});
EOF

echo ""
echo "----------------------------------------"
echo "4. 测试健康概览模块"
echo "----------------------------------------"
cat << 'EOF'
// 测试健康概览数据
wx.cloud.callFunction({
  name: 'health-overview',
  data: {
    action: 'get_health_overview',
    batchId: 'all'
  }
}).then(res => {
  console.log('✅ 健康概览获取成功:', res);
  console.log('统计数据:', res.result.data?.stats);
}).catch(err => {
  console.error('❌ 健康概览获取失败:', err);
});
EOF

echo ""
echo "----------------------------------------"
echo "5. 测试AI诊断模块"
echo "----------------------------------------"
cat << 'EOF'
// 测试诊断历史
wx.cloud.callFunction({
  name: 'ai-diagnosis',
  data: {
    action: 'get_diagnosis_history',
    page: 1,
    pageSize: 5
  }
}).then(res => {
  console.log('✅ AI诊断历史获取成功:', res);
  console.log('历史记录数:', res.result.data?.records?.length || 0);
}).catch(err => {
  console.error('❌ AI诊断历史获取失败:', err);
});
EOF

echo ""
echo "----------------------------------------"
echo "6. 批量测试所有模块"
echo "----------------------------------------"
cat << 'EOF'
// 批量测试所有模块
async function testAllModules() {
  const tests = [
    {
      name: 'health-records',
      action: 'list_health_records',
      data: { page: 1, pageSize: 1 }
    },
    {
      name: 'health-treatment',
      action: 'get_treatment_statistics',
      data: {}
    },
    {
      name: 'health-death',
      action: 'list_death_records',
      data: { page: 1, pageSize: 1 }
    },
    {
      name: 'health-abnormal',
      action: 'list_abnormal_records',
      data: { page: 1, pageSize: 1 }
    },
    {
      name: 'health-prevention',
      action: 'list_prevention_records',
      data: { page: 1, pageSize: 1 }
    },
    {
      name: 'health-overview',
      action: 'get_health_overview',
      data: { batchId: 'all' }
    }
  ];
  
  console.log('🚀 开始批量测试...\n');
  let passCount = 0;
  let failCount = 0;
  
  for (const test of tests) {
    try {
      const res = await wx.cloud.callFunction({
        name: test.name,
        data: { action: test.action, ...test.data }
      });
      console.log(`✅ ${test.name} - ${test.action}: 成功`);
      passCount++;
    } catch (err) {
      console.error(`❌ ${test.name} - ${test.action}: 失败`, err.message);
      failCount++;
    }
  }
  
  console.log('\n📊 测试结果:');
  console.log(`通过: ${passCount}/${tests.length}`);
  console.log(`失败: ${failCount}/${tests.length}`);
  console.log(`通过率: ${(passCount/tests.length*100).toFixed(1)}%`);
  
  if (failCount === 0) {
    console.log('\n🎉 所有模块测试通过！新架构运行正常！');
  } else {
    console.log('\n⚠️ 部分模块测试失败，请检查云函数日志。');
  }
}

// 执行批量测试
testAllModules();
EOF

echo ""
echo "----------------------------------------"
echo "7. 测试路由适配器"
echo "----------------------------------------"
cat << 'EOF'
// 测试智能路由（使用 safeCloudCall）
const { smartCloudCall } = require('./utils/cloud-adapter.js');

// 测试路由到 health-prevention
smartCloudCall('complete_prevention_task', {
  taskId: 'test-task',
  batchId: 'test-batch',
  preventionData: {}
}).then(res => {
  console.log('✅ 路由测试成功，已路由到:', res);
}).catch(err => {
  console.error('❌ 路由测试失败:', err);
});
EOF

echo ""
echo "========================================="
echo "💡 测试提示："
echo "1. 先执行批量测试（命令6）快速验证所有模块"
echo "2. 如有失败，单独测试对应模块"
echo "3. 查看云函数日志了解详细错误"
echo "4. 测试完成后记录结果到测试文档"
echo "========================================="
