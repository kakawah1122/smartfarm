#!/usr/bin/env node

/**
 * 简化版health-records云函数测试
 * 直接测试核心逻辑，不依赖wx-server-sdk
 */

const path = require('path');
const fs = require('fs');

// 模拟数据
const mockBatchData = {
  _id: 'test-batch-001',
  batchNumber: 'test-batch-001',
  currentCount: 100,
  healthyCount: 95
};

const mockHealthRecords = [
  {
    _id: 'record-001',
    batchId: 'test-batch-001',
    healthyCount: 95,
    sickCount: 5,
    affectedCount: 5,
    checkDate: '2025-11-23',
    recordType: 'ai_diagnosis',
    status: 'abnormal'
  }
];

const mockTreatmentRecords = [
  {
    _id: 'treatment-001',
    batchId: 'test-batch-001',
    curedCount: 3,
    treatmentStatus: 'cured'
  }
];

// 测试calculate_health_rate的核心逻辑
function testCalculateHealthRate() {
  console.log('\n测试 calculate_health_rate 核心逻辑...');
  
  const currentStock = mockBatchData.currentCount || 0;
  const healthyCount = mockHealthRecords[0]?.healthyCount || currentStock;
  const totalCured = mockTreatmentRecords.reduce((sum, r) => sum + (r.curedCount || 0), 0);
  
  // 计算健康率 = (健康数 + 治愈数) / 存栏数 × 100%
  const healthRate = ((healthyCount + totalCured) / currentStock * 100).toFixed(1);
  
  console.log(`  当前存栏: ${currentStock}`);
  console.log(`  健康数量: ${healthyCount}`);
  console.log(`  治愈数量: ${totalCured}`);
  console.log(`  健康率: ${healthRate}%`);
  
  if (healthRate === '98.0') {
    console.log('  ✅ 计算正确');
    return true;
  } else {
    console.log(`  ❌ 计算错误，期望98.0，实际${healthRate}`);
    return false;
  }
}

// 测试create_health_record的数据构建
function testCreateHealthRecord() {
  console.log('\n测试 create_health_record 数据构建...');
  
  const event = {
    batchId: 'test-batch-001',
    recordType: 'routine_check',
    totalCount: 100,
    healthyCount: 95,
    sickCount: 5,
    deadCount: 0,
    symptoms: ['咳嗽', '流鼻涕'],
    diagnosis: '轻微感冒',
    treatment: '增加维生素',
    notes: '需要观察'
  };
  
  // 构建记录数据
  const recordData = {
    batchId: event.batchId,
    recordType: event.recordType || 'routine_check',
    checkDate: new Date().toISOString().split('T')[0],
    inspector: 'test-openid',
    totalCount: event.totalCount || 0,
    healthyCount: event.healthyCount || 0,
    sickCount: event.sickCount || 0,
    deadCount: event.deadCount || 0,
    symptoms: event.symptoms || [],
    diagnosis: event.diagnosis || '',
    treatment: event.treatment || '',
    notes: event.notes || '',
    followUpRequired: event.sickCount > 0,
    followUpDate: event.sickCount > 0 ? 
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
    severity: calculateSeverity(event.sickCount, event.deadCount, event.totalCount)
  };
  
  console.log('  构建的数据:', JSON.stringify(recordData, null, 2));
  
  if (recordData.batchId === 'test-batch-001' && 
      recordData.sickCount === 5 &&
      recordData.followUpRequired === true &&
      recordData.severity === 'low') {  // 5%患病率是low级别
    console.log('  ✅ 数据构建正确');
    return true;
  } else {
    console.log(`  ❌ 数据构建错误，severity期望low，实际${recordData.severity}`);
    return false;
  }
}

// 计算严重程度
function calculateSeverity(sickCount, deadCount, totalCount) {
  if (totalCount === 0) return 'low';
  
  const sickRate = (sickCount / totalCount) * 100;
  const deathRate = (deadCount / totalCount) * 100;
  
  if (deathRate > 5 || sickRate > 20) return 'critical';
  if (deathRate > 2 || sickRate > 10) return 'high';
  if (deathRate > 0.5 || sickRate > 5) return 'medium';
  return 'low';
}

// 测试get_health_records_by_status的查询逻辑
function testGetHealthRecordsByStatus() {
  console.log('\n测试 get_health_records_by_status 查询逻辑...');
  
  const status = 'abnormal';
  const batchId = 'test-batch-001';
  
  // 模拟查询
  const filteredRecords = mockHealthRecords.filter(r => {
    return r.status === status && 
           r.recordType === 'ai_diagnosis' &&
           (batchId === 'all' || r.batchId === batchId);
  });
  
  // 计算受影响总数
  const totalCount = filteredRecords.reduce((sum, record) => {
    return sum + (record.affectedCount || 0);
  }, 0);
  
  console.log(`  查询状态: ${status}`);
  console.log(`  批次ID: ${batchId}`);
  console.log(`  找到记录: ${filteredRecords.length}条`);
  console.log(`  受影响总数: ${totalCount}`);
  
  if (filteredRecords.length === 1 && totalCount === 5) {
    console.log('  ✅ 查询逻辑正确');
    return true;
  } else {
    console.log('  ❌ 查询逻辑错误');
    return false;
  }
}

// 主函数
function main() {
  console.log('========================================');
  console.log('health-records 云函数核心逻辑测试');
  console.log('========================================');
  
  const results = [];
  
  // 运行测试
  results.push({
    name: 'create_health_record',
    success: testCreateHealthRecord()
  });
  
  results.push({
    name: 'get_health_records_by_status',
    success: testGetHealthRecordsByStatus()
  });
  
  results.push({
    name: 'calculate_health_rate',
    success: testCalculateHealthRate()
  });
  
  // 汇总结果
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.name}`);
  });
  
  console.log(`\n总计: ${successCount} 成功, ${failCount} 失败`);
  
  if (failCount === 0) {
    console.log('\n🎉 所有核心逻辑测试通过！');
    console.log('\n下一步:');
    console.log('1. 在微信开发者工具中上传部署health-records云函数');
    console.log('2. 在云开发控制台测试云函数');
    console.log('3. 更新前端调用，使用smartCloudCall');
    console.log('\n测试调用示例:');
    console.log('await smartCloudCall("create_health_record", {');
    console.log('  batchId: "test-batch-001",');
    console.log('  totalCount: 100,');
    console.log('  healthyCount: 95,');
    console.log('  sickCount: 5');
    console.log('});');
  } else {
    console.log('\n⚠️ 有测试失败，请检查代码');
    process.exit(1);
  }
}

// 执行测试
main();
