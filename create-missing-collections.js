// 单独创建缺失集合的脚本
// 在微信开发者工具控制台中运行

const createMissingCollections = async () => {
  const db = wx.cloud.database()
  
  const collections = [
    {
      name: 'finance_records',
      testData: {
        type: 'expense',
        category: 'medical', 
        subCategory: 'vaccine',
        title: '测试财务记录',
        amount: 100,
        batchId: 'test_batch',
        date: '2024-01-01',
        createdAt: new Date(),
        _test: true
      }
    },
    {
      name: 'overview_stats',
      testData: {
        batchId: 'test_batch',
        month: '2024-01',
        prevention: { completed: 0, scheduled: 0, overdue: 0 },
        health: { healthy: 0, sick: 0, treated: 0 },
        finance: { income: 0, expense: 0, profit: 0 },
        production: { eggs: 0, weight: 0, mortality: 0 },
        lastUpdated: new Date(),
        _test: true
      }
    }
  ]
  
  console.log('🚀 开始创建缺失的集合...')
  
  for (const collection of collections) {
    try {
      console.log(`🔄 创建集合: ${collection.name}`)
      
      const result = await db.collection(collection.name).add({
        data: collection.testData
      })
      
      console.log(`✅ ${collection.name} 创建成功，ID: ${result._id}`)
      
    } catch (error) {
      if (error.message.includes('exists')) {
        console.log(`ℹ️ ${collection.name} 已存在`)
      } else {
        console.error(`❌ ${collection.name} 创建失败:`, error.message)
      }
    }
  }
  
  console.log('🎉 缺失集合创建完成！')
}

// 调用函数
createMissingCollections()
