/**
 * 性能分析报告生成器
 * 提供详细的性能分析和优化建议
 */

/// <reference path="../../typings/index.d.ts" />

declare const wx: WechatMiniprogram.Wx

interface RenderMetrics {
  domNodeCount: number
  listItemCount: number
  imageCount: number
  setDataSize: number
  renderTime: number
}

interface MemoryMetrics {
  jsHeap: number
  domSize: number
  totalMemory: number
}

interface NetworkMetrics {
  requestCount: number
  totalSize: number
  avgLatency: number
  slowRequests: Array<{
    url: string
    time: number
    size: number
  }>
}

export interface PerformanceReport {
  timestamp: number
  page: string
  render: RenderMetrics
  memory: MemoryMetrics
  network: NetworkMetrics
  suggestions: string[]
  score: number
}

export class PerformanceAnalyzer {
  private static instance: PerformanceAnalyzer | null = null
  private reports: PerformanceReport[] = []
  private currentPageMetrics: Partial<PerformanceReport> = {}
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): PerformanceAnalyzer {
    if (!this.instance) {
      this.instance = new PerformanceAnalyzer()
    }
    return this.instance
  }
  
  /**
   * 开始分析页面性能
   */
  startAnalysis(pageName: string) {
    this.currentPageMetrics = {
      timestamp: Date.now(),
      page: pageName,
      render: {
        domNodeCount: 0,
        listItemCount: 0,
        imageCount: 0,
        setDataSize: 0,
        renderTime: 0
      },
      memory: {
        jsHeap: 0,
        domSize: 0,
        totalMemory: 0
      },
      network: {
        requestCount: 0,
        totalSize: 0,
        avgLatency: 0,
        slowRequests: []
      },
      suggestions: [],
      score: 100
    }
    
    this.measureRenderMetrics()
    this.measureMemoryMetrics()
  }
  
  /**
   * 测量渲染指标
   */
  private measureRenderMetrics() {
    try {
      // 获取页面所有节点
      const query = wx.createSelectorQuery()
      
      // 统计DOM节点数
      query.selectAll('*').fields({
        id: true,
        dataset: true
      }, (res: any) => {
        if (this.currentPageMetrics.render) {
          this.currentPageMetrics.render.domNodeCount = res?.length || 0
        }
      })
      
      // 统计列表项
      query.selectAll('[wx\\:for]').fields({
        dataset: true
      }, (res: any) => {
        if (this.currentPageMetrics.render) {
          this.currentPageMetrics.render.listItemCount = res?.length || 0
        }
      })
      
      // 统计图片
      query.selectAll('image').fields({
        dataset: true
      }, (res: any) => {
        if (this.currentPageMetrics.render) {
          this.currentPageMetrics.render.imageCount = res?.length || 0
        }
      })
      
      query.exec()
    } catch (error) {
      console.error('测量渲染指标失败:', error)
    }
  }
  
  /**
   * 测量内存指标
   */
  private measureMemoryMetrics() {
    if (wx.getPerformance) {
      const performance = wx.getPerformance() as any
      const memory = performance.memory
      
      if (memory && this.currentPageMetrics.memory) {
        this.currentPageMetrics.memory.jsHeap = Math.round(memory.usedJSHeapSize / 1024 / 1024)
        this.currentPageMetrics.memory.totalMemory = Math.round(memory.totalJSHeapSize / 1024 / 1024)
      }
    }
  }
  
  /**
   * 记录setData调用
   */
  recordSetData(dataSize: number, time: number) {
    if (this.currentPageMetrics.render) {
      this.currentPageMetrics.render.setDataSize += dataSize
      this.currentPageMetrics.render.renderTime += time
    }
  }
  
  /**
   * 记录网络请求
   */
  recordNetworkRequest(url: string, time: number, size: number) {
    if (!this.currentPageMetrics.network) return
    
    this.currentPageMetrics.network.requestCount++
    this.currentPageMetrics.network.totalSize += size
    
    // 记录慢请求（超过1秒）
    if (time > 1000) {
      this.currentPageMetrics.network.slowRequests.push({
        url,
        time,
        size
      })
    }
    
    // 计算平均延迟
    const count = this.currentPageMetrics.network.requestCount
    const currentAvg = this.currentPageMetrics.network.avgLatency
    this.currentPageMetrics.network.avgLatency = 
      (currentAvg * (count - 1) + time) / count
  }
  
  /**
   * 生成性能分析报告
   */
  generateReport(): PerformanceReport {
    const report = this.currentPageMetrics as PerformanceReport
    
    // 生成性能评分
    report.score = this.calculateScore(report)
    
    // 生成优化建议
    report.suggestions = this.generateSuggestions(report)
    
    // 保存报告
    this.reports.push(report)
    
    return report
  }
  
  /**
   * 计算性能评分
   */
  private calculateScore(report: PerformanceReport): number {
    let score = 100
    
    // DOM节点数评分（超过1000扣分）
    if (report.render.domNodeCount > 1000) {
      score -= Math.min(20, (report.render.domNodeCount - 1000) / 100)
    }
    
    // 列表项评分（超过50扣分）
    if (report.render.listItemCount > 50) {
      score -= Math.min(15, (report.render.listItemCount - 50) / 10)
    }
    
    // 内存评分（超过50MB扣分）
    if (report.memory.jsHeap > 50) {
      score -= Math.min(20, (report.memory.jsHeap - 50) / 5)
    }
    
    // 网络评分（慢请求扣分）
    if (report.network.slowRequests.length > 0) {
      score -= Math.min(15, report.network.slowRequests.length * 3)
    }
    
    // setData大小评分（超过256KB扣分）
    const setDataKB = report.render.setDataSize / 1024
    if (setDataKB > 256) {
      score -= Math.min(20, (setDataKB - 256) / 50)
    }
    
    // 渲染时间评分（超过100ms扣分）
    if (report.render.renderTime > 100) {
      score -= Math.min(10, (report.render.renderTime - 100) / 50)
    }
    
    return Math.max(0, Math.round(score))
  }
  
  /**
   * 生成优化建议
   */
  private generateSuggestions(report: PerformanceReport): string[] {
    const suggestions: string[] = []
    
    // DOM节点优化建议
    if (report.render.domNodeCount > 1000) {
      suggestions.push(`⚠️ DOM节点过多（${report.render.domNodeCount}个），建议使用虚拟列表减少渲染节点`)
    }
    
    // 列表优化建议
    if (report.render.listItemCount > 50) {
      suggestions.push(`📋 列表项过多（${report.render.listItemCount}个），建议使用分页或虚拟滚动`)
    }
    
    // 图片优化建议
    if (report.render.imageCount > 20) {
      suggestions.push(`🖼️ 图片过多（${report.render.imageCount}张），建议使用懒加载`)
    }
    
    // 内存优化建议
    if (report.memory.jsHeap > 50) {
      suggestions.push(`💾 内存使用过高（${report.memory.jsHeap}MB），建议清理无用数据`)
    }
    
    // 网络优化建议
    if (report.network.slowRequests.length > 0) {
      suggestions.push(`🌐 存在${report.network.slowRequests.length}个慢请求，建议优化接口或添加缓存`)
    }
    
    // setData优化建议
    const setDataKB = Math.round(report.render.setDataSize / 1024)
    if (setDataKB > 256) {
      suggestions.push(`📦 setData数据量过大（${setDataKB}KB），建议分批更新或减少数据量`)
    }
    
    // 渲染时间优化建议
    if (report.render.renderTime > 100) {
      suggestions.push(`⏱️ 渲染耗时过长（${report.render.renderTime}ms），建议优化组件结构`)
    }
    
    // 如果没有问题，给出肯定
    if (suggestions.length === 0) {
      suggestions.push('✅ 性能良好，继续保持！')
    }
    
    return suggestions
  }
  
  /**
   * 获取所有报告
   */
  getReports(): PerformanceReport[] {
    return this.reports
  }
  
  /**
   * 获取最新报告
   */
  getLatestReport(): PerformanceReport | null {
    return this.reports[this.reports.length - 1] || null
  }
  
  /**
   * 清空报告
   */
  clearReports() {
    this.reports = []
  }
  
  /**
   * 打印性能报告
   */
  printReport(report?: PerformanceReport) {
    const targetReport = report || this.getLatestReport()
    if (!targetReport) {
      console.log('暂无性能报告')
      return
    }
    
    console.group(`📊 性能分析报告 - ${targetReport.page}`)
    console.log(`⏰ 时间: ${new Date(targetReport.timestamp).toLocaleString()}`)
    console.log(`🎯 评分: ${targetReport.score}/100`)
    
    console.group('📐 渲染指标')
    console.log(`DOM节点: ${targetReport.render.domNodeCount}`)
    console.log(`列表项: ${targetReport.render.listItemCount}`)
    console.log(`图片数: ${targetReport.render.imageCount}`)
    console.log(`setData大小: ${Math.round(targetReport.render.setDataSize / 1024)}KB`)
    console.log(`渲染耗时: ${targetReport.render.renderTime}ms`)
    console.groupEnd()
    
    console.group('💾 内存指标')
    console.log(`JS堆: ${targetReport.memory.jsHeap}MB`)
    console.log(`总内存: ${targetReport.memory.totalMemory}MB`)
    console.groupEnd()
    
    console.group('🌐 网络指标')
    console.log(`请求数: ${targetReport.network.requestCount}`)
    console.log(`总大小: ${Math.round(targetReport.network.totalSize / 1024)}KB`)
    console.log(`平均延迟: ${Math.round(targetReport.network.avgLatency)}ms`)
    if (targetReport.network.slowRequests.length > 0) {
      console.log('慢请求:')
      targetReport.network.slowRequests.forEach(req => {
        console.log(`  - ${req.url}: ${req.time}ms`)
      })
    }
    console.groupEnd()
    
    console.group('💡 优化建议')
    targetReport.suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`)
    })
    console.groupEnd()
    
    console.groupEnd()
  }
}

// 导出单例
export const performanceAnalyzer = PerformanceAnalyzer.getInstance()
