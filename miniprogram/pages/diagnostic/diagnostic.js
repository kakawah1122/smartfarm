// 诊断页面 - 用于定位 getSystemInfoSync 警告来源
Page({
  data: {
    logs: []
  },

  onLoad() {
    this.runDiagnostic()
  },

  addLog(message, type = 'info') {
    const logs = this.data.logs
    logs.push({
      time: new Date().toLocaleTimeString(),
      message,
      type
    })
    this.setData({ logs })
  },

  async runDiagnostic() {
    this.addLog('====== 开始诊断 ======', 'title')
    
    // 1. 检查微信版本和基础库
    this.addLog('1. 检查环境信息...', 'info')
    try {
      const appInfo = wx.getAppBaseInfo()
      this.addLog(`基础库版本: ${appInfo.SDKVersion}`, 'success')
      this.addLog(`微信版本: ${appInfo.version}`, 'success')
      
      const deviceInfo = wx.getDeviceInfo()
      this.addLog(`设备平台: ${deviceInfo.platform}`, 'success')
      
      const windowInfo = wx.getWindowInfo()
      this.addLog(`状态栏高度: ${windowInfo.statusBarHeight}`, 'success')
    } catch (e) {
      this.addLog(`新 API 调用失败: ${e.message}`, 'error')
    }

    // 2. 劫持 wx.getSystemInfoSync 看看谁在调用
    this.addLog('', 'info')
    this.addLog('2. 劫持 getSystemInfoSync 追踪调用...', 'info')
    
    const originalGetSystemInfoSync = wx.getSystemInfoSync
    let callCount = 0
    
    wx.getSystemInfoSync = function() {
      callCount++
      const stack = new Error().stack
      console.error('⚠️ 检测到 getSystemInfoSync 调用！')
      console.error('调用栈:', stack)
      return originalGetSystemInfoSync.call(wx)
    }
    
    this.addLog('已劫持 getSystemInfoSync，监控中...', 'success')
    
    // 3. 等待一段时间观察
    setTimeout(() => {
      this.addLog('', 'info')
      this.addLog(`3. 监控结果: 检测到 ${callCount} 次调用`, callCount > 0 ? 'error' : 'success')
      
      if (callCount === 0) {
        this.addLog('✓ 没有检测到任何调用！', 'success')
        this.addLog('', 'info')
        this.addLog('可能原因：', 'info')
        this.addLog('1. 警告来自页面初始化之前', 'warn')
        this.addLog('2. 警告来自其他页面', 'warn')
        this.addLog('3. 警告是缓存的旧信息', 'warn')
      } else {
        this.addLog('⚠ 检测到调用！请查看控制台的调用栈', 'error')
      }
      
      // 恢复原函数
      wx.getSystemInfoSync = originalGetSystemInfoSync
      
      this.addLog('', 'info')
      this.addLog('====== 诊断完成 ======', 'title')
      this.addLog('', 'info')
      this.addLog('请截图此页面和控制台发送给开发者', 'info')
    }, 3000)

    // 4. 检查全局对象
    this.addLog('', 'info')
    this.addLog('4. 检查 TDesign 组件...', 'info')
    
    if (typeof getApp === 'function') {
      try {
        const app = getApp()
        this.addLog(`App 已初始化: ${!!app}`, 'success')
      } catch (e) {
        this.addLog(`App 检查失败: ${e.message}`, 'warn')
      }
    }
  }
})

