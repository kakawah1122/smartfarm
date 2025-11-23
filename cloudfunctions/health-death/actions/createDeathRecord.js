/**
 * createDeathRecord 处理函数（向后兼容）
 * 复用 create_death_record 的逻辑
 */

const createDeathRecord = require('./create_death_record')

/**
 * 主处理函数
 */
exports.main = createDeathRecord.main
