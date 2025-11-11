// 统一的数据库集合名称配置
// 引用共享配置，补充AI学习案例集合
const { COLLECTIONS: SHARED_COLLECTIONS } = require('../../shared-config/collections.js')

const COLLECTIONS = {
  ...SHARED_COLLECTIONS,
  // AI学习案例集合（系统模块）
  AI_LEARNING_CASES: 'ai_learning_cases'
}

module.exports = {
  COLLECTIONS
}

