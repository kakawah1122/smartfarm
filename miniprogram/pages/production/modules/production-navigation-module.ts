/**
 * 生产管理页面导航模块
 * 负责处理所有页面跳转逻辑
 */

/// <reference path="../../../../typings/index.d.ts" />

import NavigationManager from '../../../modules/common/navigation-manager'
import { logger } from '../../../utils/logger'

/**
 * 生产管理导航管理器
 */
export class ProductionNavigationManager {
  
  /**
   * 新增入栏记录
   */
  static navigateToEntryForm() {
    return NavigationManager.navigate('/packageProduction/entry-form/entry-form')
  }
  
  /**
   * 新增出栏记录
   */
  static navigateToExitForm(params?: {
    fromAI?: boolean
    totalCount?: number
    avgWeight?: number
    confidence?: number
    abnormalCount?: number
    type?: string
  }) {
    let url = '/packageProduction/exit-form/exit-form'
    
    if (params && Object.keys(params).length > 0) {
      const urlParams = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
      url += '?' + urlParams
    }
    
    return NavigationManager.navigate(url)
  }
  
  /**
   * 查看库存详情
   */
  static navigateToInventoryDetail(category?: string) {
    let url = '/packageProduction/inventory-detail/inventory-detail'
    if (category) {
      url += `?category=${encodeURIComponent(category)}`
    }
    return NavigationManager.navigate(url)
  }
  
  /**
   * 查看饲料库存
   */
  static navigateToFeedInventory() {
    return this.navigateToInventoryDetail('饲料')
  }
  
  /**
   * 查看药品库存
   */
  static navigateToMedicineInventory() {
    return this.navigateToInventoryDetail('药品')
  }
  
  /**
   * 查看设备物料
   */
  static navigateToEquipmentInventory() {
    return this.navigateToInventoryDetail('设备')
  }
  
  /**
   * 采购物料
   */
  static navigateToPurchaseForm() {
    return NavigationManager.navigate('/packageProduction/purchase-form/purchase-form')
  }
  
  /**
   * 领用物料
   */
  static navigateToMaterialUseForm() {
    return NavigationManager.navigate('/packageProduction/material-use-form/material-use-form')
  }
  
  /**
   * 饲料投喂记录
   */
  static navigateToFeedUsageForm() {
    return NavigationManager.navigate('/packageProduction/feed-usage-form/feed-usage-form')
  }
  
  /**
   * 查看全部物料记录
   */
  static navigateToMaterialRecordsList() {
    return NavigationManager.navigate('/packageProduction/material-records-list/material-records-list')
      .catch((error) => {
        logger.error('导航到物料记录列表失败:', error)
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
        throw error
      })
  }
  
  /**
   * 查看全部入栏记录
   */
  static navigateToEntryRecordsList() {
    return NavigationManager.navigate('/packageProduction/entry-records-list/entry-records-list')
      .catch((error) => {
        logger.error('导航到入栏记录列表失败:', error)
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
        throw error
      })
  }
  
  /**
   * 查看全部出栏记录
   */
  static navigateToExitRecordsList() {
    return NavigationManager.navigate('/packageProduction/exit-records-list/exit-records-list')
      .catch((error) => {
        logger.error('导航到出栏记录列表失败:', error)
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
        throw error
      })
  }
  
  /**
   * 批量创建导航函数
   */
  static createNavigationHandlers() {
    return {
      // 入栏相关
      addEntry: this.navigateToEntryForm.bind(this),
      viewAllEntryRecords: this.navigateToEntryRecordsList.bind(this),
      
      // 出栏相关
      addExit: () => this.navigateToExitForm(),
      viewAllExitRecords: this.navigateToExitRecordsList.bind(this),
      navigateToExitForm: (params: unknown) => this.navigateToExitForm(params),
      
      // 库存相关
      viewInventoryDetail: this.navigateToInventoryDetail.bind(this),
      viewFeedInventory: this.navigateToFeedInventory.bind(this),
      viewMedicineInventory: this.navigateToMedicineInventory.bind(this),
      viewEquipmentInventory: this.navigateToEquipmentInventory.bind(this),
      
      // 物料操作
      purchaseMaterial: this.navigateToPurchaseForm.bind(this),
      useMaterial: this.navigateToMaterialUseForm.bind(this),
      recordFeedUsage: this.navigateToFeedUsageForm.bind(this),
      viewAllMaterialRecords: this.navigateToMaterialRecordsList.bind(this)
    }
  }
}

/**
 * 导出便捷方法
 */
export const navigateToEntryForm = ProductionNavigationManager.navigateToEntryForm
export const navigateToExitForm = ProductionNavigationManager.navigateToExitForm
export const navigateToInventoryDetail = ProductionNavigationManager.navigateToInventoryDetail
export const navigateToPurchaseForm = ProductionNavigationManager.navigateToPurchaseForm

/**
 * 设置导航处理器
 */
export function setupNavigationHandlers(pageInstance: unknown) {
  const handlers = ProductionNavigationManager.createNavigationHandlers()
  
  // 绑定到页面实例
  Object.keys(handlers).forEach(key => {
    if (!pageInstance[key]) {
      pageInstance[key] = handlers[key as keyof typeof handlers]
    }
  })
}
