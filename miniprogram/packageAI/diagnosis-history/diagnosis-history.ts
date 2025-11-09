// diagnosis-history.ts - 诊断历史页面
import { createPageWithNavbar } from '../../utils/navigation'

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
  affectedCount: number
  dayAge: number
  temperature: number
}

// 页面配置对象
const pageConfig = {
  data: {
    // 诊断记录列表
    records: [] as DiagnosisRecord[],
    
    // 批次ID（从健康页面传递）
    batchId: undefined as string | undefined,
    
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

  onLoad(options: any) {
    // ✅ 接收从健康页面传递的 batchId 参数
    // 如果 batchId 是 'all' 或未传递，则查询所有批次的记录
    const batchId = options.batchId
    // 🔍 调试：输出接收到的参数
    console.log('[诊断历史] onLoad 接收参数:', { batchId, options })
    this.setData({ batchId: batchId || undefined })
    this.loadDiagnosisHistory()
  },

  onShow() {
    // ✅ 修复：只在页面已经完成首次加载的情况下刷新数据，避免覆盖首次加载
    if (this.data.hasLoaded) {
      this.refreshData()
    }
  },

  onPullDownRefresh() {
    this.refreshData()
  },

  onReachBottom() {
    this.loadMoreData()
  },

  // 返回首页
  goBack() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 刷新数据
  async refreshData() {
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
  async loadMoreData() {
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
  async loadDiagnosisHistory(showLoading = true) {
    if (showLoading) {
      this.setData({ loading: true })
    }

    try {
      // ✅ 与健康页面保持一致：当 batchId 是 'all' 时，使用 health-management 云函数
      // 这样能确保数据源一致
      const batchId = this.data.batchId && this.data.batchId !== 'all' 
        ? this.data.batchId 
        : undefined

      // 🔍 调试：输出查询参数
      console.log('[诊断历史] 查询参数:', {
        batchId: batchId || 'all (查询所有批次)',
        page: this.data.pagination.page,
        pageSize: this.data.pagination.pageSize,
        status: this.data.activeStatus === 'all' ? undefined : this.data.activeStatus
      })

      let result: any
      
      // ✅ 当 batchId 为 'all' 或 undefined 时，使用与健康页面相同的数据源
      if (!batchId) {
        // 使用 health-management 云函数的 get_dashboard_snapshot，与健康页面保持一致
        const snapshotResult = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'get_dashboard_snapshot',
            batchId: 'all',
            includeDiagnosis: true,
            diagnosisLimit: this.data.pagination.pageSize * this.data.pagination.page, // 获取足够的数据用于分页
            includeAbnormalRecords: false
          }
        })

        if (snapshotResult.result && snapshotResult.result.success) {
          const diagnosisRecords = snapshotResult.result.data?.latestDiagnosisRecords || []
          
          // 转换为分页格式
          const total = diagnosisRecords.length
          const startIndex = (this.data.pagination.page - 1) * this.data.pagination.pageSize
          const endIndex = startIndex + this.data.pagination.pageSize
          const paginatedRecords = diagnosisRecords.slice(startIndex, endIndex)
          
          result = {
            result: {
              success: true,
              data: {
                records: paginatedRecords,
                pagination: {
                  page: this.data.pagination.page,
                  pageSize: this.data.pagination.pageSize,
                  total: total,
                  totalPages: Math.ceil(total / this.data.pagination.pageSize)
                }
              }
            }
          }
        } else {
          throw new Error('获取诊断记录失败')
        }
      } else {
        // 单个批次时，使用 ai-diagnosis 云函数
        result = await wx.cloud.callFunction({
          name: 'ai-diagnosis',
          data: {
            action: 'get_diagnosis_history',
            batchId: batchId,
            page: this.data.pagination.page,
            pageSize: this.data.pagination.pageSize,
            status: this.data.activeStatus === 'all' ? undefined : this.data.activeStatus
          }
        })
      }

      // 🔍 调试：输出查询结果
      console.log('[诊断历史] 查询结果:', {
        success: result.result?.success,
        recordCount: result.result?.data?.records?.length || 0,
        total: result.result?.data?.pagination?.total || 0
      })

      if (result.result && result.result.success) {
        const { records, pagination } = result.result.data
        
        // ✅ 与健康页面保持一致：处理时间格式并过滤图片数组中的 null 值
        // ✅ 同时确保 diagnosis 字段存在（健康页面使用 diagnosis，诊断历史页面使用 diagnosisResult）
        const processedRecords = records.map((record: any) => ({
          ...record,
          // ✅ 确保 diagnosis 字段存在（健康页面使用此字段）
          diagnosis: record.diagnosis || record.diagnosisResult || '未知疾病',
          // ✅ 确保 diagnosisResult 字段存在（诊断历史页面使用此字段）
          diagnosisResult: record.diagnosisResult || record.diagnosis || '未知疾病',
          // ✅ 格式化诊断日期（健康页面使用 diagnosisDate）
          diagnosisDate: record.diagnosisDate || (record.createTime ? record.createTime.substring(0, 16).replace('T', ' ') : ''),
          createTime: this.formatDateTime(record.createTime),
          // ✅ 过滤掉图片数组中的 null 值（与健康页面保持一致）
          images: (record.images || []).filter((img: any) => img && typeof img === 'string')
        }))

        const existingRecords = this.data.pagination.page === 1 ? [] : this.data.records
        
        this.setData({
          records: [...existingRecords, ...processedRecords],
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
    } catch (error: any) {
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
  onStatusChange(e: any) {
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
  async onViewRecord(e: any) {
    const { record } = e.currentTarget.dataset
    
    // ✅ 处理图片URL - 转换为临时URL
    let processedImages = record.images || []
    
    // 首先过滤掉无效值
    processedImages = processedImages.filter((url: any) => url && typeof url === 'string')
    
    if (processedImages.length > 0) {
      try {
        const tempUrlResult = await wx.cloud.getTempFileURL({
          fileList: processedImages
        })
        
        if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
          processedImages = tempUrlResult.fileList
            .map((item: any) => item.tempFileURL || item.fileID)
            .filter((url: any) => url && typeof url === 'string')
        }
      } catch (urlError) {
        console.warn('图片URL转换失败，使用原始URL:', urlError)
        // 继续使用已过滤的原始图片URL
      }
    }
    
    this.setData({
      selectedRecord: {
        ...record,
        images: processedImages
      },
      showDetailDialog: true
    })
  },

  // 关闭详情对话框
  onCloseDetail() {
    this.setData({
      showDetailDialog: false,
      selectedRecord: null
    })
  },

  // 预览图片
  onPreviewImage(e: any) {
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
  onCreateTreatmentFromDetail() {
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
  onCreateTreatment(e: any) {
    const { record } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?diagnosisId=${record._id}`
    })
  },

  // 更新诊断状态
  async updateDiagnosisStatus(record: DiagnosisRecord, newStatus: string) {
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
      const records = this.data.records.map(item => 
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
  onConfirmDiagnosis(e: any) {
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
  onDeleteRecord(e: any) {
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
  async deleteRecord(record: DiagnosisRecord) {
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
      const records = this.data.records.filter(item => item._id !== record._id)
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
        console.warn('Invalid date string:', dateString)
        return '时间格式错误'
      }
    } catch (e) {
      console.error('Date parsing error:', e, dateString)
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
