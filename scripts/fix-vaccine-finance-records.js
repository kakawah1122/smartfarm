/**
 * 修复脚本：为已存在的疫苗接种记录创建缺失的财务记录
 * 
 * 问题背景：
 * 部分疫苗接种记录已创建，但由于缺少shouldSyncToFinance标记，
 * 导致对应的财务记录没有生成。此脚本用于修复这些历史数据。
 * 
 * 使用方法：
 * 1. 在微信开发者工具的云开发控制台中运行
 * 2. 或创建一个临时的云函数来执行此脚本
 * 
 * @author AI Assistant
 * @date 2025-11-17
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 集合名称（请根据实际情况调整）
const COLLECTIONS = {
  HEALTH_PREVENTION_RECORDS: 'health_prevention_records',
  FINANCE_COST_RECORDS: 'finance_cost_records'
};

/**
 * 修复缺失的疫苗财务记录
 */
async function fixVaccineFinanceRecords() {
  console.log('开始修复疫苗接种财务记录...');
  
  try {
    // 1. 查询所有疫苗接种记录
    const preventionResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where({
        preventionType: 'vaccine',
        isDeleted: _.neq(true),
        'costInfo.totalCost': _.gt(0)  // 有费用的记录
      })
      .limit(1000)  // 分批处理，避免超时
      .get();
    
    console.log(`找到 ${preventionResult.data.length} 条疫苗接种记录`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 2. 遍历每条记录，检查是否有对应的财务记录
    for (const prevention of preventionResult.data) {
      try {
        // 检查是否已存在对应的财务记录
        const financeCheck = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
          .where({
            relatedRecordId: prevention._id
          })
          .count();
        
        if (financeCheck.total > 0) {
          skippedCount++;
          console.log(`记录 ${prevention._id} 已有财务记录，跳过`);
          continue;
        }
        
        // 3. 创建缺失的财务记录
        const financeRecord = {
          recordId: 'FIX_VAC' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
          farmId: prevention.farmId || '',
          batchId: prevention.batchId,
          category: 'vaccine',
          costType: 'health',
          amount: prevention.costInfo.totalCost,
          costDate: prevention.preventionDate || prevention.actualDate,
          description: `疫苗接种 - ${prevention.vaccineInfo?.name || '未知疫苗'}（数据修复）`,
          relatedRecordId: prevention._id,
          details: {
            vaccineName: prevention.vaccineInfo?.name,
            vaccineCost: prevention.costInfo?.vaccineCost || 0,
            veterinaryCost: prevention.costInfo?.veterinaryCost || prevention.costInfo?.laborCost || 0,
            otherCost: prevention.costInfo?.otherCost || 0,
            source: 'data_fix'
          },
          userId: prevention.operator || prevention._openid,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          _openid: prevention._openid || prevention.operator,
          dataFix: true,  // 标记为数据修复创建
          fixedAt: new Date().toISOString()
        };
        
        await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({
          data: financeRecord
        });
        
        fixedCount++;
        console.log(`✅ 为记录 ${prevention._id} 创建财务记录成功`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ 处理记录 ${prevention._id} 时出错:`, error);
      }
    }
    
    // 4. 输出修复结果
    console.log('========== 修复完成 ==========');
    console.log(`总记录数: ${preventionResult.data.length}`);
    console.log(`修复成功: ${fixedCount} 条`);
    console.log(`已存在（跳过）: ${skippedCount} 条`);
    console.log(`修复失败: ${errorCount} 条`);
    console.log('==============================');
    
    return {
      success: true,
      total: preventionResult.data.length,
      fixed: fixedCount,
      skipped: skippedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('修复脚本执行失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行修复
exports.main = async (event, context) => {
  return await fixVaccineFinanceRecords();
};

// 如果是直接运行（非云函数环境）
if (require.main === module) {
  fixVaccineFinanceRecords()
    .then(result => {
      console.log('修复结果:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('修复失败:', error);
      process.exit(1);
    });
}
