/**
 * 数据库查询工具函数
 * 统一处理数据库查询条件，确保索引性能最优
 */

/**
 * 构建未删除记录的查询条件
 * 
 * 说明：
 * - 直接使用 `isDeleted: false` 可以获得最佳索引性能
 * - 避免使用 `isDeleted: _.neq(true)`，因为 neq 操作符无法高效使用索引
 * - 如果历史数据可能有 undefined，使用 `_.in([false, undefined])` 代替
 * 
 * @param db - 数据库实例
 * @param strictMode - 严格模式：只查询 isDeleted === false 的记录（推荐，性能最佳）
 *                     非严格模式：兼容 undefined 值（兼容历史数据）
 * @returns 查询条件对象
 * 
 * @example
 * ```typescript
 * const db = wx.cloud.database()
 * const _ = db.command
 * 
 * // 推荐用法：严格模式，索引完全生效
 * const query = db.collection('health_death_records')
 *   .where({
 *     batchId: 'xxx',
 *     ...buildNotDeletedCondition(db, true)
 *   })
 *   .get()
 * 
 * // 兼容模式：如果历史数据可能有 undefined
 * const query = db.collection('health_death_records')
 *   .where({
 *     batchId: 'xxx',
 *     ...buildNotDeletedCondition(db, false)
 *   })
 *   .get()
 * ```
 */
export function buildNotDeletedCondition(db: any, strictMode: boolean = true): { isDeleted: any } {
  const _ = db.command
  
  if (strictMode) {
    // ✅ 推荐：直接使用 false，索引完全生效，性能最佳
    return { isDeleted: false }
  } else {
    // ⚠️ 兼容模式：如果历史数据可能有 undefined，使用 in 操作符
    // 注意：in 操作符比 eq 性能稍差，但比 neq 好得多
    return { isDeleted: _.in([false, undefined]) }
  }
}

/**
 * 构建基础查询条件（包含未删除条件）
 * 
 * @param db - 数据库实例
 * @param conditions - 额外的查询条件
 * @param strictMode - 是否使用严格模式（默认 true）
 * @returns 合并后的查询条件
 * 
 * @example
 * ```typescript
 * const db = wx.cloud.database()
 * 
 * const conditions = buildQueryConditions(db, {
 *   batchId: 'xxx',
 *   deathDate: _.lte('2025-10-31')
 * })
 * 
 * const result = await db.collection('health_death_records')
 *   .where(conditions)
 *   .get()
 * ```
 */
export function buildQueryConditions(
  db: any,
  conditions: Record<string, any> = {},
  strictMode: boolean = true
): Record<string, any> {
  return {
    ...conditions,
    ...buildNotDeletedCondition(db, strictMode)
  }
}

