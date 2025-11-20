const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 验证健康管理预防管理修复是否成功
 */
async function verifyHealthPreventionFix() {
  console.log('===============================================');
  console.log('开始验证健康管理预防管理修复');
  console.log('===============================================');
  
  try {
    // 1. 验证批次查询
    console.log('\n1. 验证批次查询（兼容 userId 和 _openid）');
    console.log('------------------------------------------------');
    
    // 查询只有 _openid 的批次
    const openidOnlyBatches = await db.collection('prod_batch_entries')
      .where({
        _openid: _.exists(true),
        userId: _.exists(false)
      })
      .limit(5)
      .get();
    
    console.log(`- 只有 _openid 的批次数量: ${openidOnlyBatches.data.length}`);
    
    // 查询只有 userId 的批次
    const userIdOnlyBatches = await db.collection('prod_batch_entries')
      .where({
        userId: _.exists(true),
        _openid: _.exists(false)
      })
      .limit(5)
      .get();
    
    console.log(`- 只有 userId 的批次数量: ${userIdOnlyBatches.data.length}`);
    
    // 查询两个字段都有的批次
    const bothFieldsBatches = await db.collection('prod_batch_entries')
      .where({
        userId: _.exists(true),
        _openid: _.exists(true)
      })
      .limit(5)
      .get();
    
    console.log(`- 两个字段都有的批次数量: ${bothFieldsBatches.data.length}`);
    
    // 2. 验证任务数据
    console.log('\n2. 验证任务数据');
    console.log('------------------------------------------------');
    
    // 获取活跃批次
    const activeBatches = await db.collection('prod_batch_entries')
      .where({
        isDeleted: _.neq(true),
        isArchived: _.neq(true)
      })
      .limit(10)
      .get();
    
    console.log(`- 活跃批次总数: ${activeBatches.data.length}`);
    
    // 检查每个批次的任务
    for (const batch of activeBatches.data.slice(0, 3)) {
      console.log(`\n批次 ${batch.batchNumber}:`);
      
      // 查询该批次的任务
      const tasks = await db.collection('task_batch_schedules')
        .where({
          batchId: batch._id,
          completed: false
        })
        .limit(5)
        .get();
      
      console.log(`  - 待完成任务数: ${tasks.data.length}`);
      
      // 显示任务标题
      if (tasks.data.length > 0) {
        console.log('  - 任务示例:');
        tasks.data.slice(0, 3).forEach(task => {
          const title = task.title || task.taskName || '未命名任务';
          const dayAge = task.dayAge || 0;
          console.log(`    * 第${dayAge}日龄: ${title}`);
        });
      }
    }
    
    // 3. 验证数据字段完整性
    console.log('\n3. 验证数据字段完整性');
    console.log('------------------------------------------------');
    
    // 检查任务字段
    const sampleTasks = await db.collection('task_batch_schedules')
      .limit(5)
      .get();
    
    let fieldsCheck = {
      hasTitle: 0,
      hasDescription: 0,
      hasType: 0,
      hasCategory: 0,
      hasDayAge: 0
    };
    
    sampleTasks.data.forEach(task => {
      if (task.title || task.taskName) fieldsCheck.hasTitle++;
      if (task.description || task.content) fieldsCheck.hasDescription++;
      if (task.type || task.taskType) fieldsCheck.hasType++;
      if (task.category) fieldsCheck.hasCategory++;
      if (task.dayAge !== undefined) fieldsCheck.hasDayAge++;
    });
    
    console.log('- 任务字段完整性:');
    console.log(`  * 有标题的任务: ${fieldsCheck.hasTitle}/${sampleTasks.data.length}`);
    console.log(`  * 有描述的任务: ${fieldsCheck.hasDescription}/${sampleTasks.data.length}`);
    console.log(`  * 有类型的任务: ${fieldsCheck.hasType}/${sampleTasks.data.length}`);
    console.log(`  * 有分类的任务: ${fieldsCheck.hasCategory}/${sampleTasks.data.length}`);
    console.log(`  * 有日龄的任务: ${fieldsCheck.hasDayAge}/${sampleTasks.data.length}`);
    
    // 4. 验证结果总结
    console.log('\n===============================================');
    console.log('验证结果总结');
    console.log('===============================================');
    
    const issues = [];
    
    if (openidOnlyBatches.data.length > 0) {
      issues.push('⚠️ 存在只有 _openid 字段的批次，建议运行修复函数');
    }
    
    if (fieldsCheck.hasTitle < sampleTasks.data.length) {
      issues.push('⚠️ 部分任务缺少标题字段');
    }
    
    if (fieldsCheck.hasDayAge < sampleTasks.data.length) {
      issues.push('⚠️ 部分任务缺少日龄字段');
    }
    
    if (issues.length === 0) {
      console.log('✅ 所有验证通过，系统运行正常！');
    } else {
      console.log('发现以下问题需要关注:');
      issues.forEach(issue => console.log(issue));
      console.log('\n建议：');
      console.log('1. 上传最新的 production-entry 云函数');
      console.log('2. 在健康管理页面会自动运行修复函数');
      console.log('3. 清理小程序缓存后重新进入页面');
    }
    
  } catch (error) {
    console.error('验证过程中出错:', error);
  }
}

// 执行验证
verifyHealthPreventionFix();
