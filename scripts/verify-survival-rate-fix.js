/**
 * 验证存活率修复效果脚本
 * 用途：检查修复后的数据是否正确显示存活率
 * 
 * 使用方法：在微信开发者工具控制台运行
 */

console.log('========== 开始验证存活率修复效果 ==========\n')

// 1. 测试云函数返回的数据
wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'get_dashboard_snapshot',
    batchId: 'all'
  }
}).then(res => {
  console.log('✅ 云函数调用成功')
  const data = res.result.data
  
  console.log('\n【批次数据】')
  console.log(`总批次数: ${data.totalBatches}`)
  console.log(`原始入栏总数 (originalTotalQuantity): ${data.originalTotalQuantity}`)
  console.log(`当前存栏总数 (totalAnimals): ${data.totalAnimals}`)
  console.log(`死亡总数 (deadCount): ${data.deadCount}`)
  
  console.log('\n【计算指标】')
  console.log(`健康率: ${data.healthyRate}%`)
  console.log(`死亡率: ${data.mortalityRate}%`)
  
  // 计算存活率
  if (data.originalTotalQuantity > 0) {
    const survivalCount = data.originalTotalQuantity - data.deadCount
    const survivalRate = ((survivalCount / data.originalTotalQuantity) * 100).toFixed(1)
    console.log(`存活率（计算）: ${survivalRate}%`)
    console.log(`存活数量: ${survivalCount}`)
  } else {
    console.log('⚠️ 存活率: 无法计算（originalTotalQuantity 为 0）')
  }
  
  console.log('\n【批次详情】')
  if (data.batches && data.batches.length > 0) {
    data.batches.slice(0, 3).forEach((batch, index) => {
      console.log(`\n批次 ${index + 1}:`)
      console.log(`  - batchId: ${batch.batchId}`)
      console.log(`  - _id: ${batch._id}`)
      console.log(`  - 批次号: ${batch.batchNumber}`)
      console.log(`  - 当前存栏: ${batch.totalCount}`)
      console.log(`  - 死亡数: ${batch.deadCount}`)
    })
    
    if (data.batches.length > 3) {
      console.log(`\n... 还有 ${data.batches.length - 3} 个批次`)
    }
  }
  
  console.log('\n========================================')
}).catch(err => {
  console.error('❌ 云函数调用失败:', err)
})

// 2. 测试批次入栏记录
setTimeout(() => {
  console.log('\n\n========== 检查批次入栏记录 ==========\n')
  
  wx.cloud.database().collection('prod_batch_entries')
    .where({
      isDeleted: wx.cloud.database().command.neq(true)
    })
    .field({
      _id: true,
      batchNumber: true,
      quantity: true,
      breed: true,
      entryDate: true
    })
    .limit(10)
    .get()
    .then(res => {
      console.log(`找到 ${res.data.length} 条批次入栏记录（前10条）\n`)
      
      let totalQuantity = 0
      let issueCount = 0
      
      res.data.forEach((batch, index) => {
        const hasIssue = !batch.quantity || batch.quantity === 0 || typeof batch.quantity === 'string'
        
        if (hasIssue) issueCount++
        
        const status = hasIssue ? '⚠️' : '✅'
        console.log(`${status} 批次 ${index + 1}:`)
        console.log(`   ID: ${batch._id}`)
        console.log(`   批次号: ${batch.batchNumber}`)
        console.log(`   入栏数量: ${batch.quantity} (类型: ${typeof batch.quantity})`)
        console.log(`   品种: ${batch.breed}`)
        console.log(`   入栏日期: ${batch.entryDate}`)
        
        if (hasIssue) {
          console.log(`   ⚠️ 问题: ${!batch.quantity ? '缺少quantity字段' : batch.quantity === 0 ? 'quantity为0' : 'quantity是字符串类型'}`)
        }
        
        console.log('')
        
        totalQuantity += Number(batch.quantity) || 0
      })
      
      console.log('【统计】')
      console.log(`总入栏数（前10条）: ${totalQuantity}`)
      console.log(`有问题的记录: ${issueCount}`)
      
      if (issueCount > 0) {
        console.log('\n⚠️ 发现问题记录，请运行修复脚本:')
        console.log('   scripts/fix-batch-quantity.js')
      } else {
        console.log('\n✅ 所有批次记录正常')
      }
      
      console.log('\n========================================')
    })
    .catch(err => {
      console.error('❌ 查询批次入栏记录失败:', err)
    })
}, 2000)

// 3. 测试前端页面数据
setTimeout(() => {
  console.log('\n\n========== 检查前端页面数据 ==========\n')
  
  const pages = getCurrentPages()
  const healthPage = pages.find(page => page.route === 'pages/health/health')
  
  if (healthPage) {
    const healthStats = healthPage.data.healthStats
    const analysisData = healthPage.data.analysisData
    
    console.log('【健康统计】')
    console.log(`当前存栏 (totalChecks): ${healthStats.totalChecks}`)
    console.log(`健康数量 (healthyCount): ${healthStats.healthyCount}`)
    console.log(`死亡数量 (deadCount): ${healthStats.deadCount}`)
    console.log(`原始入栏数 (originalQuantity): ${healthStats.originalQuantity}`)
    console.log(`健康率: ${healthStats.healthyRate}`)
    console.log(`死亡率: ${healthStats.mortalityRate}`)
    
    console.log('\n【存活率分析】')
    if (analysisData && analysisData.survivalAnalysis) {
      console.log(`存活率: ${analysisData.survivalAnalysis.rate}${analysisData.survivalAnalysis.rate !== '-' ? '%' : ''}`)
      console.log(`趋势: ${analysisData.survivalAnalysis.trend}`)
      
      if (analysisData.survivalAnalysis.rate === '-') {
        console.log('\n⚠️ 存活率显示为"-"，可能原因:')
        console.log('   1. originalQuantity 为 0')
        console.log('   2. 云函数查询批次入栏数据失败')
        console.log('   3. 批次ID映射不匹配')
        console.log('\n建议操作:')
        console.log('   1. 检查云函数是否已上传最新版本')
        console.log('   2. 运行修复脚本: scripts/fix-batch-quantity.js')
        console.log('   3. 刷新页面重新加载数据')
      } else {
        console.log('\n✅ 存活率显示正常')
      }
    } else {
      console.log('⚠️ 未找到存活率分析数据，请切换到"效果分析"Tab')
    }
  } else {
    console.log('⚠️ 未找到健康管理页面，请先打开该页面')
  }
  
  console.log('\n========================================')
}, 4000)

console.log('\n验证将在几秒钟后完成，请等待...\n')
