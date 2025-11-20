#!/usr/bin/env node

/**
 * health-cost 云函数测试脚本
 * 功能：测试新拆分的成本计算云函数是否正常工作
 * 原则：只测试，不修改数据
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 开始测试 health-cost 云函数...\n');

// 模拟云函数调用环境
const mockCloud = {
  database: () => ({
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          console.log(`  📖 查询集合 ${name} 的文档 ${id}`);
          // 模拟批次数据
          if (name.includes('batch_entries')) {
            return {
              data: {
                batchNumber: 'TEST-001',
                quantity: 1000,
                currentQuantity: 950,
                unitPrice: 25.5
              }
            };
          }
          return { data: null };
        }
      }),
      where: (condition) => ({
        get: async () => {
          console.log(`  🔍 查询集合 ${name} 条件:`, JSON.stringify(condition).slice(0, 50));
          // 模拟查询结果
          return {
            data: [
              {
                costInfo: { totalCost: 100 },
                totalCost: 100,
                _id: 'test_id_1'
              }
            ]
          };
        },
        limit: (n) => ({ get: async () => ({ data: [] }) })
      })
    }),
    command: {
      neq: (val) => ({ _neq: val }),
      gte: (val) => ({ _gte: val }),
      lte: (val) => ({ _lte: val }),
      and: (val) => ({ _and: val }),
      aggregate: {}
    },
    serverDate: () => new Date()
  }),
  callFunction: async ({ name, data }) => {
    console.log(`  ☁️ 调用云函数: ${name}`);
    return { result: { success: true, data: {} } };
  },
  getWXContext: () => ({
    OPENID: 'test_openid',
    APPID: 'test_appid'
  }),
  init: (config) => {
    console.log('  ✅ 云环境初始化:', config.env === 'cloud.DYNAMIC_CURRENT_ENV' ? '动态环境' : config.env);
  },
  DYNAMIC_CURRENT_ENV: 'cloud.DYNAMIC_CURRENT_ENV'
};

// 测试用例
const testCases = [
  {
    name: '计算批次成本',
    action: 'calculate_batch_cost',
    params: {
      batchId: 'test_batch_001'
    }
  },
  {
    name: '计算治疗成本',
    action: 'calculate_treatment_cost',
    params: {
      dateRange: {
        start: '2025-01-01',
        end: '2025-12-31'
      },
      batchId: 'all'
    }
  },
  {
    name: '计算健康率',
    action: 'calculate_health_rate',
    params: {}
  },
  {
    name: '重算死亡成本',
    action: 'recalculate_death_cost',
    params: {
      deathRecordId: 'test_death_001'
    }
  }
];

// 执行测试
async function runTests() {
  const results = [];
  
  console.log('📋 准备测试 health-cost 云函数的各个 action\n');
  
  // 检查云函数文件是否存在
  const cloudFuncPath = path.join(__dirname, '../cloudfunctions/health-cost/index.js');
  if (!fs.existsSync(cloudFuncPath)) {
    console.error('❌ health-cost 云函数文件不存在:', cloudFuncPath);
    return;
  }
  
  console.log('✅ 云函数文件存在\n');
  
  // 模拟加载云函数
  try {
    // 使用 eval 模拟云函数环境（仅用于测试）
    const cloudFuncContent = fs.readFileSync(cloudFuncPath, 'utf-8');
    
    // 替换 require 语句以使用模拟的cloud
    const modifiedContent = cloudFuncContent
      .replace("require('wx-server-sdk')", "mockCloud")
      .replace("require('../../shared-config/collections.js')", `({
        COLLECTIONS: {
          PROD_BATCH_ENTRIES: 'prod_batch_entries',
          PROD_FEED_USAGE_RECORDS: 'prod_feed_usage_records',
          PROD_MATERIAL_RECORDS: 'prod_material_records',
          HEALTH_PREVENTION_RECORDS: 'health_prevention_records',
          HEALTH_TREATMENT_RECORDS: 'health_treatment_records',
          HEALTH_DEATH_RECORDS: 'health_death_records'
        }
      })`);
    
    // 创建函数执行环境
    const cloudFunc = new Function('mockCloud', 'exports', modifiedContent);
    const exports = {};
    cloudFunc(mockCloud, exports);
    
    // 执行测试
    for (const testCase of testCases) {
      console.log(`\n🧪 测试: ${testCase.name}`);
      console.log(`  Action: ${testCase.action}`);
      
      try {
        const result = await exports.main(
          {
            action: testCase.action,
            ...testCase.params
          },
          { getWXContext: mockCloud.getWXContext }
        );
        
        if (result.success) {
          console.log(`  ✅ 测试通过`);
          results.push({ ...testCase, passed: true });
        } else {
          console.log(`  ⚠️ 返回失败: ${result.error || result.message}`);
          results.push({ ...testCase, passed: false, error: result.error });
        }
      } catch (error) {
        console.log(`  ❌ 执行错误: ${error.message}`);
        results.push({ ...testCase, passed: false, error: error.message });
      }
    }
    
  } catch (error) {
    console.error('❌ 加载云函数失败:', error.message);
    return;
  }
  
  // 输出测试报告
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试报告\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  console.log(`总计: ${results.length} 个测试`);
  console.log(`✅ 通过: ${passed} 个`);
  console.log(`❌ 失败: ${failed} 个`);
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n💡 建议:');
  if (failed === 0) {
    console.log('  所有测试通过！可以部署 health-cost 云函数到云端进行实际测试。');
  } else {
    console.log('  请修复失败的测试后再部署云函数。');
  }
  
  console.log('='.repeat(50));
}

// 运行测试
runTests().catch(console.error);
