/**
 * 测试死亡记录创建后页面刷新功能
 * 验证健康管理页面的死亡数是否正确更新
 */

// 获取当前健康管理页面的死亡数
async function getCurrentDeathCount() {
  try {
    const pages = getCurrentPages()
    const healthPage = pages.find(page => page.route === 'pages/health/health')
    
    if (healthPage) {
      const deadCount = healthPage.data.healthStats.deadCount || 0
      console.log('当前死亡数:', deadCount)
      return deadCount
    } else {
      console.log('健康管理页面未打开')
      return null
    }
  } catch (error) {
    console.error('获取死亡数失败:', error)
    return null
  }
}

// 模拟死亡记录流程
async function simulateDeathRecordFlow() {
  console.log('========== 测试死亡记录流程 ==========')
  
  // 1. 记录初始死亡数
  const initialCount = await getCurrentDeathCount()
  console.log('初始死亡数:', initialCount)
  
  // 2. 检查刷新标志状态
  const checkRefreshFlag = () => {
    const flag = wx.getStorageSync('health_page_need_refresh')
    console.log('刷新标志状态:', flag ? '已设置' : '未设置')
    return flag
  }
  
  // 3. 监听页面刷新
  const watchPageRefresh = () => {
    console.log('开始监听页面刷新...')
    
    // 定期检查死亡数变化
    let checkCount = 0
    const interval = setInterval(async () => {
      checkCount++
      const currentCount = await getCurrentDeathCount()
      
      if (currentCount !== null && currentCount !== initialCount) {
        console.log(`✅ 死亡数已更新: ${initialCount} → ${currentCount}`)
        clearInterval(interval)
      } else if (checkCount > 10) {
        console.log('❌ 超时：死亡数未更新')
        clearInterval(interval)
      } else {
        console.log(`检查中... (${checkCount}/10)`)
      }
    }, 1000)
  }
  
  // 4. 提供测试指导
  console.log('\n请按以下步骤测试：')
  console.log('1. 进入健康管理页面')
  console.log('2. 点击"治疗中"卡片查看治疗列表')
  console.log('3. 选择一条治疗记录进入详情')
  console.log('4. 点击"完成治疗"选择"死亡"')
  console.log('5. 填写死亡记录并提交')
  console.log('6. 返回健康管理页面')
  console.log('\n观察：死亡数卡片是否更新')
  
  // 开始监听
  watchPageRefresh()
  
  // 定期检查刷新标志
  setInterval(() => {
    checkRefreshFlag()
  }, 2000)
}

// 验证数据一致性
async function verifyDataConsistency() {
  console.log('\n========== 验证数据一致性 ==========')
  
  try {
    // 从云函数获取实际死亡数
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'get_health_statistics'
      }
    })
    
    if (result.result && result.result.success) {
      const cloudDeathCount = result.result.data.deadCount || 0
      const pageDeathCount = await getCurrentDeathCount()
      
      console.log('云端死亡数:', cloudDeathCount)
      console.log('页面死亡数:', pageDeathCount)
      
      if (cloudDeathCount === pageDeathCount) {
        console.log('✅ 数据一致')
      } else {
        console.log('❌ 数据不一致，需要刷新页面')
      }
    }
  } catch (error) {
    console.error('验证失败:', error)
  }
}

// 手动触发页面刷新
function manualRefresh() {
  console.log('手动设置刷新标志...')
  wx.setStorageSync('health_page_need_refresh', true)
  
  // 触发健康页面的onShow
  const pages = getCurrentPages()
  const healthPage = pages.find(page => page.route === 'pages/health/health')
  
  if (healthPage && healthPage.onShow) {
    console.log('触发健康页面onShow...')
    healthPage.onShow()
  } else {
    console.log('请先打开健康管理页面')
  }
}

// 主测试入口
async function main() {
  console.log('死亡记录刷新测试工具')
  console.log('====================\n')
  
  console.log('可用命令：')
  console.log('test.simulateDeathRecordFlow() - 模拟死亡记录流程')
  console.log('test.verifyDataConsistency() - 验证数据一致性')
  console.log('test.manualRefresh() - 手动触发刷新')
  console.log('test.getCurrentDeathCount() - 获取当前死亡数')
  
  // 自动验证一次
  await verifyDataConsistency()
}

// 导出测试方法
module.exports = {
  main,
  simulateDeathRecordFlow,
  verifyDataConsistency,
  manualRefresh,
  getCurrentDeathCount
}

// 提示使用方法
console.log('\n使用方法：')
console.log('const test = require("./scripts/test-death-record-refresh.js")')
console.log('test.main()')
