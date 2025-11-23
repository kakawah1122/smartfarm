/**
 * 健康管理 - 监控数据模块
 * 负责实时健康监控、异常记录管理等功能
 * 保持原有功能和UI完全不变
 */

import { createDataUpdater } from '../helpers/data-updater'
import { normalizeDiagnosisRecords, type DiagnosisRecord } from '../../../utils/diagnosis-data-utils'
import CloudApi from '../../../utils/cloud-api'

/**
 * 按时间排序诊断记录
 */
function sortDiagnosisByRecency(records: DiagnosisRecord[]): DiagnosisRecord[] {
  const getTimeValue = (item: DiagnosisRecord): number => {
    const rawTime = item.createTime || item.diagnosisDate || ''
    if (!rawTime) return 0

    let parsed: number
    if (rawTime.includes('T')) {
      parsed = Date.parse(rawTime)
    } else {
      // 兼容 iOS：将 "YYYY-MM-DD HH:mm" 转换为可解析格式
      parsed = Date.parse(rawTime.replace(/-/g, '/'))
    }

    return Number.isNaN(parsed) ? 0 : parsed
  }

  return [...records].sort((a, b) => getTimeValue(b) - getTimeValue(a))
}

// 监控数据模块管理器
export class MonitoringModuleManager {
  private pageInstance: any
  
  constructor(pageInstance: Record<string, unknown>) {
    this.pageInstance = pageInstance
  }
  
  /**
   * 加载监控数据
   */
  async loadMonitoringData() {
    try {
      // 如果没有实时状态数据，使用健康统计数据填充
      const currentData = this.pageInstance.data.monitoringData?.realTimeStatus || {}
      
      // 如果当前批次不是全部批次，且监控数据为空，使用健康统计数据填充
      if (this.pageInstance.data.currentBatchId !== 'all' && 
          (!currentData.healthyCount && !currentData.abnormalCount)) {
        this.pageInstance.setData({
          'monitoringData.realTimeStatus': {
            healthyCount: this.pageInstance.data.healthStats.healthyCount || 0,
            abnormalCount: this.pageInstance.data.healthStats.abnormalCount || 0
          },
          'monitoringData.abnormalList': [],
          'monitoringData.diseaseDistribution': []
        })
      }
    } catch (error: unknown) {
      console.error('加载监控数据失败:', error)
      wx.showToast({
        title: '加载监控数据失败',
        icon: 'none'
      })
    }
  }
  
  /**
   * 更新监控数据
   */
  updateMonitoringData(healthData: any) {
    const updater = createDataUpdater()
    
    // 更新实时状态
    updater
      .set('monitoringData.realTimeStatus.abnormalCount', healthData.abnormalRecordCount || 0)
    
    // 更新异常列表（使用分页器）
    if (this.pageInstance.abnormalListPaginator && healthData.abnormalRecords) {
      this.pageInstance.abnormalListPaginator.setItems(healthData.abnormalRecords)
      const initialPage = this.pageInstance.abnormalListPaginator.getInitialPage()
      updater.set('monitoringData.abnormalList', initialPage.items)
    } else {
      updater.set('monitoringData.abnormalList', healthData.abnormalRecords || [])
    }
    
    this.pageInstance.setData(updater.build())
  }
  
  /**
   * 从全部批次数据更新监控信息
   */
  updateMonitoringFromAllBatches(abnormalCount: number, abnormalRecords: unknown[]) {
    const updater = createDataUpdater()
    
    updater
      .set('monitoringData.realTimeStatus.abnormalCount', abnormalCount)
      .set('monitoringData.abnormalList', sortDiagnosisByRecency(normalizeDiagnosisRecords(abnormalRecords)))
    
    this.pageInstance.setData(updater.build())
  }
  
  /**
   * 从聚合数据更新监控信息
   */
  updateMonitoringFromAggregated(aggregatedData: any) {
    this.pageInstance.setData({
      'monitoringData.realTimeStatus.abnormalCount': aggregatedData.abnormalRecordCount || 0,
      'monitoringData.abnormalList': sortDiagnosisByRecency(
        normalizeDiagnosisRecords(aggregatedData.abnormalRecords || [])
      )
    })
  }
  
  /**
   * 加载更多异常记录
   */
  loadMoreAbnormalRecords() {
    if (!this.pageInstance.abnormalListPaginator) return
    
    const nextPage = this.pageInstance.abnormalListPaginator.getNextPage()
    if (nextPage && nextPage.items.length > 0) {
      // 追加新数据到现有列表
      const currentList = this.pageInstance.data.monitoringData.abnormalList || []
      this.pageInstance.setData({
        'monitoringData.abnormalList': currentList.concat(nextPage.items)
      })
    }
  }
  
  /**
   * 导航到异常记录列表
   */
  goToAbnormalList() {
    const { currentBatchId, currentBatchNumber } = this.pageInstance.data
    wx.navigateTo({
      url: `/packageHealth/abnormal-record-list/abnormal-record-list?batchId=${currentBatchId}&batchNumber=${currentBatchNumber}`
    })
  }
  
  /**
   * 导航到异常记录详情
   */
  navigateToAbnormalDetail(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.currentTarget.dataset
    if (id) {
      wx.navigateTo({
        url: `/packageHealth/abnormal-record-detail/abnormal-record-detail?id=${id}`
      })
    }
  }
  
  /**
   * 创建新的异常记录
   */
  async createAbnormalRecord(data: unknown): Promise<boolean> {
    try {
      wx.showLoading({ title: '创建中...' })
      
      const result = await CloudApi.callFunction(
        'health-abnormal',
        {
          action: 'create',
          data: {
            batchId: this.pageInstance.data.currentBatchId,
            batchNumber: this.pageInstance.data.currentBatchNumber,
            ...data
          }
        }
      ) as any
      
      wx.hideLoading()
      
      if (result?.result?.success) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        })
        
        // 刷新监控数据
        await this.loadMonitoringData()
        return true
      } else {
        throw new Error(result?.result?.error || '创建失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      })
      return false
    }
  }
}

/**
 * 创建监控模块实例
 */
export function createMonitoringModule(pageInstance: Record<string, unknown>) {
  return new MonitoringModuleManager(pageInstance)
}
