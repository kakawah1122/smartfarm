// 初始化 task_templates 集合
// 在云开发控制台的数据库页面执行此脚本，或通过云函数执行

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function initTaskTemplatesCollection() {
  try {
    // 创建集合（如果不存在）
    const collectionName = 'task_templates'
    
    // 尝试获取集合信息
    try {
      await db.collection(collectionName).count()
      console.log(`集合 ${collectionName} 已存在`)
    } catch (error) {
      // 集合不存在，创建它
      console.log(`创建集合 ${collectionName}...`)
      
      // 注意：在实际使用中，需要在云开发控制台手动创建集合
      // 这里只是添加一条初始记录来创建集合
      await db.collection(collectionName).add({
        data: {
          _openid: 'system',
          templateName: '__init__',
          description: '初始化记录',
          tasks: [],
          isDeleted: true,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      console.log(`集合 ${collectionName} 创建成功`)
    }
    
    return {
      success: true,
      message: '集合初始化成功'
    }
  } catch (error) {
    console.error('初始化集合失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 如果作为云函数执行
exports.main = async (event, context) => {
  return await initTaskTemplatesCollection()
}

// 如果作为脚本执行
if (require.main === module) {
  initTaskTemplatesCollection().then(result => {
    console.log('执行结果:', result)
  })
}
