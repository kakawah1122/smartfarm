/**
 * 修复脚本：清理财务记录中的undefined描述
 * 
 * 执行方法：在云开发控制台运行
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function fixUndefinedDescriptions() {
  console.log('开始修复undefined描述...');
  
  try {
    // 查找包含undefined的记录
    const result = await db.collection('finance_cost_records')
      .where({
        description: _.or(
          /undefined/,
          /预防任务：undefined/
        )
      })
      .limit(1000)
      .get();
    
    console.log(`找到 ${result.data.length} 条需要修复的记录`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of result.data) {
      try {
        let newDescription = record.description;
        
        // 根据category判断类型并修复描述
        if (record.category === 'vaccine') {
          // 疫苗记录
          newDescription = '疫苗接种 - 疫苗费用';
        } else if (record.category === 'disinfection') {
          // 消毒记录
          newDescription = '消毒管理 - 消毒费用';
        } else if (record.category === 'medicine') {
          // 药品记录
          newDescription = '医疗费用 - 药品费用';
        } else if (record.costType === 'health') {
          // 健康相关
          newDescription = '医疗费用 - 健康管理';
        } else {
          // 其他情况，移除undefined
          newDescription = record.description
            .replace('预防任务：undefined', '健康管理费用')
            .replace('undefined', '')
            .trim();
        }
        
        // 更新记录
        await db.collection('finance_cost_records')
          .doc(record._id)
          .update({
            data: {
              description: newDescription
            }
          });
        
        successCount++;
        console.log(`✅ 修复记录 ${record._id}: ${newDescription}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ 修复失败 ${record._id}:`, error.message);
      }
    }
    
    console.log('========== 修复完成 ==========');
    console.log(`成功修复: ${successCount} 条`);
    console.log(`修复失败: ${errorCount} 条`);
    
    return {
      success: true,
      fixed: successCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('修复脚本执行失败:', error);
    return { success: false, error: error.message };
  }
}

// 云函数入口
exports.main = async (event, context) => {
  return await fixUndefinedDescriptions();
};

// 本地执行
if (require.main === module) {
  fixUndefinedDescriptions()
    .then(result => console.log('结果:', result))
    .catch(error => console.error('错误:', error));
}
