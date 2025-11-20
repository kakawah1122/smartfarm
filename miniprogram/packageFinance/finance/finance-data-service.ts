/**
 * 财务管理数据服务模块
 * 负责处理财务相关的数据获取和管理
 */

/// <reference path="../../../typings/index.d.ts" />

import { safeCloudCall } from '../../utils/safe-cloud-call'

type FinanceOverview = FinanceSchema.FinanceOverview

interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
  total?: number
  hasMore?: boolean
}

/**
 * 交易记录接口
 */
export interface TransactionRecord {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  date: string
  description: string
  status: 'completed' | 'pending' | 'cancelled'
  operator?: string
  attachments?: string[]
}

/**
 * 财务分析结果接口
 */
export interface FinanceAnalysis {
  period: string
  revenue: {
    total: number
    growth: number
    sources: Array<{name: string; value: number}>
  }
  cost: {
    total: number
    growth: number
    breakdown: Array<{name: string; value: number}>
  }
  suggestions: string[]
}

/**
 * 财务数据服务类
 */
export class FinanceDataService {
  private static cache = new Map<string, any>()
  private static cacheTime = 5 * 60 * 1000 // 5分钟缓存
  
  /**
   * 获取财务概览
   */
  static async getFinanceOverview(dateRange?: any): Promise<FinanceOverview> {
    const cacheKey = `finance_overview_${JSON.stringify(dateRange)}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'getFinanceOverview',
          dateRange: dateRange
        }
      }) as CloudCallResult<FinanceOverview>
      
      if (result?.success && result.data) {
        this.setCache(cacheKey, result.data)
        return result.data
      }
      
      throw new Error(result?.error || '获取财务概览失败')
    } catch (error) {
      console.error('获取财务概览失败:', error)
      return {
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
        costByType: [],
        incomeByType: [],
        costTrend: []
      }
    }
  }
  
  /**
   * 获取交易记录列表（分页）
   */
  static async getTransactionRecords(params: {
    page: number
    pageSize: number
    type?: string
    category?: string
    dateRange?: any
  }): Promise<{list: TransactionRecord[]; total: number; hasMore: boolean}> {
    try {
      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'getTransactionRecords',
          ...params
        }
      }) as CloudCallResult<{ records: TransactionRecord[]; total: number; hasMore: boolean }>
      
      if (result?.success) {
        const payload = result.data || { records: [], total: 0, hasMore: false }
        return {
          list: payload.records || [],
          total: payload.total ?? result.total ?? 0,
          hasMore: payload.hasMore ?? result.hasMore ?? false
        }
      }
      
      return { list: [], total: 0, hasMore: false }
    } catch (error) {
      console.error('获取交易记录失败:', error)
      return { list: [], total: 0, hasMore: false }
    }
  }
  
  /**
   * 获取成本分析
   */
  static async getCostAnalysis(dateRange?: any): Promise<any> {
    const cacheKey = `cost_analysis_${JSON.stringify(dateRange)}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'getCostBreakdown',
          dateRange: dateRange
        }
      }) as CloudCallResult<any>
      
      if (result?.success) {
        const data = result.data
        this.setCache(cacheKey, data)
        return data
      }
      
      return null
    } catch (error) {
      console.error('获取成本分析失败:', error)
      return null
    }
  }
  
  /**
   * 获取收入分析
   */
  static async getRevenueAnalysis(dateRange?: any): Promise<any> {
    const cacheKey = `revenue_analysis_${JSON.stringify(dateRange)}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'getRevenueAnalysis',
          dateRange: dateRange
        }
      }) as CloudCallResult<any>
      
      if (result?.success) {
        const data = result.data
        this.setCache(cacheKey, data)
        return data
      }
      
      return null
    } catch (error) {
      console.error('获取收入分析失败:', error)
      return null
    }
  }
  
  /**
   * 提交财务记录
   */
  static async submitFinanceRecord(record: Partial<TransactionRecord>): Promise<any> {
    try {
      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'createFinanceRecord',
          record: record
        }
      }) as CloudCallResult
      
      if (result?.success) {
        // 清除相关缓存
        this.clearRelatedCache('finance_overview')
        this.clearRelatedCache('cost_analysis')
        this.clearRelatedCache('revenue_analysis')
        return result
      }
      
      throw new Error(result?.error || '提交失败')
    } catch (error) {
      console.error('提交财务记录失败:', error)
      throw error
    }
  }
  
  /**
   * 执行AI财务分析
   */
  static async performAIAnalysis(params: {
    type: string
    dateRange?: any
    query?: string
  }): Promise<FinanceAnalysis> {
    try {
      const result = await safeCloudCall({
        name: 'ai-multi-model',
        data: {
          action: 'financeAnalysis',
          ...params
        }
      }) as CloudCallResult<FinanceAnalysis>
      
      if (result?.success && result.data) {
        return result.data
      }
      
      throw new Error(result?.error || 'AI分析失败')
    } catch (error) {
      console.error('AI财务分析失败:', error)
      throw error
    }
  }
  
  /**
   * 格式化金额显示
   */
  static formatMoney(value: number, unit: 'yuan' | 'wan' = 'yuan'): string {
    if (unit === 'wan') {
      if (value >= 100000000) {
        return (value / 100000000).toFixed(2) + '亿'
      }
      if (value >= 10000) {
        return (value / 10000).toFixed(2) + '万'
      }
    }
    
    // 格式化为千分位
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  
  /**
   * 计算增长率
   */
  static calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0
    }
    return ((current - previous) / Math.abs(previous)) * 100
  }
  
  /**
   * 设置缓存
   */
  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }
  
  /**
   * 获取缓存
   */
  private static getCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && cached.timestamp && cached.data) {
      if (Date.now() - cached.timestamp < this.cacheTime) {
        return cached.data
      }
      this.cache.delete(key)
    }
    return null
  }
  
  /**
   * 清除相关缓存
   */
  private static clearRelatedCache(prefix: string): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    })
  }
  
  /**
   * 清除所有缓存
   */
  static clearAllCache(): void {
    this.cache.clear()
  }
}
