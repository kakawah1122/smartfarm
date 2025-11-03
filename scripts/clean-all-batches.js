/**
 * 清理所有批次数据脚本
 * ⚠️ 警告：此操作会删除所有批次相关数据，请谨慎使用！
 * 
 * 使用方法：
 * 1. 打开微信开发者工具
 * 2. 点击"云开发" → "数据库" → "高级操作"
 * 3. 复制下面的代码到控制台执行
 */

// ========== 方案一：软删除（推荐，可恢复）⭐ ==========
// 将所有批次标记为已删除，数据仍保留在数据库中

const softDeleteAllBatches = async () => {
  const db = cloud.database()
  const _ = db.command
  const now = new Date()
  
  console.log('========== 开始软删除所有批次数据 ==========')
  
  // 1. 软删除入栏记录
  const entryResult = await db.collection('prod_batch_entries')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now,
        status: 'deleted'
      }
    })
  console.log('✅ 入栏记录已软删除:', entryResult.stats.updated, '条')
  
  // 2. 软删除批次信息
  const batchResult = await db.collection('production_batches')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now,
        status: 'deleted'
      }
    })
  console.log('✅ 批次信息已软删除:', batchResult.stats.updated, '条')
  
  // 3. 删除任务（直接删除，任务没有恢复的必要）
  const taskResult = await db.collection('task_batch_schedules')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 任务已删除:', taskResult.stats.removed, '条')
  
  // 4. 软删除健康记录
  const healthResult = await db.collection('health_records')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now
      }
    })
  console.log('✅ 健康记录已软删除:', healthResult.stats.updated, '条')
  
  // 5. 软删除预防记录
  const preventionResult = await db.collection('health_prevention_records')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now
      }
    })
  console.log('✅ 预防记录已软删除:', preventionResult.stats.updated, '条')
  
  // 6. 软删除治疗记录
  const treatmentResult = await db.collection('health_treatment_records')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now
      }
    })
  console.log('✅ 治疗记录已软删除:', treatmentResult.stats.updated, '条')
  
  // 7. 软删除死亡记录
  const deathResult = await db.collection('health_death_records')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now
      }
    })
  console.log('✅ 死亡记录已软删除:', deathResult.stats.updated, '条')
  
  // 8. 软删除出栏记录
  const exitResult = await db.collection('prod_batch_exits')
    .where({
      isDeleted: _.neq(true)
    })
    .update({
      data: {
        isDeleted: true,
        deletedAt: now
      }
    })
  console.log('✅ 出栏记录已软删除:', exitResult.stats.updated, '条')
  
  console.log('========== 软删除完成 ==========')
  console.log('💡 提示：数据仍保留在数据库中，如需恢复可将 isDeleted 改为 false')
  
  return {
    success: true,
    deletedCounts: {
      entries: entryResult.stats.updated,
      batches: batchResult.stats.updated,
      tasks: taskResult.stats.removed,
      healthRecords: healthResult.stats.updated,
      preventionRecords: preventionResult.stats.updated,
      treatmentRecords: treatmentResult.stats.updated,
      deathRecords: deathResult.stats.updated,
      exitRecords: exitResult.stats.updated
    }
  }
}

// ========== 方案二：硬删除（彻底删除，不可恢复）⚠️ ==========
// 完全删除所有批次相关数据

const hardDeleteAllBatches = async () => {
  const db = cloud.database()
  const _ = db.command
  
  console.log('========== 开始硬删除所有批次数据 ==========')
  console.log('⚠️ 警告：此操作不可恢复！')
  
  // 1. 删除入栏记录
  const entryResult = await db.collection('prod_batch_entries')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 入栏记录已删除:', entryResult.stats.removed, '条')
  
  // 2. 删除批次信息
  const batchResult = await db.collection('production_batches')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 批次信息已删除:', batchResult.stats.removed, '条')
  
  // 3. 删除任务
  const taskResult = await db.collection('task_batch_schedules')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 任务已删除:', taskResult.stats.removed, '条')
  
  // 4. 删除健康记录
  const healthResult = await db.collection('health_records')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 健康记录已删除:', healthResult.stats.removed, '条')
  
  // 5. 删除预防记录
  const preventionResult = await db.collection('health_prevention_records')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 预防记录已删除:', preventionResult.stats.removed, '条')
  
  // 6. 删除治疗记录
  const treatmentResult = await db.collection('health_treatment_records')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 治疗记录已删除:', treatmentResult.stats.removed, '条')
  
  // 7. 删除死亡记录
  const deathResult = await db.collection('health_death_records')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 死亡记录已删除:', deathResult.stats.removed, '条')
  
  // 8. 删除出栏记录
  const exitResult = await db.collection('prod_batch_exits')
    .where({
      _id: _.exists(true)
    })
    .remove()
  console.log('✅ 出栏记录已删除:', exitResult.stats.removed, '条')
  
  console.log('========== 硬删除完成 ==========')
  console.log('⚠️ 警告：数据已彻底删除，无法恢复！')
  
  return {
    success: true,
    deletedCounts: {
      entries: entryResult.stats.removed,
      batches: batchResult.stats.removed,
      tasks: taskResult.stats.removed,
      healthRecords: healthResult.stats.removed,
      preventionRecords: preventionResult.stats.removed,
      treatmentRecords: treatmentResult.stats.removed,
      deathRecords: deathResult.stats.removed,
      exitRecords: exitResult.stats.removed
    }
  }
}

