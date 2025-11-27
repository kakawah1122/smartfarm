// miniprogram/packageHealth/abnormal-records-list/abnormal-records-list.ts

import { createPageWithNavbar } from '../../utils/navigation'
import { HealthCloud } from '../../utils/cloud-functions'
import { logger } from '../../utils/logger'
import type { AbnormalRecord } from '../types/abnormal'

interface AbnormalRecordsPageData {
  loading: boolean
  records: AbnormalRecord[]
  useVirtualList: boolean // 是否使用虚拟列表
  virtualListHeight: number // 虚拟列表容器高度（rpx）
}

interface RecordTapDataset {
  id?: string
}

type AbnormalRecordsPageCustom = {
  loadAbnormalRecords: () => Promise<void>
  onRecordTap: (event: WechatMiniprogram.TouchEvent<RecordTapDataset>) => void
  onVirtualRecordTap: (event: WechatMiniprogram.CustomEvent<{ id: string }>) => void
  calculateVirtualListHeight: () => void
}

type AbnormalRecordsPageInstance = WechatMiniprogram.Page.Instance<
  AbnormalRecordsPageData,
  AbnormalRecordsPageCustom
>

const initialAbnormalRecordsData: AbnormalRecordsPageData = {
  loading: true,
  records: [],
  useVirtualList: false, // 暂时禁用虚拟列表，回退到原版本
  virtualListHeight: 1000 // 默认高度
}

const abnormalRecordsPageConfig: WechatMiniprogram.Page.Options<
  AbnormalRecordsPageData,
  AbnormalRecordsPageCustom
> = {
  data: initialAbnormalRecordsData,

  onLoad() {
    this.calculateVirtualListHeight()
    void this.loadAbnormalRecords()
  },

  onShow() {
    void this.loadAbnormalRecords()
  },

  onPullDownRefresh() {
    void this.loadAbnormalRecords().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadAbnormalRecords() {
    const page = this as AbnormalRecordsPageInstance
    page.setData({ loading: true })

    try {
      const response = await HealthCloud.abnormal.list({ batchId: null })
      
      logger.info('[异常记录] 列表响应:', response?.success ? '成功' : '失败')

      if (response.success) {
        // ✅ 修复：正确获取记录列表，兼容两种数据结构
        const records = response.data?.list || response.data || []
        logger.info('[异常记录] 记录数量:', records.length)
        
        page.setData({
          records: records,
          loading: false
        })
      } else {
        throw new Error(response.error || '加载失败')
      }
    } catch (error) {
      page.setData({ loading: false })
      if (error instanceof Error) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        })
      }
    }
  },

  onRecordTap(event) {
    const { id } = event.currentTarget.dataset as RecordTapDataset
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/packageHealth/abnormal-record-detail/abnormal-record-detail?id=${id}`
    })
  },

  /**
   * 虚拟列表记录点击事件
   */
  onVirtualRecordTap(event) {
    const { id } = event.detail
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/packageHealth/abnormal-record-detail/abnormal-record-detail?id=${id}`
    })
  },

  /**
   * 计算虚拟列表容器高度
   */
  calculateVirtualListHeight() {
    const page = this as AbnormalRecordsPageInstance
    
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync()
    const windowHeight = systemInfo.windowHeight
    const navbarHeight = systemInfo.statusBarHeight ? systemInfo.statusBarHeight + 44 : 88 // 状态栏 + 导航栏
    
    // 计算可用高度（px转rpx，1px = 2rpx）
    const availableHeight = (windowHeight - navbarHeight) * 2
    
    page.setData({
      virtualListHeight: availableHeight
    })
  }
}

Page(createPageWithNavbar(abnormalRecordsPageConfig as any))

