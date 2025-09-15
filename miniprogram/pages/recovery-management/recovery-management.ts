// recovery-management.ts - 康复管理页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 康复中的治疗记录
    recoveryRecords: [] as any[],
    
    // 康复统计
    recoveryStats: {
      totalRecords: 0,
      recovering: 0,
      recovered: 0,
      relapsed: 0,
      averageDays: 0
    },
    
    // 搜索和筛选
    searchText: '',
    filterStatus: 'all', // all|recovering|recovered|relapsed
    
    // 页面状态
    loading: false,
    refreshing: false,
    
    // 选中的记录
    selectedRecord: null as any,
    showDetailModal: false,
    
    // 康复进度选项
    progressOptions: [
      { label: '病情稳定', value: 'stable' },
      { label: '好转中', value: 'improving' },
      { label: '明显好转', value: 'much_better' },
      { label: '基本康复', value: 'nearly_recovered' },
      { label: '完全康复', value: 'fully_recovered' }
    ]
  },

  onLoad() {
    this.loadRecoveryData()
  },

  onShow() {
    this.refreshData()
  },

  onPullDownRefresh() {
    this.refreshData()
  },

  // 加载康复数据
  async loadRecoveryData() {
    this.setData({ loading: true })
    
    try {
      // 获取所有治疗记录
      const treatmentResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'list_treatment_records',
          pageSize: 50,
          status: 'ongoing'
        }
      })
      
      if (treatmentResult.result && treatmentResult.result.success) {
        const treatments = treatmentResult.result.data.records || []
        
        // 转换为康复记录格式
        const recoveryRecords = treatments.map((treatment: any) => ({
          id: treatment._id,
          animalId: treatment.batchId,
          disease: treatment.diagnosis?.confirmed || '治疗中',
          startDate: treatment.treatmentDate,
          currentDay: this.calculateDays(treatment.treatmentDate),
          status: this.determineStatus(treatment),
          progress: treatment.progress || [],
          lastUpdate: treatment.updateTime,
          veterinarian: treatment.veterinarianName,
          nextCheckDate: this.calculateNextCheck(treatment.treatmentDate),
          medications: treatment.medications || [],
          notes: treatment.notes || ''
        }))
        
        // 计算统计数据
        const stats = this.calculateStats(recoveryRecords)
        
        this.setData({
          recoveryRecords,
          recoveryStats: stats
        })
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 刷新数据
  async refreshData() {
    this.setData({ refreshing: true })
    await this.loadRecoveryData()
    this.setData({ refreshing: false })
    wx.stopPullDownRefresh()
  },

  // 计算天数
  calculateDays(startDate: string): number {
    const start = new Date(startDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  },

  // 确定康复状态
  determineStatus(treatment: any): string {
    const progress = treatment.progress || []
    const outcome = treatment.outcome || {}
    
    if (outcome.status === 'recovered') return 'recovered'
    if (outcome.status === 'relapsed') return 'relapsed'
    
    // 根据最新进展判断
    const latestProgress = progress[progress.length - 1]
    if (latestProgress) {
      if (latestProgress.improvement === 'much_better') return 'nearly_recovered'
      if (latestProgress.improvement === 'improving') return 'improving'
    }
    
    return 'recovering'
  },

  // 计算下次检查日期
  calculateNextCheck(startDate: string): string {
    const start = new Date(startDate)
    const nextCheck = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000) // 3天后
    return nextCheck.toISOString().split('T')[0]
  },

  // 计算统计数据
  calculateStats(records: any[]) {
    const total = records.length
    const recovering = records.filter(r => r.status === 'recovering' || r.status === 'improving').length
    const recovered = records.filter(r => r.status === 'recovered').length
    const relapsed = records.filter(r => r.status === 'relapsed').length
    
    const totalDays = records.reduce((sum, r) => sum + r.currentDay, 0)
    const averageDays = total > 0 ? Math.round(totalDays / total) : 0
    
    return {
      totalRecords: total,
      recovering,
      recovered,
      relapsed,
      averageDays
    }
  },

  // 搜索处理
  onSearchInput(e: any) {
    this.setData({
      searchText: e.detail.value
    })
    this.filterRecords()
  },

  // 状态筛选
  onFilterChange(e: any) {
    this.setData({
      filterStatus: e.detail.value
    })
    this.filterRecords()
  },

  // 筛选记录
  filterRecords() {
    // 这里可以实现本地筛选逻辑
    // 为简化起见，暂时重新加载数据
    this.loadRecoveryData()
  },

  // 查看康复详情
  viewRecoveryDetail(e: any) {
    const { recordId } = e.currentTarget.dataset
    const record = this.data.recoveryRecords.find(r => r.id === recordId)
    
    if (record) {
      this.setData({
        selectedRecord: record,
        showDetailModal: true
      })
    }
  },

  // 更新康复进度
  updateProgress(e: any) {
    const { recordId } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/pages/recovery-progress/recovery-progress?recordId=${recordId}`
    })
  },

  // 记录康复检查
  recordCheck(e: any) {
    const { recordId } = e.currentTarget.dataset
    
    wx.showModal({
      title: '康复检查',
      content: '请选择康复状态',
      showCancel: true,
      success: (res) => {
        if (res.confirm) {
          this.showProgressDialog(recordId)
        }
      }
    })
  },

  // 显示进度更新对话框
  showProgressDialog(recordId: string) {
    const itemList = this.data.progressOptions.map(option => option.label)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedOption = this.data.progressOptions[res.tapIndex]
        this.submitProgressUpdate(recordId, selectedOption.value)
      }
    })
  },

  // 提交进度更新
  async submitProgressUpdate(recordId: string, progress: string) {
    try {
      const progressRecord = {
        date: new Date().toISOString().split('T')[0],
        progress,
        operator: '当前用户',
        notes: `康复状态更新为: ${this.data.progressOptions.find(p => p.value === progress)?.label}`
      }
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_treatment_record',
          recordId,
          progress: progressRecord
        }
      })
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '进度更新成功',
          icon: 'success'
        })
        
        // 刷新数据
        this.refreshData()
      } else {
        throw new Error(result.result?.message || '更新失败')
      }
    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none'
      })
    }
  },

  // 标记为康复
  markAsRecovered(e: any) {
    const { recordId } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认康复',
      content: '确认该病例已完全康复？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'health-management',
              data: {
                action: 'update_treatment_record',
                recordId,
                outcome: {
                  status: 'recovered',
                  recoveredDate: new Date().toISOString().split('T')[0],
                  totalDays: this.calculateDays(this.data.selectedRecord?.startDate || ''),
                  finalNotes: '康复完成'
                }
              }
            })
            
            if (result.result && result.result.success) {
              wx.showToast({
                title: '已标记为康复',
                icon: 'success'
              })
              
              this.setData({ showDetailModal: false })
              this.refreshData()
            }
          } catch (error: any) {
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 关闭详情弹窗
  closeDetailModal() {
    this.setData({
      showDetailModal: false,
      selectedRecord: null
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
}

Page(createPageWithNavbar(pageConfig))
