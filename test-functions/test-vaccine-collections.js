// 测试疫苗接种功能数据库集合
// 可以在云函数中运行此代码来验证集合创建

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const testResults = []
  
  // 测试集合列表
  const collections = [
    'prevention_records',
    'finance_records', 
    'overview_stats'
  ]
  
  for (const collection of collections) {
    try {
      // 尝试查询集合（不获取数据，只检查访问权限）
      await db.collection(collection).limit(1).get()
      testResults.push({
        collection,
        status: 'success',
        message: `✅ ${collection} 集合可访问`
      })
    } catch (error) {
      testResults.push({
        collection,
        status: 'error', 
        message: `❌ ${collection} 集合访问失败: ${error.message}`
      })
    }
  }
  
  // 测试写入权限（插入测试数据）
  try {
    const testRecord = {
      test: true,
      createdAt: new Date(),
      message: '这是测试数据，创建成功后可以删除'
    }
    
    await db.collection('prevention_records').add({
      data: testRecord
    })
    
    testResults.push({
      collection: 'prevention_records',
      status: 'success',
      message: '✅ prevention_records 写入权限正常'
    })
  } catch (error) {
    testResults.push({
      collection: 'prevention_records', 
      status: 'error',
      message: `❌ prevention_records 写入失败: ${error.message}`
    })
  }
  
  return {
    success: testResults.every(r => r.status === 'success'),
    results: testResults,
    summary: `${testResults.filter(r => r.status === 'success').length}/${testResults.length} 项测试通过`
  }
}
