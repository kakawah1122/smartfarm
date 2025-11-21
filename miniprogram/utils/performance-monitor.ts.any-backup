/**
 * 性能监控工具
 * 用于诊断小程序性能问题，找出卡顿原因
 */

/// <reference path="../../typings/index.d.ts" />

declare const wx: WechatMiniprogram.Wx

interface PerformanceMetrics {
  setDataCount: number          // setData调用次数
  setDataTotalTime: number      // setData总耗时
  setDataMaxTime: number        // setData最大耗时
  setDataAvgTime: number        // setData平均耗时
  largeDataCount: number        // 大数据量setData次数（>1KB）
  cloudCallCount: number        // 云函数调用次数
  cloudCallTotalTime: number    // 云函数总耗时
  memoryUsage: number           // 内存使用量(MB)
  renderTime: number            // 渲染耗时
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {} as PerformanceMetrics
  private startTime: number = 0
  private setDataRecords: Array<{ time: number; size: number; path?: string }> = []
  private cloudCallRecords: Array<{ name: string; time: number }> = []
  private enabled: boolean = false
  
  constructor() {
    this.reset()
    this.enabled = false
  }
  
  /**
   * 启用监控
   */
  enable() {
    this.enabled = true
    this.startTime = Date.now()
    console.log('🔍 性能监控已启用')
  }
  
  /**
   * 禁用监控
   */
  disable() {
    this.enabled = false
    console.log('🔍 性能监控已禁用')
  }
  
  /**
   * 重置指标
   */
  reset() {
    this.metrics = {
      setDataCount: 0,
      setDataTotalTime: 0,
      setDataMaxTime: 0,
      setDataAvgTime: 0,
      largeDataCount: 0,
      cloudCallCount: 0,
      cloudCallTotalTime: 0,
      memoryUsage: 0,
      renderTime: 0
    }
    this.setDataRecords = []
    this.cloudCallRecords = []
    this.startTime = Date.now()
  }
  
  /**
   * 监控setData调用
   */
  monitorSetData(component: any) {
    if (!this.enabled) return
    
    const originalSetData = component.setData.bind(component)
    
    component.setData = (data: any, callback?: () => void) => {
      const startTime = Date.now()
      const dataSize = this.getDataSize(data)
      
      // 记录大数据量警告
      if (dataSize > 1024) {
        this.metrics.largeDataCount++
        console.warn(`⚠️ 大数据量setData: ${(dataSize / 1024).toFixed(2)}KB`, data)
      }
      
      originalSetData(data, () => {
        const duration = Date.now() - startTime
        
        // 更新指标
        this.metrics.setDataCount++
        this.metrics.setDataTotalTime += duration
        this.metrics.setDataMaxTime = Math.max(this.metrics.setDataMaxTime, duration)
        this.metrics.setDataAvgTime = this.metrics.setDataTotalTime / this.metrics.setDataCount
        
        // 记录慢setData
        if (duration > 30) {
          console.warn(`⚠️ 慢setData: ${duration}ms`, data)
        }
        
        this.setDataRecords.push({
          time: duration,
          size: dataSize,
          path: Object.keys(data).join(',')
        })
        
        if (callback) callback()
      })
    }
  }
  
  /**
   * 监控云函数调用
   */
  monitorCloudCall(name: string, promise: Promise<any>): Promise<any> {
    if (!this.enabled) return promise
    
    const startTime = Date.now()
    
    return promise
      .then(res => {
        const duration = Date.now() - startTime
        
        this.metrics.cloudCallCount++
        this.metrics.cloudCallTotalTime += duration
        
        if (duration > 1000) {
          console.warn(`⚠️ 慢云函数: ${name} 耗时 ${duration}ms`)
        }
        
        this.cloudCallRecords.push({ name, time: duration })
        
        return res
      })
      .catch(err => {
        const duration = Date.now() - startTime
        console.error(`❌ 云函数失败: ${name} 耗时 ${duration}ms`)
        throw err
      })
  }
  
  /**
   * 获取数据大小（字节）
   */
  private getDataSize(data: any): number {
    try {
      return JSON.stringify(data).length
    } catch {
      return 0
    }
  }
  
  /**
   * 获取内存使用情况
   */
  getMemoryInfo(): { usage: number; limit: number } {
    // 微信小程序的内存监控
    if (typeof wx !== 'undefined' && wx.getPerformance) {
      const performance = wx.getPerformance()
      // 使用any类型来访问可能存在的memory属性
      const memory = (performance as any).memory
      if (memory) {
        return {
          usage: Math.round(memory.usedJSHeapSize / 1048576), // 转换为MB
          limit: Math.round(memory.jsHeapSizeLimit / 1048576)
        }
      }
    }
    return { usage: 0, limit: 0 }
  }
  
