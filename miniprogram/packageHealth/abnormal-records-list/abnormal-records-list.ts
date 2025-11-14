// miniprogram/packageHealth/abnormal-records-list/abnormal-records-list.ts

import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import type { AbnormalRecord } from '../types/abnormal'

interface AbnormalRecordsPageData {
  loading: boolean
  records: AbnormalRecord[]
}

interface RecordTapDataset {
  id?: string
}

type AbnormalRecordsPageCustom = {
  loadAbnormalRecords: () => Promise<void>
  onRecordTap: (event: WechatMiniprogram.TouchEvent<RecordTapDataset>) => void
}

type AbnormalRecordsPageInstance = WechatMiniprogram.Page.Instance<
  AbnormalRecordsPageData,
  AbnormalRecordsPageCustom
>

const initialAbnormalRecordsData: AbnormalRecordsPageData = {
  loading: true,
  records: []
}

const abnormalRecordsPageConfig: WechatMiniprogram.Page.Options<
  AbnormalRecordsPageData,
  AbnormalRecordsPageCustom
> = {
  data: initialAbnormalRecordsData,

  onLoad() {
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
      const response = await CloudApi.callFunction<AbnormalRecord[]>(
        'health-management',
        {
          action: 'get_abnormal_records',
          batchId: null
        },
        {
          loading: true,
          loadingText: '加载异常记录...',
          showError: false
        }
      )

      if (response.success) {
        page.setData({
          records: response.data || [],
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
  }
}

Page(createPageWithNavbar(abnormalRecordsPageConfig))

