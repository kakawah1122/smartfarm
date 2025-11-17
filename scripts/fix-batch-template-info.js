// 修复批次模板信息的脚本
// 为所有缺少 templateId 的批次添加默认模板信息

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function fixBatchTemplateInfo() {
  try {
    console.log('开始修复批次模板信息...')
    
    // 查询所有没有 templateId 的批次
    const result = await db.collection('prod_batch_entries')
      .where({
        templateId: db.command.exists(false)
      })
      .get()
    
    console.log(`找到 ${result.data.length} 个需要修复的批次`)
    
    // 逐个更新
    for (const batch of result.data) {
      await db.collection('prod_batch_entries')
        .doc(batch._id)
        .update({
          data: {
            templateId: 'default',
            templateName: '默认模板',
            updateTime: new Date()
          }
        })
      
      console.log(`已修复批次: ${batch.batchNumber}`)
    }
    
    console.log('修复完成！')
    return {
      success: true,
      count: result.data.length
    }
  } catch (error) {
    console.error('修复失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出供云函数调用
exports.main = async (event, context) => {
  return await fixBatchTemplateInfo()
}
