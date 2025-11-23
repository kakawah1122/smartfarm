#!/usr/bin/env node

/**
 * 云函数重构自动化脚本
 * 根据拆分计划自动生成新的云函数结构
 */

const fs = require('fs');
const path = require('path');

// 云函数拆分映射表
const REFACTORING_MAP = {
  'health-management': {
    // 拆分目标
    targets: [
      {
        name: 'health-records',
        description: '健康记录管理',
        actions: [
          'create_health_record',
          'list_health_records',
          'update_health_record',
          'delete_health_record',
          'get_health_record_detail',
          'get_health_records_by_status',
          'get_batch_health_summary',
          'calculate_health_rate'
        ]
      },
      {
        name: 'health-treatment',
        description: '治疗管理',
        actions: [
          'create_treatment_record',
          'update_treatment_record',
          'get_treatment_record_detail',
          'submit_treatment_plan',
          'update_treatment_progress',
          'complete_treatment_as_cured',
          'complete_treatment_as_died',
          'get_ongoing_treatments',
          'add_treatment_note',
          'add_treatment_medication',
          'update_treatment_plan',
          'calculate_treatment_cost',
          'calculate_batch_treatment_costs',
          'get_treatment_history',
          'get_treatment_detail',
          'create_treatment_from_diagnosis',
          'create_treatment_from_abnormal',
          'create_treatment_from_vaccine',
          'fix_treatment_records_openid'
        ]
      },
      {
        name: 'health-death',
        description: '死亡记录管理',
        actions: [
          'create_death_record',
          'createDeathRecord',
          'list_death_records',
          'listDeathRecords',
          'get_death_stats',
          'getDeathStats',
          'get_death_record_detail',
          'create_death_record_with_finance',
          'correct_death_diagnosis',
          'create_death_from_vaccine',
          'get_death_records_list',
          'fix_batch_death_count'
        ]
      }
    ]
  },
  'user-management': {
    targets: [
      {
        name: 'user-core',
        description: '用户核心功能',
        actions: [
          'create_user',
          'update_user',
          'get_user_info',
          'delete_user',
          'update_avatar',
          'get_user_profile',
          'update_user_settings'
        ]
      },
      {
        name: 'user-permission',
        description: '权限管理',
        actions: [
          'assign_role',
          'check_permission',
          'get_user_permissions',
          'update_permissions',
          'get_role_list',
          'create_role',
          'update_role'
        ]
      }
    ]
  }
};

// 生成新云函数的index.js模板
function generateCloudFunctionTemplate(name, description, actions) {
  return `/**
 * ${name} 云函数
 * ${description}
 * 
 * 拆分自大型云函数，遵循单一职责原则
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 导入业务逻辑处理函数
${actions.map(action => `const ${action} = require('./actions/${action}').main`).join('\n')}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  console.log('[${name}] 执行action:', action)
  
  try {
    switch (action) {
${actions.map(action => `      case '${action}':\n        return await ${action}(event, wxContext)`).join('\n')}
      
      default:
        return {
          success: false,
          error: \`不支持的操作: \${action}\`
        }
    }
  } catch (error) {
    console.error('[${name}] 执行失败:', error)
    return {
      success: false,
      error: error.message || '执行失败'
    }
  }
}
`;
}

// 生成action处理文件模板
function generateActionTemplate(actionName) {
  return `/**
 * ${actionName} 处理函数
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 主处理函数
 */
exports.main = async (event, wxContext) => {
  try {
    // TODO: 从原云函数迁移具体业务逻辑
    
    return {
      success: true,
      data: {
        message: '${actionName} executed successfully'
      }
    }
  } catch (error) {
    console.error('[${actionName}] 错误:', error)
    throw error
  }
}
`;
}

// 生成package.json
function generatePackageJson(name, description) {
  return {
    name: name,
    version: '1.0.0',
    description: description,
    main: 'index.js',
    dependencies: {
      'wx-server-sdk': 'latest'
    },
    config: {
      timeout: 20,
      memory: 128
    }
  };
}

