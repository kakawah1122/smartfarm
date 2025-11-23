#!/usr/bin/env node

/**
 * health-records 云函数测试脚本
 * 测试拆分后的云函数是否正常工作
 */

const fs = require('fs');
const path = require('path');

// 模拟云函数环境
const mockCloud = {
  database() {
    return {
      collection(name) {
        console.log(`  访问集合: ${name}`);
        return {
          doc(id) {
            return {
              get() {
                return Promise.resolve({ data: { _id: id, currentCount: 100 } });
              }
            };
          },
          where(condition) {
            console.log(`  查询条件:`, JSON.stringify(condition));
            return {
              orderBy(field, order) {
                return {
                  limit(n) {
                    return {
                      get() {
                        return Promise.resolve({ 
                          data: [
                            { 
                              _id: 'test-record-1',
                              healthyCount: 95,
                              sickCount: 5,
                              affectedCount: 5,
                              checkDate: '2025-11-23'
                            }
                          ] 
                        });
                      }
                    };
                  },
                  skip(n) {
                    return {
                      limit(m) {
                        return {
                          get() {
                            return Promise.resolve({ data: [] });
                          }
                        };
                      }
                    };
                  }
                };
              },
              limit(n) {
                return {
                  get() {
                    return Promise.resolve({ data: [] });
                  }
                };
              },
              get() {
                return Promise.resolve({ 
                  data: [
                    { curedCount: 3, treatmentStatus: 'cured' }
                  ] 
                });
              }
            };
          },
          add(data) {
            console.log(`  添加数据:`, JSON.stringify(data.data));
            return Promise.resolve({ _id: 'new-record-id' });
          }
        };
      },
      command: {
        in(values) {
          return { $in: values };
        }
      }
    };
  },
  init(config) {
    console.log('云环境初始化:', config.env);
  },
  getWXContext() {
    return { OPENID: 'test-openid' };
  }
};

// 测试用例
const testCases = [
  {
    name: 'create_health_record',
    description: '创建健康记录',
    data: {
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
    }
  },
  {
    name: 'get_health_records_by_status',
    description: '按状态查询健康记录',
    data: {
      batchId: 'test-batch-001',
      status: 'abnormal',
      limit: 10
    }
  },
  {
    name: 'calculate_health_rate',
    description: '计算健康率',
    data: {
      batchId: 'test-batch-001'
    }
  }
];

// 测试单个action
async function testAction(actionName, testData) {
  console.log(`\n测试 ${actionName}...`);
  
  try {
    // 加载action文件
    const actionPath = path.join(__dirname, '..', 'cloudfunctions', 'health-records', 'actions', `${actionName}.js`);
    
    if (!fs.existsSync(actionPath)) {
      console.log(`  ❌ Action文件不存在: ${actionPath}`);
      return false;
    }
    
    // 读取action文件内容
    let actionCode = fs.readFileSync(actionPath, 'utf-8');
    
    // 替换require('wx-server-sdk')为我们的mock对象
    actionCode = actionCode.replace(
      "const cloud = require('wx-server-sdk')",
      "const cloud = global.mockCloud"
    );
    
    // 修复相对路径问题
    actionCode = actionCode.replace(
      "require('../database-manager')",
      `require('${path.join(__dirname, '..', 'cloudfunctions', 'health-records', 'database-manager.js')}')`
    );
    actionCode = actionCode.replace(
      "require('../collections.js')",
      `require('${path.join(__dirname, '..', 'cloudfunctions', 'health-records', 'collections.js')}')`
    );
    
    // 创建临时文件
    const tempFile = path.join(__dirname, `temp-${actionName}.js`);
    fs.writeFileSync(tempFile, actionCode);
    
    // 设置全局mock对象
    global.mockCloud = mockCloud;
    
    // 清除require缓存
    delete require.cache[require.resolve(tempFile)];
    
    // 加载action
    const action = require(tempFile);
    
    // 清理临时文件
    fs.unlinkSync(tempFile);
    
    // 执行测试
    const result = await action.main(testData, mockCloud.getWXContext());
    
    if (result.success) {
      console.log(`  ✅ 测试通过`);
      console.log(`  返回数据:`, JSON.stringify(result.data));
      return true;
    } else {
      console.log(`  ❌ 测试失败:`, result.error);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 执行出错:`, error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('health-records 云函数测试');
  console.log('========================================');
  
  // 检查云函数目录
  const funcDir = path.join(__dirname, '..', 'cloudfunctions', 'health-records');
  if (!fs.existsSync(funcDir)) {
    console.error('❌ 云函数目录不存在:', funcDir);
    console.log('请先运行 refactor-cloud-functions.js 生成云函数框架');
    process.exit(1);
  }
  
  // 检查必要文件
  const requiredFiles = [
    'index.js',
    'package.json',
    'collections.js',
    'database-manager.js'
  ];
  
  console.log('\n检查必要文件...');
  for (const file of requiredFiles) {
    const filePath = path.join(funcDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} 缺失`);
    }
  }
  
  // 运行测试用例
  console.log('\n运行测试用例...');
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n【${testCase.description}】`);
    const success = await testAction(testCase.name, testCase.data);
    results.push({ name: testCase.name, success });
  }
  
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
    console.log('\n🎉 所有测试通过！');
    console.log('\n下一步:');
    console.log('1. 在微信开发者工具中部署云函数');
    console.log('2. 使用真实环境测试');
    console.log('3. 更新前端调用使用 smartCloudCall');
  } else {
    console.log('\n⚠️ 有测试失败，请检查代码');
    process.exit(1);
  }
}

// 处理模块加载问题
if (!module.parent) {
  main().catch(console.error);
} else {
  module.exports = { testAction };
}