  /**
   * 生成性能报告
   */
  generateReport(): string {
    const totalTime = Date.now() - this.startTime
    const memoryInfo = this.getMemoryInfo()
    
    const report = `
📊 性能监控报告
═══════════════════════════════════
⏱️ 监控时长: ${(totalTime / 1000).toFixed(2)}秒

📝 SetData 统计:
  • 调用次数: ${this.metrics.setDataCount}
  • 总耗时: ${this.metrics.setDataTotalTime}ms
  • 平均耗时: ${this.metrics.setDataAvgTime.toFixed(2)}ms
  • 最大耗时: ${this.metrics.setDataMaxTime}ms
  • 大数据量次数: ${this.metrics.largeDataCount}

☁️ 云函数统计:
  • 调用次数: ${this.metrics.cloudCallCount}
  • 总耗时: ${(this.metrics.cloudCallTotalTime / 1000).toFixed(2)}秒
  • 平均耗时: ${this.metrics.cloudCallCount > 0 ? (this.metrics.cloudCallTotalTime / this.metrics.cloudCallCount).toFixed(0) : 0}ms

💾 内存使用:
  • 当前使用: ${memoryInfo.usage}MB
  • 内存限制: ${memoryInfo.limit}MB
  • 使用率: ${memoryInfo.limit > 0 ? ((memoryInfo.usage / memoryInfo.limit) * 100).toFixed(1) : 0}%
═══════════════════════════════════`
    
    return report
  }
  
  /**
   * 输出性能报告到控制台
   */
  logReport() {
    console.log(this.generateReport())
    
    // 输出详细的慢操作
    if (this.setDataRecords.filter(r => r.time > 30).length > 0) {
      console.log('\n⚠️ 慢SetData操作:')
      this.setDataRecords
        .filter(r => r.time > 30)
        .sort((a, b) => b.time - a.time)
        .slice(0, 5)
        .forEach(r => {
          console.log(`  • ${r.time}ms - ${(r.size / 1024).toFixed(2)}KB - ${r.path}`)
        })
    }
    
    if (this.cloudCallRecords.filter(r => r.time > 1000).length > 0) {
      console.log('\n⚠️ 慢云函数调用:')
      this.cloudCallRecords
        .filter(r => r.time > 1000)
        .sort((a, b) => b.time - a.time)
        .slice(0, 5)
        .forEach(r => {
          console.log(`  • ${r.name}: ${r.time}ms`)
        })
    }
  }
  
  /**
   * 分析性能问题
   */
  analyzeProblems(): string[] {
    const problems: string[] = []
    
    // setData问题
    if (this.metrics.setDataCount > 100) {
      problems.push(`SetData调用过于频繁(${this.metrics.setDataCount}次)，建议批量更新`)
    }
    
    if (this.metrics.setDataAvgTime > 50) {
      problems.push(`SetData平均耗时过长(${this.metrics.setDataAvgTime.toFixed(0)}ms)，建议优化数据结构`)
    }
    
    if (this.metrics.largeDataCount > 10) {
      problems.push(`大数据量SetData过多(${this.metrics.largeDataCount}次)，建议分页或虚拟列表`)
    }
    
    // 云函数问题
    if (this.metrics.cloudCallCount > 20) {
      problems.push(`云函数调用过多(${this.metrics.cloudCallCount}次)，建议合并请求`)
    }
    
    if (this.metrics.cloudCallTotalTime > 10000) {
      problems.push(`云函数总耗时过长(${(this.metrics.cloudCallTotalTime / 1000).toFixed(1)}秒)，建议优化查询`)
    }
    
    // 内存问题
    const memoryInfo = this.getMemoryInfo()
    const memoryUsage = memoryInfo.limit > 0 ? (memoryInfo.usage / memoryInfo.limit) * 100 : 0
    if (memoryUsage > 80) {
      problems.push(`内存使用率过高(${memoryUsage.toFixed(1)}%)，可能导致卡顿`)
    }
    
    return problems
  }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor()

/**
 * 便捷方法：在页面中快速启用性能监控
 */
export function enablePerformanceMonitoring(page: any) {
  performanceMonitor.enable()
  performanceMonitor.monitorSetData(page)
  
  // 页面卸载时输出报告
  const originalUnload = page.onUnload
  page.onUnload = function() {
    performanceMonitor.logReport()
    const problems = performanceMonitor.analyzeProblems()
    if (problems.length > 0) {
      console.log('\n❌ 发现性能问题:')
      problems.forEach(p => console.log(`  • ${p}`))
    }
    performanceMonitor.disable()
    if (originalUnload) originalUnload.call(this)
  }
}