// 生成前端调用适配器
function generateFrontendAdapter() {
  const adapterCode = `/**
 * 云函数调用适配器
 * 自动路由到新的拆分云函数
 */

// 云函数action映射表
const ACTION_FUNCTION_MAP = {
${Object.entries(REFACTORING_MAP).flatMap(([source, config]) => 
  config.targets.flatMap(target => 
    target.actions.map(action => `  '${action}': '${target.name}'`)
  )
).join(',\n')}
};

/**
 * 智能云函数调用
 * 自动路由到正确的云函数
 */
export async function smartCloudCall(action: string, data: any = {}) {
  const targetFunction = ACTION_FUNCTION_MAP[action]
  
  if (!targetFunction) {
    // 兼容旧调用方式
    console.warn(\`Action "\${action}" 未找到映射，使用默认云函数\`)
    return await safeCloudCall({
      name: 'health-management',
      data: { action, ...data }
    })
  }
  
  // 调用新的拆分云函数
  return await safeCloudCall({
    name: targetFunction,
    data: { action, ...data }
  })
}

// 批量替换工具函数
export function migrateCloudCalls() {
  // 在开发工具中运行，批量替换云函数调用
  console.log('开始迁移云函数调用...')
  console.log('将 safeCloudCall({name: "health-management", ...}) 替换为 smartCloudCall(action, ...)')
}
`;
  
  return adapterCode;
}

// 创建云函数目录结构
function createCloudFunctionStructure(basePath, name, description, actions) {
  const funcPath = path.join(basePath, name);
  
  // 创建目录
  if (!fs.existsSync(funcPath)) {
    fs.mkdirSync(funcPath, { recursive: true });
  }
  
  const actionsPath = path.join(funcPath, 'actions');
  if (!fs.existsSync(actionsPath)) {
    fs.mkdirSync(actionsPath, { recursive: true });
  }
  
  // 生成index.js
  fs.writeFileSync(
    path.join(funcPath, 'index.js'),
    generateCloudFunctionTemplate(name, description, actions)
  );
  
  // 生成package.json
  fs.writeFileSync(
    path.join(funcPath, 'package.json'),
    JSON.stringify(generatePackageJson(name, description), null, 2)
  );
  
  // 复制collections.js（如果存在）
  const collectionsSource = path.join(basePath, 'health-management', 'collections.js');
  if (fs.existsSync(collectionsSource)) {
    fs.copyFileSync(collectionsSource, path.join(funcPath, 'collections.js'));
  }
  
  // 为每个action生成模板文件
  actions.forEach(action => {
    const actionFile = path.join(actionsPath, `${action}.js`);
    if (!fs.existsSync(actionFile)) {
      fs.writeFileSync(actionFile, generateActionTemplate(action));
    }
  });
  
  console.log(`✅ 创建云函数: ${name} (${actions.length}个action)`);
}

// 主函数
function main() {
  console.log('========================================');
  console.log('云函数重构自动化脚本');
  console.log('========================================\n');
  
  const cloudfunctionsPath = path.join(__dirname, '..', 'cloudfunctions');
  
  // 统计信息
  let totalNewFunctions = 0;
  let totalActions = 0;
  
  // 遍历需要拆分的云函数
  Object.entries(REFACTORING_MAP).forEach(([source, config]) => {
    console.log(`\n📦 处理 ${source} 拆分...`);
    
    config.targets.forEach(target => {
      createCloudFunctionStructure(
        cloudfunctionsPath,
        target.name,
        target.description,
        target.actions
      );
      
      totalNewFunctions++;
      totalActions += target.actions.length;
    });
  });
  
  // 生成前端适配器
  const adapterPath = path.join(__dirname, '..', 'miniprogram', 'utils', 'cloud-adapter.ts');
  fs.writeFileSync(adapterPath, generateFrontendAdapter());
  console.log('\n✅ 生成前端适配器: miniprogram/utils/cloud-adapter.ts');
  
  // 生成迁移报告
  console.log('\n========================================');
  console.log('重构完成统计');
  console.log('========================================');
  console.log(`新建云函数: ${totalNewFunctions}个`);
  console.log(`迁移action: ${totalActions}个`);
  console.log(`平均每个云函数: ${Math.round(totalActions / totalNewFunctions)}个action`);
  
  console.log('\n下一步操作:');
  console.log('1. 将具体业务逻辑从原云函数迁移到对应的action文件');
  console.log('2. 测试每个action确保功能正常');
  console.log('3. 更新前端调用，使用smartCloudCall');
  console.log('4. 部署新云函数到云端');
  console.log('5. 灰度切换和监控');
  
  console.log('\n⚠️ 注意事项:');
  console.log('- 保持数据格式兼容');
  console.log('- 保留原有权限验证');
  console.log('- 确保错误处理一致');
  console.log('- 不要删除原云函数，保持并行运行');
}

// 执行
main();
