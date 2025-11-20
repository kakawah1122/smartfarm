/**
 * 健康管理页面数据分析模块
 * 负责处理数据统计、趋势分析、图表数据准备
 * 保持原有功能不变，只是提取和模块化
 */

/// <reference path="../../../../typings/index.d.ts" />

/**
 * 健康趋势类型
 */
export type HealthTrend = 'improving' | 'stable' | 'declining' | 'unknown'

/**
 * 时间范围类型
 */
export type TimeRange = '7days' | '30days' | '90days' | 'custom'

/**
 * 健康统计数据接口
 */
export interface HealthStats {
  totalChecks: number
  healthyCount: number
  sickCount: number
  deadCount: number
  healthyRate: string
  mortalityRate: string
  originalQuantity: number
}

/**
 * 成本分析数据接口
 */
export interface CostAnalysis {
  preventionCost: number
  treatmentCost: number
  feedingCost: number
  totalCost: number
  costTrend?: HealthTrend
  costByCategory?: Array<{
    category: string
    amount: number
    percentage: number
  }>
}

/**
 * 存活率分析接口
 */
export interface SurvivalAnalysis {
  rate: string | number
  trend: HealthTrend
  byStage?: Array<{
    stage: string
    rate: number
    count: number
  }>
  historicalData?: Array<{
    date: string
    rate: number
  }>
}

/**
 * 疾病分布分析
 */
export interface DiseaseDistribution {
  disease: string
  count: number
  percentage: number
  trend: HealthTrend
}

/**
 * 健康分析管理器
 */
export class HealthAnalysisManager {
  
  /**
   * 计算健康率
   */
  static calculateHealthRate(stats: Partial<HealthStats>): string {
    const originalQuantity = stats.originalQuantity || 0
    const deadCount = stats.deadCount || 0
    const sickCount = stats.sickCount || 0
    
    if (originalQuantity === 0) return '0'
    
    const healthyCount = originalQuantity - deadCount - sickCount
    const rate = (healthyCount / originalQuantity) * 100
    
    return rate.toFixed(1)
  }
  
  /**
   * 计算死亡率
   */
  static calculateMortalityRate(stats: Partial<HealthStats>): string {
    const originalQuantity = stats.originalQuantity || 0
    const deadCount = stats.deadCount || 0
    
    if (originalQuantity === 0) return '0'
    
    const rate = (deadCount / originalQuantity) * 100
    return rate.toFixed(2)
  }
  
  /**
   * 计算存活率
   */
  static calculateSurvivalRate(stats: Partial<HealthStats>): string {
    const originalQuantity = stats.originalQuantity || 0
    const deadCount = stats.deadCount || 0
    
    if (originalQuantity === 0) return '-'
    
    const survivalCount = originalQuantity - deadCount
    const rate = (survivalCount / originalQuantity) * 100
    
    return rate.toFixed(1)
  }
  
  /**
   * 分析健康趋势
   */
  static analyzeHealthTrend(stats: Partial<HealthStats>): HealthTrend {
    const mortalityRate = parseFloat(this.calculateMortalityRate(stats))
    
    if (mortalityRate < 1) return 'improving'
    if (mortalityRate < 3) return 'stable'
    if (mortalityRate < 5) return 'declining'
    
    return 'declining'
  }
  
  /**
   * 分析成本趋势
   */
  static analyzeCostTrend(
    currentCost: number, 
    previousCost: number, 
    threshold: number = 10
  ): HealthTrend {
    if (previousCost === 0) return 'unknown'
    
    const changeRate = ((currentCost - previousCost) / previousCost) * 100
    
    if (changeRate < -threshold) return 'improving'
    if (changeRate > threshold) return 'declining'
    
    return 'stable'
  }
  
  /**
   * 生成存活率分析
   */
  static generateSurvivalAnalysis(stats: Partial<HealthStats>): SurvivalAnalysis {
    const rate = this.calculateSurvivalRate(stats)
    const trend = this.analyzeHealthTrend(stats)
    
    return {
      rate,
      trend,
      byStage: this.generateStageAnalysis(stats),
      historicalData: []
    }
  }
  
