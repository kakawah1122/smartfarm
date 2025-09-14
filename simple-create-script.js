// 最简单的集合创建脚本 - 在开发者工具控制台直接运行

// 第一步：检查错误详情
wx.cloud.callFunction({
  name: 'create-collections'
}).then(res => {
  console.log('📊 详细结果:', res.result.results)
  
  // 显示每个集合的具体错误
  res.result.results.forEach(result => {
    if (!result.success) {
      console.error(`❌ ${result.collection} 失败原因:`, result.error)
    }
  })
}).catch(err => {
  console.error('❌ 云函数调用失败:', err)
})

// 第二步：手动创建失败的集合
const createSingleCollection = async (collectionName, testData) => {
  try {
    console.log(`🔄 手动创建 ${collectionName}...`)
    
    const result = await wx.cloud.database().collection(collectionName).add({
      data: testData
    })
    
    console.log(`✅ ${collectionName} 手动创建成功！ID: ${result._id}`)
    return true
    
  } catch (error) {
    console.error(`❌ ${collectionName} 手动创建失败:`, error.message)
    return false
  }
}

// 第三步：逐个创建失败的集合
const createFailedCollections = async () => {
  console.log('🚀 开始手动创建失败的集合...')
  
  // 创建 finance_records
  await createSingleCollection('finance_records', {
    type: 'expense',
    category: 'medical',
    title: '手动测试记录',
    amount: 50,
    date: '2024-01-01',
    createdAt: new Date(),
    _test: true,
    note: '手动创建的测试数据'
  })
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // 创建 overview_stats
  await createSingleCollection('overview_stats', {
    batchId: 'manual_test',
    month: '2024-01',
    prevention: { completed: 0 },
    health: { healthy: 0 },
    finance: { income: 0, expense: 50 },
    production: { eggs: 0 },
    lastUpdated: new Date(),
    _test: true,
    note: '手动创建的测试数据'
  })
  
  console.log('🎉 手动创建完成！')
}

// 执行手动创建
// createFailedCollections()  // 取消注释这行来执行
