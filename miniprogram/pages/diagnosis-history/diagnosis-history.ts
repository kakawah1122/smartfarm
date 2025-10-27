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
    showDetailDialog: false
  },

  onLoad() {
    this.loadDiagnosisHistory()
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData()
  },

  onPullDownRefresh() {
    this.refreshData()
  },

  onReachBottom() {
    this.loadMoreData()
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
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
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'get_diagnosis_history',
          page: this.data.pagination.page,
          pageSize: this.data.pagination.pageSize,
          status: this.data.activeStatus === 'all' ? undefined : this.data.activeStatus
        }
      })

      if (result.result && result.result.success) {
        const { records, pagination } = result.result.data
        
        // 处理时间格式
        const processedRecords = records.map((record: any) => ({
          ...record,
          createTime: this.formatDateTime(record.createTime)
        }))

        const existingRecords = this.data.pagination.page === 1 ? [] : this.data.records
        
        this.setData({
          records: [...existingRecords, ...processedRecords],
          pagination: {
            ...pagination,
            hasMore: pagination.page < pagination.totalPages
          }
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
        records: []
      })
      this.loadDiagnosisHistory()
    }
  },

  // 查看诊断详情
  onViewRecord(e: any) {
    const { record } = e.currentTarget.dataset
    this.setData({
      selectedRecord: record,
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

  // 重新诊断
  onRedoDiagnosis(e: any) {
    const { record } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/pages/ai-diagnosis/ai-diagnosis?symptoms=${encodeURIComponent(record.symptoms)}&affectedCount=${record.affectedCount}&dayAge=${record.dayAge}&temperature=${record.temperature}`
    })
  },

  // 创建治疗方案
  onCreateTreatment(e: any) {
    const { record } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/pages/treatment-record/treatment-record?diagnosisId=${record._id}`
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

  // 分享记录（模拟功能）
  onShareRecord(e: any) {
    const { record } = e.currentTarget.dataset
    
    wx.showActionSheet({
      itemList: ['发送给兽医', '导出为PDF', '复制诊断结果'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.sendToVet(record)
            break
          case 1:
            this.exportToPDF(record)
            break
          case 2:
            this.copyDiagnosis(record)
            break
        }
      }
    })
  },

  // 发送给兽医（模拟）
  sendToVet(record: DiagnosisRecord) {
    wx.showToast({
      title: '已发送给兽医',
      icon: 'success'
    })
  },

  // 导出PDF（模拟）
  exportToPDF(record: DiagnosisRecord) {
    wx.showLoading({ title: '生成PDF中...' })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: 'PDF已生成',
        icon: 'success'
      })
    }, 2000)
  },

  // 复制诊断结果
  copyDiagnosis(record: DiagnosisRecord) {
    const content = `AI诊断结果：${record.diagnosisResult}\n置信度：${record.confidence}%\n建议用药：${record.recommendedMedications.join('、')}\n治疗周期：${record.treatmentDuration}`
    
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  },

  // 格式化时间
  formatDateTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // 小于1分钟
    if (diff < 60000) {
      return '刚刚'
    }
    
    // 小于1小时
    if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前'
    }
    
    // 小于1天
    if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前'
    }
    
    // 小于7天
    if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前'
    }
    
    // 格式化为具体时间
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '-')
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