// ========== 验证清理结果 ==========
const verifyCleanup = async () => {
  const db = cloud.database()
  const _ = db.command
  
  console.log('========== 验证清理结果 ==========')
  
  // 检查各集合的活跃数据数量
  const collections = [
    'prod_batch_entries',
    'production_batches',
    'task_batch_schedules',
    'health_records',
    'health_prevention_records',
    'health_treatment_records',
    'health_death_records',
    'prod_batch_exits'
  ]
  
  for (const collectionName of collections) {
    const result = await db.collection(collectionName)
      .where({
        isDeleted: _.neq(true)
      })
      .count()
    console.log(`${collectionName}: ${result.total} 条活跃数据`)
  }
  
  console.log('========== 验证完成 ==========')
}

/**
 * ========== 详细操作步骤 ==========
 * 
 * 方案一：软删除（推荐）
 * 
 * 1. 打开微信开发者工具
 * 2. 点击"云开发" → "数据库" → "高级操作"
 * 3. 在控制台中执行以下代码：
 * 
 * const cloud = require('wx-server-sdk')
 * cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
 * const db = cloud.database()
 * const _ = db.command
 * 
 * // 复制上面的 softDeleteAllBatches 函数代码
 * 
 * // 执行软删除
 * softDeleteAllBatches().then(result => {
 *   console.log('清理完成:', result)
 * })
 * 
 * 4. 等待执行完成
 * 5. 验证结果（可选）：
 * 
 * // 复制上面的 verifyCleanup 函数代码
 * verifyCleanup()
 * 
 * ===================================
 * 
 * 方案二：硬删除（不推荐，仅在确认数据无用时使用）
 * 
 * ⚠️ 警告：此操作会彻底删除数据，无法恢复！
 * 
 * 1. 确认你真的要彻底删除所有数据
 * 2. 按照方案一的步骤，但执行 hardDeleteAllBatches 函数
 * 
 * // 执行硬删除
 * hardDeleteAllBatches().then(result => {
 *   console.log('清理完成:', result)
 * })
 * 
 * ===================================
 * 
 * 简化版操作（直接在数据库控制台执行）：
 * 
 * 1. 点击"云开发" → "数据库"
 * 2. 对每个集合执行以下操作：
 *    - 选择集合（如 prod_batch_entries）
 *    - 点击"高级操作"
 *    - 选择"删除"
 *    - 选择"删除全部数据"
 *    - 确认删除
 * 
 * 需要清理的集合：
 * ✅ prod_batch_entries (入栏记录)
 * ✅ production_batches (批次信息)
 * ✅ task_batch_schedules (任务)
 * ✅ health_records (健康记录)
 * ✅ health_prevention_records (预防记录)
 * ✅ health_treatment_records (治疗记录)
 * ✅ health_death_records (死亡记录)
 * ✅ prod_batch_exits (出栏记录)
 * 
 * ===================================
 * 
 * 清理后，重新创建批次：
 * 
 * 1. 在小程序中打开"生产管理"
 * 2. 点击"新增入栏记录"
 * 3. 填写批次信息：
 *    - 批次编号：自动生成或手动输入
 *    - 入栏日期：选择日期
 *    - 入栏数量：填写数量
 *    - 品种：选择品种
 *    - 来源：填写来源
 *    - 单价：填写单价
 * 4. 点击"保存"
 * 5. 系统会自动：
 *    ✅ 创建批次记录
 *    ✅ 生成健康检查任务
 *    ✅ 生成预防管理任务（疫苗、用药等）
 * 6. 进入"健康管理" → "预防管理" → "进行中"
 * 7. 应该能看到今日任务了！
 */

module.exports = {
  softDeleteAllBatches,
  hardDeleteAllBatches,
  verifyCleanup
}

