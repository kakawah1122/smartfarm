/**
 * 紧急修复脚本：修复疫苗财务记录的字段格式
 * 
 * 问题：health-management创建的财务记录缺少costType字段，
 * 导致finance-management无法正确显示这些记录。
 * 
 * 执行方法：
 * 1. 在微信开发者工具的云开发控制台运行
 * 2. 或创建临时云函数执行
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

async function urgentFix() {
  console.log('开始紧急修复疫苗财务记录...');
  
  try {
    // 查找所有category为vaccine但没有costType的记录
    const result = await db.collection('finance_cost_records')
      .where({
        category: _.in(['vaccine', 'disinfection', 'medicine']),
        costType: _.exists(false)  // 缺少costType字段
      })
      .limit(1000)
      .get();
    
    console.log(`找到 ${result.data.length} 条需要修复的记录`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 修复每条记录
    for (const record of result.data) {
      try {
        await db.collection('finance_cost_records')
          .doc(record._id)
          .update({
            data: {
              costType: 'health',  // 设置为健康成本
              date: record.date || record.costDate || record.createTime || record.createdAt,
              createTime: record.createTime || new Date().toISOString()
            }
          });
        
        successCount++;
        console.log(`✅ 修复记录 ${record._id}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ 修复失败 ${record._id}:`, error.message);
      }
    }
    
    console.log('========== 修复完成 ==========');
    console.log(`成功修复: ${successCount} 条`);
    console.log(`修复失败: ${errorCount} 条`);
    
    // 验证修复结果
    const checkResult = await db.collection('finance_cost_records')
      .where({
        category: 'vaccine',
        costType: 'health'
      })
      .count();
    
    console.log(`验证：现有 ${checkResult.total} 条正确格式的疫苗财务记录`);
    
    return {
      success: true,
      fixed: successCount,
      errors: errorCount,
      totalVaccineRecords: checkResult.total
    };
    
  } catch (error) {
    console.error('修复脚本执行失败:', error);
    return { success: false, error: error.message };
  }
}

// 云函数入口
exports.main = async (event, context) => {
  return await urgentFix();
};

// 本地执行
if (require.main === module) {
  urgentFix()
    .then(result => console.log('结果:', result))
    .catch(error => console.error('错误:', error));
}
