// 简单的集合创建脚本
// 在微信开发者工具控制台中运行此代码

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function createCollections() {
  const collections = [
    'prevention_records',
    'finance_records', 
    'overview_stats'
  ]
  
  console.log('开始创建数据库集合...')
  
  for (const collectionName of collections) {
    try {
      // 尝试向集合中添加一条测试数据，如果集合不存在会自动创建
      await db.collection(collectionName).add({
        data: {
          _test: true,
          created: new Date(),
          note: '测试数据，可删除'
        }
      })
      console.log(`✅ ${collectionName} 集合创建成功`)
    } catch (error) {
      console.error(`❌ ${collectionName} 创建失败:`, error.message)
    }
  }
  
  console.log('集合创建完成！')
}

// 导出供云函数使用
exports.main = async (event, context) => {
  return await createCollections()
}
