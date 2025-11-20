/**
 * 生产管理页面数据加载模块
 * 负责处理数据加载、缓存、格式化
 */

/// <reference path="../../../../typings/index.d.ts" />

import CloudApi from '../../../utils/cloud-api'
import { logger } from '../../../utils/logger'

// 缓存配置
const OVERVIEW_CACHE_KEY = 'production_overview_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存
const MAX_RETRY_COUNT = 3 // 最大重试次数
const RETRY_DELAY = 1000 // 重试延迟（毫秒）

/**
 * 概览数据接口
 */
export interface OverviewData {
  entryStats: {
    total: string
    stockQuantity: string
    batches: string
  }
  exitStats: {
    total: string
    batches: string
    avgWeight: string
  }
  materialStats: {
    feed: string
    medicineStatus: string
    feedDetails: MaterialDetail
    medicineDetails: MaterialDetail
    equipmentDetails: MaterialDetail
  }
}

/**
 * 物料详情接口
 */
export interface MaterialDetail {
  statusText: string
  status: 'empty' | 'warning' | 'normal' | string
  totalCount: number
  description: string
}

/**
 * 缓存数据接口
 */
interface CachedOverviewData {
  data: OverviewData
  timestamp: number
}

/**
 * 生产数据加载器
 */
export class ProductionDataLoader {
  
  /**
   * 获取缓存的概览数据
   */
  static getCachedOverviewData(): OverviewData | null {
    try {
      const cached = wx.getStorageSync(OVERVIEW_CACHE_KEY) as CachedOverviewData
      
      if (!cached || !cached.timestamp || !cached.data) {
        return null
      }
      
      // 检查缓存是否过期
      if (Date.now() - cached.timestamp > CACHE_DURATION) {
        wx.removeStorageSync(OVERVIEW_CACHE_KEY)
        return null
      }
      
      return cached.data
    } catch (error) {
      logger.error('获取缓存数据失败:', error)
      return null
    }
  }
  
  /**
   * 设置缓存的概览数据
   */
  static setCachedOverviewData(data: OverviewData): void {
    try {
      const cacheData: CachedOverviewData = {
        data,
        timestamp: Date.now()
      }
      wx.setStorageSync(OVERVIEW_CACHE_KEY, cacheData)
    } catch (error) {
      logger.error('设置缓存数据失败:', error)
    }
  }
  
  /**
   * 清除缓存
   */
  static clearCache(): void {
    try {
      wx.removeStorageSync(OVERVIEW_CACHE_KEY)
    } catch (error) {
      logger.error('清除缓存失败:', error)
    }
  }
  
  /**
   * 加载概览数据
   */
  static async loadOverviewData(forceRefresh = false, retryCount = 0): Promise<OverviewData | null> {
    // 如果不强制刷新，尝试使用缓存
    if (!forceRefresh && retryCount === 0) {
      const cachedData = this.getCachedOverviewData()
      if (cachedData) {
        logger.info('使用缓存的概览数据')
        return cachedData
      }
    }
    
    try {
      const result = await CloudApi.callFunction<any>(
        'production-dashboard',
        { action: 'getOverview' },
        { showError: false }
      )
      
      if (result.success && result.data) {
        const data = result.data
        
        // 格式化材料统计数据
        const materialStats = {
          feed: data.material?.feedStock || '0',
          medicineStatus: data.material?.medicineStatus || '无数据',
          feedDetails: data.material?.categoryDetails?.feed || {
            statusText: '无数据',
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          },
          medicineDetails: data.material?.categoryDetails?.medicine || {
            statusText: '无数据',
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          },
          equipmentDetails: data.material?.categoryDetails?.equipment || {
            statusText: '无数据',
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          }
        }
        
        const overviewData: OverviewData = {
          entryStats: {
            total: data.entry?.total || '0',
            stockQuantity: data.entry?.stockQuantity || '0',
            batches: data.entry?.batches || '0'
          },
          exitStats: {
            total: data.exit?.total || '0',
            batches: data.exit?.batches || '0',
            avgWeight: data.exit?.avgWeight || '0.0'
          },
          materialStats
        }
        
        // 保存到缓存
        this.setCachedOverviewData(overviewData)
        
        return overviewData
      }
      
      return null
    } catch (error: any) {
      // 添加错误重试机制
      if (retryCount < MAX_RETRY_COUNT) {
        logger.warn(`概览数据加载失败，${RETRY_DELAY}ms后重试 (${retryCount + 1}/${MAX_RETRY_COUNT}):`, error)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return this.loadOverviewData(forceRefresh, retryCount + 1)
      }
      
      logger.error('概览数据加载失败，已重试' + MAX_RETRY_COUNT + '次:', error)
      
      // 如果是云函数不存在的错误，给出友好提示
      if (error.errMsg && error.errMsg.includes('function not found')) {
        wx.showModal({
          title: '系统提示',
          content: '生产管理云函数尚未部署，请先部署云函数后再使用。',
          showCancel: false
        })
      }
      
      throw error
    }
  }
  
