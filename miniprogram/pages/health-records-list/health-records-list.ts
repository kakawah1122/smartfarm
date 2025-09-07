// health-records-list.ts - 健康记录列表页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 记录列表
    healthRecords: [],
    
    // 筛选相关
    showFilter: false,
    selectedMonth: '',
    selectedMonthLabel: '',
    monthOptions: [],
    selectedResult: '',
    selectedResultLabel: '',
    resultOptions: [
      { value: '', label: '全部状态' },
      { value: 'ongoing', label: '治疗中' },
      { value: 'cured', label: '已治愈' },
      { value: 'death', label: '已死亡' }
    ],
    
    // 分页相关
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    
    // 统计信息
    totalCount: 0,
    filteredCount: 0,
    
    // 防抖机制
    loadTimer: null as any
  },

  onLoad() {
    this.initializeMonthOptions()
    this.loadHealthRecords()
  },

  onShow() {
    // 页面显示时更新记录数量
    this.updateFilteredCount()
  },

  onUnload() {
    // 清理定时器，防止内存泄漏
    if (this.data.loadTimer) {
      clearTimeout(this.data.loadTimer)
    }
  },

  // 初始化月份选项
  initializeMonthOptions() {
    const currentDate = new Date()
    const monthOptions = [{ value: '', label: '全部月份' }]
    
    // 生成最近12个月的选项
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`
      const label = `${year}年${month}月`
      
      monthOptions.push({ value: monthStr, label })
    }
    
    this.setData({
      monthOptions,
      selectedMonth: monthOptions[1].value, // 默认选择当前月份
      selectedMonthLabel: monthOptions[1].label
    })
  },

  // 加载健康记录
  async loadHealthRecords(reset = true) {
    if (this.data.loading) return
    
    this.setData({
      loading: true
    })

    try {
      const page = reset ? 1 : this.data.currentPage + 1
      
      // 构建筛选条件
      const filterData: any = {
        action: 'list_health_records',
        page: page,
        pageSize: this.data.pageSize
      }

      // 添加月份筛选
      if (this.data.selectedMonth) {
        const [year, month] = this.data.selectedMonth.split('-')
        const startDate = `${year}-${month}-01`
        const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1
        const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`
        
        filterData.dateRange = {
          start: startDate,
          end: endDate
        }
      }

      // 添加状态筛选
      if (this.data.selectedResult) {
        filterData.result = this.data.selectedResult
      }

      console.log('筛选条件:', filterData)

      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: filterData
      })

      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        const total = result.result.data.total || 0

        console.log('健康记录数据加载成功:', { records: records.length, total })

        const formattedRecords = records.map((record: any) => ({
          id: record._id,
          location: record.diagnosisDisease || '未确诊',
          symptoms: record.symptoms,
          treatment: record.treatment,
          severity: this.getSeverityTheme(record.severity, record.recordType),
          priorityText: this.getPriorityText(record.severity, record.recordType),
          date: record.displayDate || record.recordDate,
          time: record.createTime ? new Date(record.createTime).toLocaleTimeString() : '',
          operator: record.operator || '系统用户',
          status: this.getResultText(record.result, record.recordType),
          result: record.result,
          recordType: record.recordType,
          affectedCount: record.abnormalCount || record.affectedCount || record.cureCount || record.deathCount,
          rawRecord: record
        }))

        this.setData({
          healthRecords: reset ? formattedRecords : [...this.data.healthRecords, ...formattedRecords],
          currentPage: page,
          hasMore: records.length >= this.data.pageSize,
          totalCount: total,
          filteredCount: reset ? formattedRecords.length : this.data.filteredCount + formattedRecords.length
        })
      } else {
        console.log('健康记录加载失败，云函数返回错误')
        // 如果是首次加载失败，设置为当前记录数量
        if (reset) {
          this.setData({
            filteredCount: this.data.healthRecords.length
          })
        }
      }
    } catch (error) {
      console.error('加载健康记录失败:', error)
      
      // 如果是首次加载失败，设置为当前记录数量
      if (reset) {
        this.setData({
          filteredCount: this.data.healthRecords.length
        })
      }
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  // 显示/隐藏筛选器
  toggleFilter() {
    this.setData({
      showFilter: !this.data.showFilter
    })
  },

  // 关闭筛选器
  closeFilter() {
    this.setData({
      showFilter: false
    })
  },

  // 防止筛选面板关闭
  preventClose() {
    // 阻止事件冒泡，防止点击筛选面板内容时关闭面板
  },

  // 更新筛选记录数量
  updateFilteredCount() {
    const currentCount = this.data.healthRecords.length
    if (this.data.filteredCount === 0 && currentCount > 0) {
      this.setData({
        filteredCount: currentCount
      })
    }
  },

  // 带防抖的数据加载
  loadHealthRecordsDebounced(reset = true) {
    // 清除之前的定时器
    if (this.data.loadTimer) {
      clearTimeout(this.data.loadTimer)
    }
    
    // 设置新的定时器
    this.setData({
      loadTimer: setTimeout(() => {
        this.loadHealthRecords(reset)
      }, 300)
    })
  },

  // 月份筛选变化
  onMonthChange(e: any) {
    const { value } = e.detail
    const selectedOption = this.data.monthOptions[value]
    
    this.setData({
      selectedMonth: selectedOption?.value || '',
      selectedMonthLabel: selectedOption?.label || '全部月份'
    })
  },

  // 状态筛选变化
  onResultChange(e: any) {
    const { value } = e.detail
    const selectedOption = this.data.resultOptions[value]
    
    this.setData({
      selectedResult: selectedOption?.value || '',
      selectedResultLabel: selectedOption?.label || '全部状态'
    })
  },

  // 应用筛选
  applyFilter() {
    this.setData({
      showFilter: false
    })
    
    // 显示筛选提示
    wx.showToast({
      title: '正在筛选...',
      icon: 'loading',
      duration: 1000
    })
    
    this.loadHealthRecordsDebounced(true)
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      selectedMonth: this.data.monthOptions[1]?.value || '', // 重置为当前月份
      selectedMonthLabel: this.data.monthOptions[1]?.label || '全部月份',
      selectedResult: '',
      selectedResultLabel: '全部状态',
      showFilter: false
    })
    this.loadHealthRecordsDebounced(true)
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadHealthRecords(false)
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadHealthRecords(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 查看记录详情
  viewHealthRecord(e: any) {
    const { item } = e.currentTarget.dataset
    
    if (!item) {
      wx.showToast({
        title: '记录信息错误',
        icon: 'none'
      })
      return
    }

    // 存储到全局数据
    const app = getApp<any>()
    if (!app.globalData) {
      app.globalData = {}
    }
    app.globalData.currentHealthRecord = item.rawRecord || item

    wx.navigateTo({
      url: `/pages/health-record-detail/health-record-detail?recordId=${item.id}`
    })
  },

  // 获取严重程度主题
  getSeverityTheme(severity: string, recordType?: string): string {
    if (recordType === 'cure') return 'success'
    if (recordType === 'death') return 'danger'
    
    const themes = {
      'mild': 'success',
      'moderate': 'warning', 
      'severe': 'danger'
    }
    return themes[severity] || 'default'
  },

  // 获取优先级文本
  getPriorityText(severity: string, recordType?: string): string {
    if (recordType === 'cure') return '治愈'
    if (recordType === 'death') return '死亡'
    
    const texts = {
      'mild': '轻微',
      'moderate': '中等',
      'severe': '严重'
    }
    return texts[severity] || '未知'
  },

  // 获取结果文本
  getResultText(result: string, recordType?: string): string {
    if (recordType === 'cure') return '治愈记录'
    if (recordType === 'death') return '死亡记录'
    
    const texts = {
      'ongoing': '治疗中',
      'cured': '已治愈',
      'death': '已死亡'
    }
    return texts[result] || '未知状态'
  },

  // 添加健康记录
  addHealthRecord() {
    wx.navigateTo({
      url: '/pages/health-record-form/health-record-form'
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
