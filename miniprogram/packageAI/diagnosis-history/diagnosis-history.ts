// diagnosis-history.ts - 诊断历史页面
import { createPageWithNavbar, PageConfigWithLifecycle, NavbarData } from '../../utils/navigation'
import { logger } from '../../utils/logger'
import { processImageUrls } from '../../utils/image-utils'
import { normalizeDiagnosisRecords } from '../../utils/diagnosis-data-utils'

// 诊断记录接口
interface DiagnosisRecord {
  _id: string
  symptoms: string
  diagnosisResult: string
  possibleDiseases: string[]
  recommendedMedications: string[]
  treatmentDuration: string
  confidence: number
  status: string
  createTime: string
  diagnosisDate?: string
  affectedCount: number
  dayAge: number
  temperature: number
  images?: string[]
}

// 页面数据接口
interface PageData extends NavbarData {
  records: DiagnosisRecord[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasMore: boolean
  }
  activeStatus: string
  statusOptions: { value: string; label: string }[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  selectedRecord: DiagnosisRecord | null
  showDetailDialog: boolean
  hasLoaded: boolean
}

// 页面实例类型
type PageInstance = PageConfigWithLifecycle<PageData> & {
  loadDiagnosisHistory: () => Promise<void>
  refreshData: () => Promise<void>
  loadMoreData: () => Promise<void>
  updateDiagnosisStatus: (recordId: string, newStatus: string) => Promise<void>
  deleteRecord: (recordId: string) => Promise<void>
}

const getRecordTimestamp = (record: DiagnosisRecord): number => {
  const timeStr = record.createTime || record.diagnosisDate || ''
  if (!timeStr) return 0

  let parsed = Date.parse(timeStr)
  if (!Number.isNaN(parsed)) {
    return parsed
  }

  parsed = Date.parse(timeStr.replace(/-/g, '/'))
  return Number.isNaN(parsed) ? 0 : parsed
}

const sortRecordsByLatest = (records: DiagnosisRecord[]): DiagnosisRecord[] =>
  [...records].sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a))

