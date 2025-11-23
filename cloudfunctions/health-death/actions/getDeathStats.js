/**
 * getDeathStats 处理函数（向后兼容）
 * 复用 get_death_stats 的逻辑
 */

const getDeathStats = require('./get_death_stats')

/**
 * 主处理函数
 */
exports.main = getDeathStats.main