  /**
   * 加载入栏记录
   */
  static async loadEntryRecords(page = 1, pageSize = 10): Promise<any[]> {
    try {
      const result = await CloudApi.callFunction<any>(
        'production-entry',
        {
          action: 'list',
          page,
          pageSize
        },
        { showError: false }
      )
      
      if (result.success && result.data) {
        const records = result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 格式化记录
        return records.map((record: any) => ({
          ...record,
          id: record._id || record.batchNumber,
          batchNumber: record.batchNumber || record._id,
          breed: record.breed || '未知品种',
          supplier: record.supplier || '',
          quantity: record.quantity || 0,
          avgWeight: record.avgWeight || 0,
          operator: (!record.operator || record.operator === '未知') ? currentUser : record.operator,
          status: record.status || '已完成',
          date: record.entryDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          entryDate: record.entryDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          displayTitle: record.breed || '未知品种'
        }))
      }
      
      return []
    } catch (error) {
      logger.error('加载入栏记录失败:', error)
      return []
    }
  }
  
  /**
   * 加载出栏记录
   */
  static async loadExitRecords(page = 1, pageSize = 10): Promise<any[]> {
    try {
      const result = await CloudApi.callFunction<any>(
        'production-exit',
        {
          action: 'list',
          page,
          pageSize
        },
        { showError: false }
      )
      
      if (result.success && result.data) {
        const records = result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 格式化记录
        return records.map((record: any) => ({
          ...record,
          id: record._id || record.exitNumber,
          exitNumber: record.exitNumber || record._id,
          batchNumber: record.batchNumber || '',
          breed: record.breed || '未知品种',
          customer: record.customer || '',
          quantity: record.quantity || 0,
          avgWeight: record.avgWeight || 0,
          totalWeight: record.totalWeight || 0,
          operator: (!record.operator || record.operator === '未知') ? currentUser : record.operator,
          status: record.status || '已完成',
          date: record.exitDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          exitDate: record.exitDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          displayTitle: record.customer || '未知客户'
        }))
      }
      
      return []
    } catch (error) {
      logger.error('加载出栏记录失败:', error)
      return []
    }
  }
  
  /**
   * 加载物料记录
   */
  static async loadMaterialRecords(page = 1, pageSize = 10): Promise<any[]> {
    try {
      const result = await CloudApi.callFunction<any>(
        'production-material',
        {
          action: 'list',
          page,
          pageSize
        },
        { showError: false }
      )
      
      if (result.success && result.data) {
        const records = result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 格式化记录
        return records.map((record: any) => ({
          ...record,
          id: record._id || record.recordNumber,
          recordNumber: record.recordNumber || record._id,
          material: record.material || { name: '未知物料', category: '其他', unit: '个' },
          recordType: record.recordType || record.type || 'unknown',
          supplier: record.supplier || '',
          targetLocation: record.targetLocation || '',
          batchNumber: record.batchNumber || '',
          quantity: record.quantity || 0,
          costPerBird: record.costPerBird || 0,
          dayAge: record.dayAge || 0,
          currentStock: record.currentStock || 0,
          totalWeight: record.totalWeight || 0,
          operator: (!record.operator || record.operator === '未知') ? currentUser : record.operator,
          status: record.status || '已完成',
          date: record.recordDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          recordDate: record.recordDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          displayType: this.getDisplayType(record.recordType || record.type),
          displayDescription: this.getDisplayDescription(record)
        }))
      }
      
      return []
    } catch (error) {
      logger.error('加载物料记录失败:', error)
      return []
    }
  }
  
  /**
   * 获取显示类型
   */
  private static getDisplayType(type: string): string {
    const typeMap: Record<string, string> = {
      purchase: '采购',
      feed: '投喂',
      use: '领用',
      return: '退库',
      adjustment: '盘点调整'
    }
    return typeMap[type] || type || '未知'
  }
  
  /**
   * 获取显示描述
   */
  private static getDisplayDescription(record: any): string {
    const type = record.recordType || record.type
    const material = record.material?.name || '物料'
    const quantity = record.quantity || 0
    const unit = record.material?.unit || '个'
    
    switch (type) {
      case 'purchase':
        return `采购${material} ${quantity}${unit}`
      case 'feed':
        return `投喂${material} ${quantity}${unit}`
      case 'use':
        return `领用${material} ${quantity}${unit}`
      case 'return':
        return `退库${material} ${quantity}${unit}`
      case 'adjustment':
        return `盘点调整${material} ${quantity}${unit}`
      default:
        return `${material} ${quantity}${unit}`
    }
  }
  
  /**
   * 获取默认统计数据
   */
  static getDefaultStats(): OverviewData {
    return {
      entryStats: {
        total: '0',
        stockQuantity: '0',
        batches: '0'
      },
      exitStats: {
        total: '0',
        batches: '0',
        avgWeight: '0.0'
      },
      materialStats: {
        feed: '0',
        medicineStatus: '无数据',
        feedDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        },
        medicineDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        },
        equipmentDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        }
      }
    }
  }
}

/**
 * 导出便捷方法
 */
export const loadOverviewData = ProductionDataLoader.loadOverviewData.bind(ProductionDataLoader)
export const loadEntryRecords = ProductionDataLoader.loadEntryRecords.bind(ProductionDataLoader)
export const loadExitRecords = ProductionDataLoader.loadExitRecords.bind(ProductionDataLoader)
export const loadMaterialRecords = ProductionDataLoader.loadMaterialRecords.bind(ProductionDataLoader)
export const clearCache = ProductionDataLoader.clearCache.bind(ProductionDataLoader)
export const getDefaultStats = ProductionDataLoader.getDefaultStats.bind(ProductionDataLoader)