  /**
   * 生成阶段分析
   */
  static generateStageAnalysis(stats: Partial<HealthStats>): Array<{
    stage: string
    rate: number
    count: number
  }> {
    // 模拟阶段数据（实际应从数据库获取）
    return [
      { stage: '1-7日龄', rate: 99.5, count: stats.originalQuantity || 0 },
      { stage: '8-21日龄', rate: 98.0, count: Math.floor((stats.originalQuantity || 0) * 0.995) },
      { stage: '22-35日龄', rate: 96.5, count: Math.floor((stats.originalQuantity || 0) * 0.98) },
      { stage: '36日龄以上', rate: 95.0, count: Math.floor((stats.originalQuantity || 0) * 0.965) }
    ]
  }
  
  /**
   * 生成成本分析
   */
  static generateCostAnalysis(costs: {
    prevention?: number
    treatment?: number
    feeding?: number
  }): CostAnalysis {
    const preventionCost = costs.prevention || 0
    const treatmentCost = costs.treatment || 0
    const feedingCost = costs.feeding || 0
    const totalCost = preventionCost + treatmentCost + feedingCost
    
    const analysis: CostAnalysis = {
      preventionCost,
      treatmentCost,
      feedingCost,
      totalCost,
      costTrend: 'stable',
      costByCategory: []
    }
    
    // 计算各类成本占比
    if (totalCost > 0) {
      analysis.costByCategory = [
        {
          category: '预防成本',
          amount: preventionCost,
          percentage: (preventionCost / totalCost) * 100
        },
        {
          category: '治疗成本',
          amount: treatmentCost,
          percentage: (treatmentCost / totalCost) * 100
        },
        {
          category: '饲养成本',
          amount: feedingCost,
          percentage: (feedingCost / totalCost) * 100
        }
      ]
    }
    
    return analysis
  }
  
  /**
   * 生成疾病分布分析
   */
  static generateDiseaseDistribution(
    diseaseRecords: Array<{ disease: string, count: number }>
  ): DiseaseDistribution[] {
    const total = diseaseRecords.reduce((sum, item) => sum + item.count, 0)
    
    if (total === 0) return []
    
    return diseaseRecords
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // 只取前5种疾病
      .map(item => ({
        disease: item.disease,
        count: item.count,
        percentage: (item.count / total) * 100,
        trend: 'stable' as HealthTrend
      }))
  }
  
  /**
   * 格式化趋势图数据（用于图表）
   */
  static formatTrendData(
    data: Array<{ date: string, value: number }>,
    type: 'health' | 'cost' | 'survival'
  ) {
    const labels = data.map(item => item.date)
    const values = data.map(item => item.value)
    
    const colors = {
      health: '#52c41a',
      cost: '#ff7875',
      survival: '#1890ff'
    }
    
    return {
      labels,
      datasets: [{
        label: this.getTrendLabel(type),
        data: values,
        borderColor: colors[type],
        backgroundColor: colors[type] + '20',
        tension: 0.4
      }]
    }
  }
  
  /**
   * 获取趋势标签
   */
  private static getTrendLabel(type: 'health' | 'cost' | 'survival'): string {
    const labels = {
      health: '健康率',
      cost: '成本趋势',
      survival: '存活率'
    }
    return labels[type]
  }
  
  /**
   * 格式化饼图数据（用于成本分布）
   */
  static formatPieData(
    data: Array<{ category: string, amount: number, percentage: number }>
  ) {
    return {
      labels: data.map(item => item.category),
      datasets: [{
        data: data.map(item => item.amount),
        backgroundColor: [
          '#52c41a',
          '#ff7875',
          '#1890ff',
          '#faad14',
          '#722ed1'
        ]
      }]
    }
  }
  
  /**
   * 计算环比变化
   */
  static calculatePeriodChange(
    current: number,
    previous: number
  ): { value: number, rate: string, trend: 'up' | 'down' | 'flat' } {
    const change = current - previous
    
    if (previous === 0) {
      return {
        value: change,
        rate: '0',
        trend: 'flat'
      }
    }
    
    const rate = ((change / previous) * 100).toFixed(1)
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    
    return { value: change, rate, trend }
  }
  
  /**
   * 生成统计摘要
   */
  static generateStatsSummary(stats: Partial<HealthStats>): string {
    const healthRate = this.calculateHealthRate(stats)
    const mortalityRate = this.calculateMortalityRate(stats)
    const survivalRate = this.calculateSurvivalRate(stats)
    
    return `健康率：${healthRate}% | 死亡率：${mortalityRate}% | 存活率：${survivalRate}%`
  }
  
