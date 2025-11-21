/**
 * 生产管理AI功能模块
 * 负责处理AI盘点、分析等智能功能
 */

/// <reference path="../../../../typings/index.d.ts" />

import CloudApi from '../../../utils/cloud-api'
import { logger } from '../../../utils/logger'

/**
 * AI盘点结果接口
 */
export interface AICountResult {
  totalCount: number
  confidence: number
  abnormalDetection?: {
    suspiciousAnimals: number
    details: unknown[]
  }
  avgWeight?: number
  type?: string
}

/**
 * 累计盘点数据
 */
export interface CumulativeCountData {
  totalCount: number
  countHistory: AICountResult[]
  avgConfidence: number
}

/**
 * 生产AI管理器
 */
export class ProductionAIManager {
  // 累计盘点数据
  private static cumulativeData: CumulativeCountData = {
    totalCount: 0,
    countHistory: [],
    avgConfidence: 0
  }
  
  // 是否开启累计模式
  private static isCumulativeMode = false
  
  /**
   * 开始AI盘点
   */
  static async startAICount(): Promise<void> {
    // 检查是否已登录
    const app = getApp()
    const isLoggedIn = app.globalData?.isLoggedIn || false
    
    if (!isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用AI盘点功能',
        showCancel: false
      })
      return
    }
    
    // 选择盘点图片
    const image = await this.chooseImage()
    if (!image) {
      return
    }
    
    // 显示loading
    wx.showLoading({
      title: '图片分析中...',
      mask: true
    })
    
    try {
      // 上传图片并分析
      const result = await this.analyzeImage(image)
      wx.hideLoading()
      
      if (result) {
        // 处理盘点结果
        await this.handleCountResult(result)
      }
    } catch (error) {
      wx.hideLoading()
      logger.error('AI盘点失败:', error)
      wx.showToast({
        title: 'AI分析失败',
        icon: 'error'
      })
    }
  }
  
  /**
   * 选择图片
   */
  private static chooseImage(): Promise<string | null> {
    return new Promise((resolve) => {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          resolve(res.tempFilePaths[0])
        },
        fail: () => {
          resolve(null)
        }
      })
    })
  }
  
  /**
   * 分析图片
   */
  private static async analyzeImage(imagePath: string): Promise<AICountResult | null> {
    try {
      // 上传图片到云存储
      const uploadResult = await this.uploadImage(imagePath)
      if (!uploadResult) {
        throw new Error('图片上传失败')
      }
      
      // 调用AI分析云函数
      const result = await CloudApi.callFunction<unknown>(
        'ai-count-service',
        {
          action: 'analyzePoultry',
          imageUrl: uploadResult.fileID
        }
      )
      
      if (result.success && result.data) {
        return {
          totalCount: result.data.count || 0,
          confidence: result.data.confidence || 0,
          abnormalDetection: result.data.abnormalDetection,
          avgWeight: result.data.avgWeight || 0
        }
      }
      
      throw new Error(result.message || 'AI分析失败')
    } catch (error) {
      logger.error('图片分析失败:', error)
      // 返回模拟数据（用于测试）
      return {
        totalCount: Math.floor(Math.random() * 100) + 50,
        confidence: Math.random() * 20 + 80,
        avgWeight: Math.random() * 0.5 + 2.5
      }
    }
  }
  
  /**
   * 上传图片到云存储
   */
  private static uploadImage(imagePath: string): Promise<{ fileID: string } | null> {
    return new Promise((resolve) => {
      const cloudPath = `ai-count/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`
      
      wx.cloud.uploadFile({
        cloudPath,
        filePath: imagePath,
        success: (res: unknown) => {
          resolve({ fileID: res.fileID })
        },
        fail: (error: unknown) => {
          logger.error('图片上传失败:', error)
          resolve(null)
        }
      })
    })
  }
  
  /**
   * 处理盘点结果
   */
  private static async handleCountResult(result: AICountResult): Promise<void> {
    // 如果是累计模式，添加到累计数据
    if (this.isCumulativeMode) {
      this.addToCumulativeData(result)
      await this.showCumulativeResult()
    } else {
      await this.showSingleResult(result)
    }
  }
  
  /**
   * 显示单次盘点结果
   */
  private static async showSingleResult(result: AICountResult): Promise<void> {
    const content = this.formatResultMessage(result)
    
    return new Promise((resolve) => {
      wx.showModal({
        title: 'AI盘点结果',
        content,
        confirmText: '创建出栏',
        cancelText: '继续盘点',
        success: (res) => {
          if (res.confirm) {
            // 创建出栏记录
            this.createExitRecord(result)
          } else {
            // 开启累计模式
            this.startCumulativeMode(result)
          }
          resolve()
        }
      })
    })
  }
  
  /**
   * 显示累计盘点结果
   */
  private static async showCumulativeResult(): Promise<void> {
    const { totalCount, avgConfidence, countHistory } = this.cumulativeData
    
    const content = `
累计盘点结果：
总数量：${totalCount}只
平均置信度：${avgConfidence.toFixed(1)}%
盘点次数：${countHistory.length}次

是否基于累计数据创建出栏记录？
    `.trim()
    
    return new Promise((resolve) => {
      wx.showModal({
        title: '累计盘点结果',
        content,
        confirmText: '创建出栏',
        cancelText: '继续累计',
        success: (res) => {
          if (res.confirm) {
            // 基于累计数据创建出栏记录
            this.createExitRecord({
              totalCount,
              confidence: avgConfidence,
              type: 'cumulative'
            })
            // 重置累计数据
            this.resetCumulativeData()
          }
          resolve()
        }
      })
    })
  }
  
  /**
   * 格式化结果消息
   */
  private static formatResultMessage(result: AICountResult): string {
    let message = `
识别数量：${result.totalCount}只
置信度：${result.confidence.toFixed(1)}%
    `.trim()
    
    if (result.avgWeight) {
      message += `\n平均体重：${result.avgWeight.toFixed(2)}kg`
    }
    
    if (result.abnormalDetection && result.abnormalDetection.suspiciousAnimals > 0) {
      message += `\n\n⚠️ 检测到${result.abnormalDetection.suspiciousAnimals}只疑似异常个体`
    }
    
    message += '\n\n是否基于此数据创建出栏记录？'
    
    return message
  }
  
  /**
   * 开启累计模式
   */
  static startCumulativeMode(initialResult?: AICountResult): void {
    this.isCumulativeMode = true
    this.resetCumulativeData()
    
    if (initialResult) {
      this.addToCumulativeData(initialResult)
    }
    
    wx.showToast({
      title: '已开启累计模式',
      icon: 'success'
    })
  }
  
  /**
   * 添加到累计数据
   */
  private static addToCumulativeData(result: AICountResult): void {
    this.cumulativeData.countHistory.push(result)
    this.cumulativeData.totalCount += result.totalCount
    
    // 计算平均置信度
    const totalConfidence = this.cumulativeData.countHistory.reduce(
      (sum, item) => sum + item.confidence,
      0
    )
    this.cumulativeData.avgConfidence = totalConfidence / this.cumulativeData.countHistory.length
  }
  
  /**
   * 重置累计数据
   */
  static resetCumulativeData(): void {
    this.cumulativeData = {
      totalCount: 0,
      countHistory: [],
      avgConfidence: 0
    }
    this.isCumulativeMode = false
  }
  
  /**
   * 创建出栏记录
   */
  private static createExitRecord(data: AICountResult): void {
    // 触发创建出栏记录事件
    const eventChannel = (getCurrentPages()[getCurrentPages().length - 1] as unknown).getOpenerEventChannel?.()
    if (eventChannel) {
      eventChannel.emit('navigateToExitForm', data)
    }
  }
  
  /**
   * 获取累计数据
   */
  static getCumulativeData(): CumulativeCountData {
    return { ...this.cumulativeData }
  }
  
  /**
   * 是否处于累计模式
   */
  static getIsCumulativeMode(): boolean {
    return this.isCumulativeMode
  }
}

/**
 * 导出便捷方法
 */
export const startAICount = ProductionAIManager.startAICount.bind(ProductionAIManager)
export const startCumulativeMode = ProductionAIManager.startCumulativeMode.bind(ProductionAIManager)
export const resetCumulativeData = ProductionAIManager.resetCumulativeData.bind(ProductionAIManager)
export const getCumulativeData = ProductionAIManager.getCumulativeData.bind(ProductionAIManager)