// 页面配置对象
const pageConfig = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },
  
  data: {
    // 诊断记录列表
    records: [] as DiagnosisRecord[],
    
    // 分页信息
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      hasMore: true
    },
    
    // 筛选状态
    activeStatus: 'all', // all, pending_confirmation, adopted, confirmed
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending_confirmation', label: '待确认' },
      { value: 'adopted', label: '已采纳' },
      { value: 'confirmed', label: '已确诊' }
    ],
    
    // 页面状态
    loading: true,
    refreshing: false,
    loadingMore: false,
    
    // 选中的记录
    selectedRecord: null as DiagnosisRecord | null,
    showDetailDialog: false,
    
    // ✅ 标记是否已经完成首次加载
    hasLoaded: false
  },

  onLoad(this: PageInstance) {
    // ✅ 诊断历史始终显示所有批次的记录，不受批次筛选影响
    this.loadDiagnosisHistory()
  },

  onShow(this: PageInstance) {
    // ✅ 修复：只在页面已经完成首次加载的情况下刷新数据，避免覆盖首次加载
    if (this.data.hasLoaded) {
      this.refreshData()
    }
  },

  onPullDownRefresh(this: PageInstance) {
    this.refreshData()
  },

  onReachBottom(this: PageInstance) {
    this.loadMoreData()
  },

  onUnload() {
    this._clearAllTimers()
  },

  // 返回上一页
  goBack() {
    // 防止重复触发
    if ((this as PageInstance).__isNavigatingBack) {
      return
    }
    
    (this as PageInstance).__isNavigatingBack = true
    
    wx.navigateBack({
      delta: 1,
      complete: () => {
        // 500ms后清除标志
        this._safeSetTimeout(() => {
          (this as PageInstance).__isNavigatingBack = false
        }, 500)
      },
      fail: () => {
        // 返回失败，跳转到健康管理页
        wx.switchTab({
          url: '/pages/health/health'
        })
      }
    })
  },

  // 跳转到AI诊断页面
  goToDiagnosis() {
    wx.navigateTo({
      url: '/packageAI/ai-diagnosis/ai-diagnosis'
    })
  },

  // 刷新数据
  async refreshData(this: PageInstance) {
    this.setData({
      refreshing: true,
      'pagination.page': 1,
      'pagination.hasMore': true,
      records: []
    })
    
    await this.loadDiagnosisHistory()
    
    this.setData({ refreshing: false })
    wx.stopPullDownRefresh()
  },

  // 加载更多数据
  async loadMoreData(this: PageInstance) {
    if (!this.data.pagination.hasMore || this.data.loadingMore) {
      return
    }

    this.setData({ loadingMore: true })
    
    const nextPage = this.data.pagination.page + 1
    this.setData({ 'pagination.page': nextPage })
    
    await this.loadDiagnosisHistory(false)
    
    this.setData({ loadingMore: false })
  },

  // 加载诊断历史
  async loadDiagnosisHistory(this: unknown, showLoading = true) {
    if (showLoading) {
      this.setData({ loading: true })
    }

    try {
      // ✅ 诊断记录不受批次筛选影响，始终显示所有批次的记录
      // ✅ 调用 ai-diagnosis 云函数查询诊断历史
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'get_diagnosis_history',
          page: this.data.pagination.page,
          pageSize: this.data.pagination.pageSize,
        }
      })

      if (result.result && result.result.success) {
        const { records, pagination } = result.result.data
        
        // ✅ 使用公共工具函数标准化数据
        const processedRecords = normalizeDiagnosisRecords(records)

        const existingRecords = this.data.pagination.page === 1 ? [] : this.data.records
        const mergedRecords = [...existingRecords, ...processedRecords]

        this.setData({
          records: sortRecordsByLatest(mergedRecords),
          pagination: {
            ...pagination,
            hasMore: pagination.page < pagination.totalPages
          },
          // ✅ 标记首次加载完成
          hasLoaded: true
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error: unknown) {
      // 已移除调试日志
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      // ✅ 即使加载失败也标记为已加载，避免 onShow 重复刷新
      this.setData({ hasLoaded: true })
    } finally {
      if (showLoading) {
        this.setData({ loading: false })
      }
    }
  },

  // 状态筛选切换
  onStatusChange(this: unknown, e: unknown) {
    const { value } = e.detail
    if (value !== this.data.activeStatus) {
      this.setData({ 
        activeStatus: value,
        'pagination.page': 1,
        'pagination.hasMore': true,
        records: []
      })
      this.loadDiagnosisHistory()
    }
  },

  // 查看诊断详情
  async onViewRecord(this: unknown, e: unknown) {
    const { record } = e.currentTarget.dataset
    
    // ✅ 使用公共工具函数处理图片URL
    const processedImages = await processImageUrls(record.images || [], {
      onlyCloudFiles: false,
      showErrorToast: false
    })
    
    this.setData({
      selectedRecord: {
        ...record,
        images: processedImages
      },
      showDetailDialog: true
    })
  },

  // 关闭详情对话框
  onCloseDetail(this: PageInstance) {
    this.setData({
      showDetailDialog: false,
      selectedRecord: null
    })
  },

  // 预览图片
  onPreviewImage(this: unknown, e: unknown) {
    const { url } = e.currentTarget.dataset
    const images = this.data.selectedRecord?.images || []
    
    if (images.length > 0) {
      wx.previewImage({
        current: url,
        urls: images
      })
    }
  },

  // 从详情弹窗创建治疗方案
  onCreateTreatmentFromDetail(this: PageInstance) {
    const record = this.data.selectedRecord
    if (!record) return

    // 关闭弹窗
    this.setData({
      showDetailDialog: false
    })

    // 跳转到治疗记录创建页面，传递诊断信息
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?mode=create&diagnosisId=${record._id}&diagnosis=${encodeURIComponent(record.diagnosisResult)}`
    })
  },

  // 创建治疗方案
  onCreateTreatment(this: unknown, e: unknown) {
    const { record } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?diagnosisId=${record._id}`
    })
  },

  // 更新诊断状态
  async updateDiagnosisStatus(this: unknown, record: DiagnosisRecord, newStatus: string) {
    try {
      await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'update_diagnosis_status',
          diagnosisId: record._id,
          status: newStatus,
          updateData: {
            updatedAt: new Date().toISOString()
          }
        }
      })

      // 更新本地数据
      const records = this.data.records.map((item: DiagnosisRecord) => 
        item._id === record._id ? { ...item, status: newStatus } : item
      )
      
      this.setData({ records })

      wx.showToast({
        title: '状态更新成功',
        icon: 'success'
      })
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  // 确认诊断
  onConfirmDiagnosis(this: unknown, e: unknown) {
    const { record } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认诊断',
      content: `确认将"${record.diagnosisResult}"设为最终诊断结果？`,
      success: (res) => {
        if (res.confirm) {
          this.updateDiagnosisStatus(record, 'confirmed')
        }
      }
    })
  },

  // 删除记录
  onDeleteRecord(this: unknown, e: unknown) {
    const { record } = e.currentTarget.dataset
    
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条诊断记录吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#e34d59',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecord(record)
        }
      }
    })
  },

  // 删除记录
  async deleteRecord(this: unknown, record: DiagnosisRecord) {
    try {
      await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'update_diagnosis_status',
          diagnosisId: record._id,
          status: 'deleted',
          updateData: {
            isDeleted: true,
            deletedAt: new Date().toISOString()
          }
        }
      })

      // 从本地数据中移除
      const records = this.data.records.filter((item: DiagnosisRecord) => item._id !== record._id)
      this.setData({ records })

      wx.showToast({
        title: '记录已删除',
        icon: 'success'
      })
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  // 格式化时间
  formatDateTime(dateString: string): string {
    // ✅ 修复：处理空值和无效值
    if (!dateString) {
      return '未知时间'
    }
    
    // ✅ 修复：处理各种日期格式
    let date: Date
    try {
      date = new Date(dateString)
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        logger.warn('Invalid date string:', dateString)
        return '时间格式错误'
      }
    } catch (e) {
      logger.error('Date parsing error:', e, dateString)
      return '时间解析失败'
    }
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // 小于1分钟
    if (diff < 60000 && diff >= 0) {
      return '刚刚'
    }
    
    // 小于1小时
    if (diff < 3600000 && diff >= 0) {
      return Math.floor(diff / 60000) + '分钟前'
    }
    
    // 小于1天
    if (diff < 86400000 && diff >= 0) {
      return Math.floor(diff / 3600000) + '小时前'
    }
    
    // 小于7天
    if (diff < 604800000 && diff >= 0) {
      return Math.floor(diff / 86400000) + '天前'
    }
    
    // 格式化为具体时间 (YYYY-MM-DD HH:mm)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 获取状态文本
  getStatusText(status: string): string {
    const statusMap = {
      'pending_confirmation': '待确认',
      'adopted': '已采纳',
      'confirmed': '已确诊',
      'rejected': '已拒绝'
    }
    return statusMap[status as keyof typeof statusMap] || '未知'
  },

  // 获取状态主题
  getStatusTheme(status: string): string {
    const themeMap = {
      'pending_confirmation': 'warning',
      'adopted': 'primary',
      'confirmed': 'success',
      'rejected': 'danger'
    }
    return themeMap[status as keyof typeof themeMap] || 'default'
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