  /**
   * 获取健康评级
   */
  static getHealthRating(stats: Partial<HealthStats>): {
    grade: 'A' | 'B' | 'C' | 'D'
    color: string
    description: string
  } {
    const mortalityRate = parseFloat(this.calculateMortalityRate(stats))
    
    if (mortalityRate < 1) {
      return { grade: 'A', color: '#52c41a', description: '优秀' }
    }
    if (mortalityRate < 3) {
      return { grade: 'B', color: '#1890ff', description: '良好' }
    }
    if (mortalityRate < 5) {
      return { grade: 'C', color: '#faad14', description: '一般' }
    }
    
    return { grade: 'D', color: '#ff7875', description: '较差' }
  }
  
  /**
   * 生成分析报告
   */
  static generateAnalysisReport(data: {
    stats: Partial<HealthStats>
    costs: { prevention?: number, treatment?: number, feeding?: number }
    period: TimeRange
  }): {
    summary: string
    highlights: string[]
    recommendations: string[]
    metrics: Array<{ label: string, value: string, trend?: HealthTrend }>
  } {
    const healthRating = this.getHealthRating(data.stats)
    const survivalRate = this.calculateSurvivalRate(data.stats)
    const costAnalysis = this.generateCostAnalysis(data.costs)
    
    const highlights: string[] = []
    const recommendations: string[] = []
    
    // 生成亮点
    if (healthRating.grade === 'A') {
      highlights.push('批次健康状况优秀')
    }
    if (parseFloat(survivalRate) > 95) {
      highlights.push(`存活率达到${survivalRate}%`)
    }
    if (costAnalysis.totalCost < 10000) {
      highlights.push('成本控制良好')
    }
    
    // 生成建议
    if (healthRating.grade === 'C' || healthRating.grade === 'D') {
      recommendations.push('加强疾病预防管理')
    }
    if (costAnalysis.treatmentCost > costAnalysis.preventionCost * 2) {
      recommendations.push('增加预防投入，降低治疗成本')
    }
    if (data.stats.sickCount && data.stats.sickCount > 10) {
      recommendations.push('关注当前患病动物，及时治疗')
    }
    
    return {
      summary: this.generateStatsSummary(data.stats),
      highlights,
      recommendations,
      metrics: [
        {
          label: '健康评级',
          value: healthRating.grade,
          trend: this.analyzeHealthTrend(data.stats)
        },
        {
          label: '存活率',
          value: `${survivalRate}%`,
          trend: this.analyzeHealthTrend(data.stats)
        },
        {
          label: '总成本',
          value: `¥${costAnalysis.totalCost}`,
          trend: costAnalysis.costTrend
        }
      ]
    }
  }
}

/**
 * 数据格式化工具
 */
export class DataFormatter {
  /**
   * 格式化百分比
   */
  static formatPercentage(value: number | string, decimals = 1): string {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '-'
    return num.toFixed(decimals) + '%'
  }
  
  /**
   * 格式化金额
   */
  static formatCurrency(value: number): string {
    if (!value || value === 0) return '¥0'
    
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(2)}万`
    }
    
    return `¥${value.toFixed(2)}`
  }
  
  /**
   * 格式化数量
   */
  static formatCount(value: number): string {
    if (!value || value === 0) return '0'
    
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`
    }
    
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}千`
    }
    
    return value.toString()
  }
  
  /**
   * 格式化趋势
   */
  static formatTrend(trend: HealthTrend): {
    text: string
    color: string
    icon: string
  } {
    const trendMap = {
      improving: { text: '改善', color: '#52c41a', icon: '↑' },
      stable: { text: '稳定', color: '#1890ff', icon: '→' },
      declining: { text: '下降', color: '#ff7875', icon: '↓' },
      unknown: { text: '未知', color: '#8c8c8c', icon: '?' }
    }
    
    return trendMap[trend]
  }
}

/**
 * 导出便捷方法
 */
export function setupAnalysisModule(pageInstance: any) {
  // 绑定分析方法到页面实例
  pageInstance.calculateHealthRate = (stats: Partial<HealthStats>) => 
    HealthAnalysisManager.calculateHealthRate(stats)
    
  pageInstance.calculateSurvivalRate = (stats: Partial<HealthStats>) => 
    HealthAnalysisManager.calculateSurvivalRate(stats)
    
  pageInstance.generateAnalysisReport = (data: any) => 
    HealthAnalysisManager.generateAnalysisReport(data)
  
  // 返回管理器
  return HealthAnalysisManager
}
