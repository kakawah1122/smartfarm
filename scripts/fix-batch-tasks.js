/**
 * 为现有批次补充任务的脚本
 * 使用方法：
 * 1. 打开微信开发者工具
 * 2. 点击"云开发" → "云函数" → "production-entry" → "测试"
 * 3. 复制下面的测试数据到"云函数测试参数"中
 * 4. 点击"测试"按钮
 */

// ========== 步骤1：查询活跃批次 ==========
// 在云开发控制台执行（数据库 → 查询）：
const queryBatches = `
// 查询活跃批次
db.collection('prod_batch_entries')
  .where({
    status: 'active',
    isDeleted: _.neq(true)
  })
  .field({
    _id: true,
    batchNumber: true,
    entryDate: true,
    quantity: true
  })
  .get()
`

// ========== 步骤2：为批次修复任务 ==========
// 在云函数测试中使用：

// 单个批次修复（将 YOUR_BATCH_ID 替换为实际批次ID）
const singleBatchTest = {
  "action": "fixBatchTasks",
  "batchId": "YOUR_BATCH_ID"
}

// 示例：
const exampleTest = {
  "action": "fixBatchTasks",
  "batchId": "abc123def456"  // 替换为实际批次ID
}

// ========== 步骤3：验证任务创建 ==========
// 在云开发控制台执行（数据库 → 查询）：
const verifyTasks = `
// 验证任务是否创建成功
db.collection('task_batch_schedules')
  .where({
    batchId: 'YOUR_BATCH_ID',  // 替换为实际批次ID
    completed: false
  })
  .orderBy('targetDate', 'asc')
  .get()
`

// ========== 批量修复所有批次 ==========
// 如果需要为所有活跃批次修复任务，可以在云开发控制台的"云函数控制台"中执行：
const batchFixScript = `
// 警告：此脚本会为所有活跃批次重新创建任务，请谨慎使用
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  
  // 查询所有活跃批次
  const batchesResult = await db.collection('prod_batch_entries')
    .where({
      status: 'active',
      isDeleted: _.neq(true)
    })
    .field({
      _id: true,
      batchNumber: true
    })
    .get()
  
  const batches = batchesResult.data || []
  console.log('找到活跃批次:', batches.length, '个')
  
  const results = []
  
  // 为每个批次修复任务
  for (const batch of batches) {
    try {
      const result = await cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'fixBatchTasks',
          batchId: batch._id
        }
      })
      
      console.log('批次', batch.batchNumber, '修复结果:', result.result)
      results.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        success: result.result.success,
        message: result.result.message
      })
    } catch (error) {
      console.error('批次', batch.batchNumber, '修复失败:', error)
      results.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        success: false,
        error: error.message
      })
    }
  }
  
  return {
    total: batches.length,
    results: results
  }
}
`

/**
 * 详细操作步骤：
 * 
 * 一、查询批次ID
 * 1. 打开微信开发者工具
 * 2. 点击"云开发"
 * 3. 点击"数据库"
 * 4. 选择 prod_batch_entries 集合
 * 5. 点击"查询"，输入：
 *    {
 *      "status": "active"
 *    }
 * 6. 记录批次的 _id 字段（例如：abc123def456）
 * 
 * 二、修复单个批次任务
 * 1. 点击"云开发" → "云函数"
 * 2. 选择 production-entry 云函数
 * 3. 点击右上角"测试"按钮
 * 4. 在"云函数测试参数"中输入：
 *    {
 *      "action": "fixBatchTasks",
 *      "batchId": "abc123def456"
 *    }
 *    （将 abc123def456 替换为实际的批次ID）
 * 5. 点击"测试"按钮
 * 6. 查看返回结果，应该显示：
 *    {
 *      "success": true,
 *      "data": {
 *        "batchId": "abc123def456",
 *        "batchNumber": "E251103001",
 *        "oldTaskCount": 0,
 *        "newTaskCount": 50
 *      },
 *      "message": "批次 E251103001 任务修复成功，共创建 50 个任务"
 *    }
 * 
 * 三、验证任务创建
 * 1. 返回"数据库"
 * 2. 选择 task_batch_schedules 集合
 * 3. 点击"查询"，输入：
 *    {
 *      "batchId": "abc123def456",
 *      "completed": false
 *    }
 * 4. 应该能看到新创建的任务
 * 
 * 四、在小程序中查看
 * 1. 重新编译小程序
 * 2. 进入"健康管理"页面
 * 3. 点击"预防管理" → "进行中"
 * 4. 应该能看到今日任务
 */

module.exports = {
  queryBatches,
  singleBatchTest,
  exampleTest,
  verifyTasks,
  batchFixScript
}

