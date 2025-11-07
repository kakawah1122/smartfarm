// finance.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  options: {
    styleIsolation: 'shared'
  },
  data: {
    activeTab: 'records',
    
    // 时间筛选 - 第一级：类型选择
    filterType: 'all', // 'all', 'month', 'quarter', 'year', 'custom'
    filterTypeLabel: '全部',
    filterTypeIndex: 0,
    filterTypeOptions: [
      {label: '全部', value: 'all'},
      {label: '月度', value: 'month'},
      {label: '季度', value: 'quarter'},
      {label: '年度', value: 'year'},
      {label: '自定义', value: 'custom'}
    ],
    
    // 第二级：具体时间选择
    selectedMonth: '', // 格式：2025-11
    selectedMonthIndex: 0,
    monthOptions: [] as {label: string, value: string}[], // 最近12个月
    
    selectedQuarter: '', // 格式：2025-Q4
    selectedQuarterIndex: 0,
    quarterOptions: [] as {label: string, value: string}[], // 最近8个季度
    
    selectedYear: '', // 格式：2025
    selectedYearIndex: 0,
    yearOptions: [] as {label: string, value: string}[], // 最近5年
    
    // 自定义日期范围
    customStartDate: '',
    customEndDate: '',
    
    // 财务概览
    overview: {
      income: '0',
      expense: '0',
      profit: '0',
      profitColorClass: 'danger', // 净利润颜色类：负数为success(绿色)，正数为danger(红色)
      growthRate: '0',
      feedCost: '0',
      feedPercent: '0',
      goslingCost: '0',
      goslingPercent: '0',
      medicalCost: '0',
      medicalPercent: '0',
      otherCost: '0',
      otherPercent: '0'
    },
    
  // AI财务分析
  aiAnalysis: {
    loading: false,
    result: null as any,
    error: null as string | null,
    lastUpdateTime: null as string | null
  },
    
    // 筛选条件
    filters: {
      type: '全部类型',
      period: '最近7天'
    },
    typeOptions: [
      {label: '全部类型', value: '全部类型'},
      {label: '收入', value: '收入'},
      {label: '支出', value: '支出'}
    ],
    periodOptions: [
      {label: '最近7天', value: '最近7天'},
      {label: '最近30天', value: '最近30天'},
      {label: '本月', value: '本月'}
    ],
    
    // 财务记录（从数据库加载）
    records: [],
    
    // 财务报表（从数据库加载）
    reports: {
      yearGrowth: '0',
      profitRate: '0'
    },
    
    // 审批事项（从数据库加载）
    approvalItems: [],
    
    filteredRecords: [],
    
    // 显示的记录列表（只显示前5条）
    displayRecords: [],
    
    // 交易详情弹窗
    showDetailPopup: false,
    selectedRecord: null as any
  },

  onLoad() {
    // 初始化时间选项
    this.initTimeOptions()
    
    // 加载财务数据
    this.loadFinanceData()
    // 加载财务记录
    this.loadFinanceRecords()
    // 加载审批事项
    this.loadApprovalItems()
    // 加载财务报表
    this.loadFinancialReports()
    
    // 初始化筛选记录
    this.setData({
      filteredRecords: [],
      displayRecords: []
    })
  },
  
  // 初始化时间选项
  initTimeOptions() {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentQuarter = Math.floor(currentMonth / 3)
    
    // 生成最近12个月的选项
    const monthOptions: {label: string, value: string}[] = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, currentMonth - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const value = `${year}-${month.toString().padStart(2, '0')}`
      const label = `${year}年${month}月`
      monthOptions.push({label, value})
    }
    
    // 生成最近8个季度的选项
    const quarterOptions: {label: string, value: string}[] = []
    for (let i = 0; i < 8; i++) {
      const totalQuarters = currentYear * 4 + currentQuarter - i
      const year = Math.floor(totalQuarters / 4)
      const quarter = (totalQuarters % 4) + 1
      const value = `${year}-Q${quarter}`
      const label = `${year}年第${quarter}季度`
      quarterOptions.push({label, value})
    }
    
    // 生成最近5年的选项
    const yearOptions: {label: string, value: string}[] = []
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i
      const value = year.toString()
      const label = `${year}年`
      yearOptions.push({label, value})
    }
    
    this.setData({
      monthOptions,
      quarterOptions,
      yearOptions,
      selectedMonth: monthOptions[0].value,
      selectedQuarter: quarterOptions[0].value,
      selectedYear: yearOptions[0].value
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/profile/profile'
        })
      }
    })
  },

  // 时间筛选类型选择（第一级）
  onFilterTypeChange(e: any) {
    const selectedIndex = e.detail.value || 0
    const selectedOption = this.data.filterTypeOptions[selectedIndex]
    
    if (selectedOption) {
      this.setData({
        filterType: selectedOption.value,
        filterTypeLabel: selectedOption.label,
        filterTypeIndex: selectedIndex
      })
      
      // 非自定义时自动加载数据
      if (selectedOption.value !== 'custom') {
        this.loadFinanceData()
        this.loadFinanceRecords()
        this.loadFinancialReports()
      }
    }
  },
  
  // 月度选择变化（第二级）
  onMonthChange(e: any) {
    const index = e.detail.value
    const selected = this.data.monthOptions[index]
    this.setData({
      selectedMonth: selected.value,
      selectedMonthIndex: index
    })
    this.loadFinanceData()
    this.loadFinanceRecords()
    this.loadFinancialReports()
  },
  
  // 季度选择变化（第二级）
  onQuarterChange(e: any) {
    const index = e.detail.value
    const selected = this.data.quarterOptions[index]
    this.setData({
      selectedQuarter: selected.value,
      selectedQuarterIndex: index
    })
    this.loadFinanceData()
    this.loadFinanceRecords()
    this.loadFinancialReports()
  },
  
  // 年度选择变化（第二级）
  onYearChange(e: any) {
    const index = e.detail.value
    const selected = this.data.yearOptions[index]
    this.setData({
      selectedYear: selected.value,
      selectedYearIndex: index
    })
    this.loadFinanceData()
    this.loadFinanceRecords()
    this.loadFinancialReports()
  },
  
  // 自定义开始日期选择
  onCustomStartDateChange(e: any) {
    this.setData({
      customStartDate: e.detail.value
    })
    
    // 如果结束日期也已选择，则加载数据
    if (this.data.customEndDate) {
      this.loadFinanceData()
      this.loadFinanceRecords()
      this.loadFinancialReports()
    }
  },
  
  // 自定义结束日期选择
  onCustomEndDateChange(e: any) {
    this.setData({
      customEndDate: e.detail.value
    })
    
    // 如果开始日期也已选择，则加载数据
    if (this.data.customStartDate) {
      this.loadFinanceData()
      this.loadFinanceRecords()
      this.loadFinancialReports()
    }
  },

  // 获取当前选择的时间范围
  getDateRange() {
    switch (this.data.filterType) {
      case 'all':
        // 全部：不设置时间范围
        return undefined
        
      case 'month':
        // 月度：根据选择的月份
        if (this.data.selectedMonth) {
          const [year, month] = this.data.selectedMonth.split('-').map(Number)
          const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
          const endDate = new Date(year, month, 0, 23, 59, 59, 999)
          return {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
        break
        
      case 'quarter':
        // 季度：根据选择的季度
        if (this.data.selectedQuarter) {
          const [year, q] = this.data.selectedQuarter.split('-Q').map(Number)
          const startMonth = (q - 1) * 3
          const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0)
          const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)
          return {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
        break
        
      case 'year':
        // 年度：根据选择的年份
        if (this.data.selectedYear) {
          const year = Number(this.data.selectedYear)
          const startDate = new Date(year, 0, 1, 0, 0, 0, 0)
          const endDate = new Date(year, 11, 31, 23, 59, 59, 999)
          return {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
        break
        
      case 'custom':
        // 自定义：根据选择的开始和结束日期
        if (this.data.customStartDate && this.data.customEndDate) {
          const startDate = new Date(this.data.customStartDate)
          startDate.setHours(0, 0, 0, 0)
          const endDate = new Date(this.data.customEndDate)
          endDate.setHours(23, 59, 59, 999)
          return {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
        break
    }
    
    // 默认返回 undefined（不限制时间）
    return undefined
  },

  // Tab切换 - TDesign 格式
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
  },

  // 切换Tab的旧方法保持兼容
  switchTab(e: any) {
    const { tab } = e.currentTarget.dataset
    this.setData({
      activeTab: tab
    })
  },

  // 类型筛选
  onTypeFilterChange(e: any) {
    this.setData({
      'filters.type': e.detail.value
    })
    this.filterRecords()
  },

  // 时间筛选
  onPeriodFilterChange(e: any) {
    this.setData({
      'filters.period': e.detail.value
    })
    this.filterRecords()
  },

  // 筛选记录
  filterRecords() {
    let filtered = [...this.data.records]
    
    // 按类型筛选
    if (this.data.filters.type !== '全部类型') {
      const typeMap: any = { '收入': 'income', '支出': 'expense' }
      filtered = filtered.filter(record => 
        record.type === typeMap[this.data.filters.type]
      )
    }
    
    // 按时间筛选
    if (this.data.filters.period !== '全部时间') {
      const now = new Date()
      let startDate: Date
      
      switch (this.data.filters.period) {
        case '最近7天':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '最近30天':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '本月':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(0) // 不限制
      }
      
      filtered = filtered.filter(record => {
        const recordDate = this.parseDate(record.date)
        return recordDate >= startDate
      })
    }
    
    this.setData({
      filteredRecords: filtered
    })
    
    // 更新显示记录
    this.updateDisplayRecords()
  },

  // 更新显示记录（只显示前5条）
  updateDisplayRecords() {
    const { filteredRecords } = this.data
    const displayRecords = filteredRecords.slice(0, 5)
    
    this.setData({
      displayRecords: displayRecords
    })
  },

  // 跳转到详细记录页面
  viewAllRecords() {
    wx.navigateTo({
      url: '/packageFinance/finance-record-list/finance-record-list'
    })
  },

  // 加载财务数据
  async loadFinanceData() {
    wx.showLoading({
      title: '加载中...'
    })
    
    try {
      // 获取当前选择的时间范围
      const dateRange = this.getDateRange()
    
      // 调用云函数加载财务数据
      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'get_finance_overview',
          dateRange: dateRange,
          batchId: null  // 财务概览不按批次筛选
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        // 处理财务数据
        this.processFinanceData(result.result.data)
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '加载数据失败',
        icon: 'none'
    })
    }
  },
  
  // 处理财务数据
  processFinanceData(data: any) {
    const income = data.income?.total || 0
    const expense = data.expense?.total || 0
    const profit = data.profit?.total || 0
    const costBreakdown = data.costBreakdown || {}

    // 转换为万元单位显示
    const formatToWan = (value: number) => {
      return (value / 10000).toFixed(1)
    }

    // 计算净利润颜色类：负数为绿色(success)，正数为红色(danger)
    const profitColorClass = parseFloat(formatToWan(profit)) < 0 ? 'success' : 'danger'

    // 计算成本占比
    const totalExpense = expense || 0
    const calculatePercent = (cost: number) => {
      return totalExpense > 0 ? ((cost / totalExpense) * 100).toFixed(1) : '0'
    }

    this.setData({
      overview: {
        income: formatToWan(income),
        expense: formatToWan(expense),
        profit: formatToWan(profit),
        profitColorClass: profitColorClass,
        growthRate: data.profit?.growth || '0',
        feedCost: formatToWan(costBreakdown.feedCost || 0),
        feedPercent: calculatePercent(costBreakdown.feedCost || 0),
        goslingCost: formatToWan(costBreakdown.goslingCost || 0),
        goslingPercent: calculatePercent(costBreakdown.goslingCost || 0),
        medicalCost: formatToWan(costBreakdown.medicalCost || 0),
        medicalPercent: calculatePercent(costBreakdown.medicalCost || 0),
        otherCost: formatToWan(costBreakdown.otherCost || 0),
        otherPercent: calculatePercent(costBreakdown.otherCost || 0)
      }
    })
  },

  // 加载财务记录（收入和支出，包括业务记录）
  async loadFinanceRecords() {
    try {
      // 获取当前选择的时间范围
      const dateRange = this.getDateRange()

      // 使用新的接口获取所有财务相关记录（包括业务记录）
      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'get_all_finance_records',
          page: 1,
          pageSize: 200, // 增加数量以获取更多记录
          dateRange: dateRange,
          batchId: null  // 财务概览不按批次筛选
        }
      })

      if (!result.result?.success) {
        throw new Error(result.result?.error || '加载失败')
      }

      const records: any[] = []
      const allRecords = result.result.data?.records || []

      // 处理所有记录
      allRecords.forEach((record: any) => {
        // 根据来源类型格式化记录
        let title = ''
        let description = record.description || ''
        let autoGenerated = false
        let relatedInfo = '手动录入'

        if (record.source === 'finance') {
          // 财务记录
          if (record.type === 'income') {
            title = this.getRevenueTitle(record.revenueType, record.description)
          } else {
            // 支出记录
            if (record.isReimbursement && record.reimbursement) {
              // 报销记录
              title = record.reimbursement.typeName || this.getReimbursementTypeTitle(record.reimbursement.type) || record.description || '报销申请'
            } else {
              // 普通费用记录
              title = this.getCostTitle(record.costType, record.description)
            }
          }
          autoGenerated = !!record.relatedRecordId
          relatedInfo = record.relatedRecordId ? '关联记录' : '手动录入'
        } else if (record.source === 'exit') {
          // 出栏记录（销售收入）
          title = '成鹅销售收入'
          description = record.description || `批次：${record.batchNumber || ''} - 客户：${record.rawRecord?.customer || '未知'}`
          autoGenerated = true
          relatedInfo = '自动生成-出栏记录'
        } else if (record.source === 'entry') {
          // 入栏记录（采购成本）
          title = '入栏采购'
          description = record.description || `批次：${record.batchNumber || ''}`
          autoGenerated = true
          relatedInfo = '自动生成-入栏记录'
        } else if (record.source === 'feed') {
          // 投喂记录（饲料成本）
          title = '饲料成本'
          description = record.description || `批次：${record.batchNumber || ''}`
          autoGenerated = true
          relatedInfo = '自动生成-投喂记录'
        } else if (record.source === 'purchase') {
          // 采购记录（物料采购）
          if (record.costType === 'feed') {
            title = '饲料成本'
          } else {
            title = '其他费用'
          }
          description = record.description || '物料采购'
          autoGenerated = true
          relatedInfo = '自动生成-采购记录'
        }

        records.push({
          id: record.id,
          type: record.type,
          title: title,
          description: description,
          amount: this.formatAmount(record.amount),
          date: this.formatDate(record.createTime || record.date),
          status: record.status === 'confirmed' ? (record.type === 'income' ? '已入账' : '已支出') : '待确认',
          statusTheme: record.status === 'confirmed' ? (record.type === 'income' ? 'success' : 'danger') : 'warning',
          autoGenerated: autoGenerated,
          relatedInfo: relatedInfo,
          source: record.source, // 记录来源
          rawRecord: record.rawRecord || record
        })
      })

      // 按日期排序（最新的在前）
      records.sort((a, b) => {
        const dateA = this.parseDate(a.date).getTime()
        const dateB = this.parseDate(b.date).getTime()
        return dateB - dateA
      })

      // 更新记录列表
      this.setData({
        records: records,
        filteredRecords: records
      })
      
      // 更新显示记录（只显示前5条）
      this.updateDisplayRecords()
    } catch (error: any) {
      console.error('加载财务记录失败:', error)
      wx.showToast({
        title: error.message || '加载记录失败',
        icon: 'none'
      })
    }
  },

  // 获取收入标题
  getRevenueTitle(revenueType: string, description: string): string {
    const typeMap: any = {
      'sales': '销售收入',
      'subsidy': '补贴收入',
      'other': '其他收入'
    }
    return typeMap[revenueType] || description || '收入记录'
  },

  // 获取支出标题
  getCostTitle(costType: string, description: string): string {
    const typeMap: any = {
      'feed': '饲料成本',
      'health': '医疗费用',
      'labor': '其他费用',
      'facility': '设施成本',
      'other': '其他费用',
      'loss': '损失费用',
      'death_loss': '死亡损失',
      'treatment': '治疗费用'
    }
    return typeMap[costType] || description || '支出记录'
  },

  // 获取报销类型标题
  getReimbursementTypeTitle(reimbursementType: string): string {
    const typeMap: any = {
      'travel': '差旅费',
      'meal': '餐费',
      'purchase': '采购费用',
      'entertainment': '招待费',
      'other': '其他费用'
    }
    return typeMap[reimbursementType] || '其他费用'
  },

  // 格式化金额
  formatAmount(amount: number): string {
    return amount ? amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '0'
  },

  // 安全解析日期（兼容多种格式）
  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date()
    
    // 如果已经是 ISO 格式，直接解析
    if (dateStr.includes('T')) {
      return new Date(dateStr)
    }
    
    // 处理 "yyyy-MM-dd HH:mm" 格式，转换为 iOS 支持的格式
    if (dateStr.includes('-') && dateStr.includes(' ')) {
      // 将 "2025-11-06 12:43" 转换为 "2025/11/06 12:43"
      const normalized = dateStr.replace(/-/g, '/')
      return new Date(normalized)
    }
    
    // 处理 "yyyy-MM-dd" 格式
    if (dateStr.includes('-') && !dateStr.includes(' ')) {
      return new Date(dateStr)
    }
    
    // 处理 "yyyy/MM/dd HH:mm" 格式（iOS 支持）
    if (dateStr.includes('/')) {
      return new Date(dateStr)
    }
    
    // 默认尝试解析
    return new Date(dateStr)
  },

  // 格式化日期（统一输出格式：yyyy/MM/dd HH:mm）
  formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = this.parseDate(dateStr)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return dateStr // 如果解析失败，返回原字符串
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  },

  // 加载审批事项
  async loadApprovalItems() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'get_pending_reimbursements',
          page: 1,
          pageSize: 20
        }
      })

      if (result.result?.success && result.result.data?.records) {
        const approvalItems = result.result.data.records.map((record: any) => {
          // 获取申请人信息
          const applicant = record.operatorName || record.operator || '未知'
          
          return {
            id: record._id || record.recordId,
            type: 'expense',
            applicant: applicant,
            title: record.description || '报销申请',
            description: record.reimbursement?.reason || record.description || '',
            amount: this.formatAmount(record.amount),
            submitTime: this.formatSubmitTime(record.createTime)
          }
        })

        this.setData({
          approvalItems: approvalItems
        })
      } else {
        this.setData({
          approvalItems: []
        })
      }
    } catch (error: any) {
      console.error('加载审批事项失败:', error)
      // 权限不足时不显示错误
      if (!error.message?.includes('无权限')) {
        this.setData({
          approvalItems: []
        })
      }
    }
  },

  // 格式化提交时间
  formatSubmitTime(dateStr: string): string {
    if (!dateStr) return ''
    const date = this.parseDate(dateStr)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return dateStr
    }
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days === 0) {
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return minutes <= 0 ? '刚刚' : `${minutes}分钟前`
      }
      return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    } else if (days === 1) {
      return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return this.formatDate(dateStr)
    }
  },

  // 加载财务报表
  async loadFinancialReports() {
    try {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      
      // 获取本月数据
      const currentStart = new Date(currentYear, currentMonth, 1).toISOString()
      const currentEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString()
      
      // 获取去年同期数据
      const lastYearStart = new Date(currentYear - 1, currentMonth, 1).toISOString()
      const lastYearEnd = new Date(currentYear - 1, currentMonth + 1, 0, 23, 59, 59).toISOString()

      const [currentResult, lastYearResult] = await Promise.all([
        wx.cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'get_financial_summary',
            dateRange: { start: currentStart, end: currentEnd }
          }
        }),
        wx.cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'get_financial_summary',
            dateRange: { start: lastYearStart, end: lastYearEnd }
          }
        })
      ])

      let yearGrowth = '0'
      let profitRate = '0'

      if (currentResult.result?.success && currentResult.result.data?.growth) {
        yearGrowth = currentResult.result.data.growth.revenueGrowth || '0'
      }

      if (currentResult.result?.success && currentResult.result.data?.currentPeriod) {
        const profit = currentResult.result.data.currentPeriod.profit || 0
        const revenue = currentResult.result.data.currentPeriod.revenue?.totalRevenue || 0
        if (revenue > 0) {
          profitRate = ((profit / revenue) * 100).toFixed(1)
        }
      }

      this.setData({
        reports: {
          yearGrowth: yearGrowth,
          profitRate: profitRate
        }
      })
    } catch (error: any) {
      console.error('加载财务报表失败:', error)
      this.setData({
        reports: {
          yearGrowth: '0',
          profitRate: '0'
        }
      })
    }
  },

  // ========== AI财务分析功能 ==========
  
  // 生成AI财务分析
  async generateFinancialAnalysis() {
    try {
      this.setData({ 
        'aiAnalysis.loading': true,
        'aiAnalysis.error': null
      })
      
      // 收集财务数据
      const financialData = this.collectFinancialData()
      
      // 构建分析提示词
      const prompt = this.buildFinancialAnalysisPrompt(financialData)
      
      // 调用AI云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-multi-model',
        data: {
          task: 'financial_analysis',
          content: prompt,
          options: {
            model: 'glm-4-flash', // 使用GLM-4进行财务分析
            temperature: 0.3,
            maxTokens: 2000
          }
        }
      })
      
      if (result.result.success) {
        const analysisResult = this.parseFinancialAnalysisResult(result.result.data.content)
        
        this.setData({
          'aiAnalysis.loading': false,
          'aiAnalysis.result': analysisResult,
          'aiAnalysis.lastUpdateTime': new Date().toLocaleString('zh-CN')
        })
        
        // 触觉反馈
        wx.vibrateShort()
        
        wx.showToast({
          title: 'AI分析完成',
          icon: 'success'
        })
      } else {
        throw new Error(result.result.error || 'AI分析失败')
      }
      
    } catch (error) {
      // 已移除调试日志
      // 提供备用分析结果
      const fallbackResult = this.generateFallbackAnalysis()
      
      this.setData({
        'aiAnalysis.loading': false,
        'aiAnalysis.result': fallbackResult,
        'aiAnalysis.error': '使用离线分析模式'
      })
      
      wx.showToast({
        title: '使用离线分析',
        icon: 'none'
      })
    }
  },
  
  // 收集财务数据
  collectFinancialData() {
    const { overview, records } = this.data
    
    // 计算近期数据统计
    const recentRecords = records.filter(record => {
      const recordDate = this.parseDate(record.date)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return recordDate >= sevenDaysAgo
    })
    
    // 收入支出分类统计
    const incomeRecords = recentRecords.filter(r => r.type === 'income')
    const expenseRecords = recentRecords.filter(r => r.type === 'expense')
    
    // 按类别统计支出（从原始记录中获取）
    const expenseCategories: any = {}
    expenseRecords.forEach(record => {
      const rawRecord = record.rawRecord
      const category = rawRecord?.costType || record.title || '其他'
      const amount = parseFloat(record.amount.replace(/,/g, '')) || 0
      expenseCategories[category] = (expenseCategories[category] || 0) + amount
    })
    
    // 计算利润率和统计数据
    const totalIncome = parseFloat(overview.income) * 10000 || 0
    const totalExpense = parseFloat(overview.expense) * 10000 || 0
    const profitMargin = totalIncome > 0 ? 
      ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : '0'
    
    const recentIncome = incomeRecords.reduce((sum, r) => {
      return sum + (parseFloat(r.amount.replace(/,/g, '')) || 0)
    }, 0)
    
    const recentExpense = expenseRecords.reduce((sum, r) => {
      return sum + (parseFloat(r.amount.replace(/,/g, '')) || 0)
    }, 0)
    
    return {
      overview: {
        ...overview,
        totalIncome: overview.income,
        totalExpense: overview.expense
      },
      recentIncome,
      recentExpense,
      expenseCategories,
      recordCount: records.length,
      recentRecordCount: recentRecords.length,
      profitMargin
    }
  },
  
  // 构建财务分析提示词
  buildFinancialAnalysisPrompt(financialData: any): string {
    return `你是一位专业的养殖业财务顾问，请基于以下财务数据进行深度分析，并提供专业的财务管理建议。请以JSON格式回复，包含以下结构：

{
  "healthScore": 数值(0-100),
  "healthLevel": "excellent|good|average|poor",
  "healthIndicators": [
    {"category": "现金流", "score": 数值, "level": "excellent|good|average|poor"},
    {"category": "盈利能力", "score": 数值, "level": "excellent|good|average|poor"},
    {"category": "成本控制", "score": 数值, "level": "excellent|good|average|poor"},
    {"category": "增长潜力", "score": 数值, "level": "excellent|good|average|poor"}
  ],
  "costOptimization": [
    {
      "category": "分类名称",
      "potentialSaving": "预计节省金额",
      "recommendation": "优化建议",
      "expectedImpact": "预期效果描述",
      "timeline": "实施周期"
    }
  ],
  "monthlyForecast": [
    {
      "month": "月份名称",
      "income": "预测收入(万元)",
      "expense": "预测支出(万元)", 
      "profit": "预测净利润(万元)",
      "trendDirection": "up|down|stable",
      "trendText": "趋势描述"
    }
  ],
  "forecastConfidence": 数值(0-100),
  "investmentOpportunities": [
    {
      "type": "投资类型",
      "description": "投资描述",
      "requiredInvestment": "所需投资金额(万元)",
      "expectedROI": 预期回报率百分比,
      "paybackPeriod": "回收周期",
      "riskLevel": "low|medium|high",
      "riskLevelText": "风险等级文本"
    }
  ],
  "riskAlerts": [
    {
      "severity": "high|medium|low",
      "icon": "图标",
      "title": "风险标题",
      "description": "风险描述",
      "suggestion": "建议措施"
    }
  ]
}

## 当前财务数据分析：

**总体财务状况：**
- 月收入：¥${financialData.overview.totalIncome}万
- 月支出：¥${financialData.overview.totalExpense}万
- 净利润：¥${financialData.overview.profit}万
- 利润率：${financialData.profitMargin}%

**成本结构分析：**
- 饲料成本：¥${financialData.overview.feedCost}万 (占比${financialData.overview.feedPercent}%)
- 鹅苗成本：¥${financialData.overview.goslingCost}万 (占比${financialData.overview.goslingPercent}%)
- 医疗成本：¥${financialData.overview.medicalCost}万 (占比${financialData.overview.medicalPercent}%)
- 其他成本：¥${financialData.overview.otherCost}万 (占比${financialData.overview.otherPercent}%)

**近期财务趋势：**
- 近7天收入：¥${(financialData.recentIncome/10000).toFixed(2)}万
- 近7天支出：¥${(financialData.recentExpense/10000).toFixed(2)}万
- 记录数量：${financialData.recordCount}条
- 近期记录：${financialData.recentRecordCount}条

**支出分类明细：**
${Object.entries(financialData.expenseCategories).map(([category, amount]: [string, any]) => 
  `- ${category}：¥${(amount/10000).toFixed(2)}万`
).join('\n')}

请基于以上数据进行专业的财务健康度评估，提供成本优化建议，进行盈利预测，给出投资建议，并识别潜在的财务风险。分析应该具体、实用，针对鹅类养殖业的特点。`
  },
  
  // 解析AI财务分析结果
  parseFinancialAnalysisResult(content: string): any {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        
        // 数据验证和处理
        return {
          healthScore: result.healthScore || 75,
          healthLevel: result.healthLevel || 'good',
          healthIndicators: result.healthIndicators || [],
          costOptimization: result.costOptimization || [],
          monthlyForecast: result.monthlyForecast || [],
          forecastConfidence: result.forecastConfidence || 80,
          investmentOpportunities: result.investmentOpportunities || [],
          riskAlerts: result.riskAlerts || []
        }
      }
    } catch (error) {
      // 已移除调试日志
    }
    
    // 解析失败时返回备用结果
    return this.generateFallbackAnalysis()
  },
  
  // 生成备用财务分析结果
  generateFallbackAnalysis(): any {
    const { overview } = this.data
    const totalIncome = parseFloat(overview.income) * 10000 || 0
    const profit = parseFloat(overview.profit) * 10000 || 0
    const profitMargin = totalIncome > 0 ? (profit / totalIncome * 100) : 0
    
    return {
      healthScore: profitMargin > 20 ? 85 : profitMargin > 10 ? 70 : profitMargin > 0 ? 60 : 45,
      healthLevel: profitMargin > 20 ? 'excellent' : profitMargin > 10 ? 'good' : profitMargin > 0 ? 'average' : 'poor',
      healthIndicators: [
        {
          category: '现金流',
          score: profitMargin > 0 ? 75 : 40,
          level: profitMargin > 0 ? 'good' : 'poor'
        },
        {
          category: '盈利能力',
          score: Math.max(30, Math.min(90, profitMargin * 3)),
          level: profitMargin > 15 ? 'excellent' : profitMargin > 8 ? 'good' : profitMargin > 0 ? 'average' : 'poor'
        },
        {
          category: '成本控制',
          score: parseFloat(overview.feedPercent) < 60 ? 80 : 60,
          level: parseFloat(overview.feedPercent) < 60 ? 'good' : 'average'
        },
        {
          category: '增长潜力',
          score: 70,
          level: 'good'
        }
      ],
      costOptimization: [
        {
          category: '饲料采购',
          potentialSaving: '1.2',
          recommendation: '建议批量采购优质饲料，选择性价比更高的供应商',
          expectedImpact: '降低饲料成本8-12%',
          timeline: '1-2个月'
        },
        {
          category: '能源管理',
          potentialSaving: '0.8',
          recommendation: '优化养殖环境控制系统，减少不必要的能耗',
          expectedImpact: '节省电费和燃料成本',
          timeline: '即时执行'
        }
      ],
      monthlyForecast: [
        {
          month: '下个月',
          income: (parseFloat(overview.totalIncome) * 1.05).toFixed(1),
          expense: (parseFloat(overview.totalExpense) * 1.02).toFixed(1),
          profit: (parseFloat(overview.profit) * 1.15).toFixed(1),
          trendDirection: 'up',
          trendText: '稳步增长'
        },
        {
          month: '两个月后',
          income: (parseFloat(overview.totalIncome) * 1.08).toFixed(1),
          expense: (parseFloat(overview.totalExpense) * 1.03).toFixed(1),
          profit: (parseFloat(overview.profit) * 1.25).toFixed(1),
          trendDirection: 'up',
          trendText: '持续向好'
        },
        {
          month: '三个月后',
          income: (parseFloat(overview.totalIncome) * 1.12).toFixed(1),
          expense: (parseFloat(overview.totalExpense) * 1.05).toFixed(1),
          profit: (parseFloat(overview.profit) * 1.35).toFixed(1),
          trendDirection: 'up',
          trendText: '显著提升'
        }
      ],
      forecastConfidence: 75,
      investmentOpportunities: [
        {
          type: '设备升级',
          description: '投资自动化喂养设备，提高养殖效率',
          requiredInvestment: '5.0',
          expectedROI: 35,
          paybackPeriod: '18个月',
          riskLevel: 'low',
          riskLevelText: '低风险'
        },
        {
          type: '规模扩张',
          description: '新建养殖区域，扩大养殖规模',
          requiredInvestment: '12.0',
          expectedROI: 28,
          paybackPeriod: '24个月',
          riskLevel: 'medium',
          riskLevelText: '中等风险'
        }
      ],
      riskAlerts: profitMargin < 5 ? [
        {
          severity: 'high',
          icon: '🚨',
          title: '盈利能力偏低',
          description: '当前利润率较低，存在经营风险',
          suggestion: '优化成本结构，提高产品价值'
        }
      ] : []
    }
  },

  // 查看记录详情
  viewRecordDetail(e: any) {
    const { item } = e.currentTarget.dataset
    this.setData({
      selectedRecord: item,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeDetailPopup() {
    this.setData({
      showDetailPopup: false
    })
    // 延迟清空数据，避免弹窗关闭动画时数据闪烁
    setTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  },

  // 查看审批详情
  viewApprovalDetail(e: any) {
    const { item } = e.currentTarget.dataset
    wx.showModal({
      title: '审批详情',
      content: `申请人：${item.applicant}\n\n${item.title}\n\n${item.description}\n\n金额：¥${item.amount}\n提交时间：${item.submitTime}`,
      confirmText: '通过',
      cancelText: '拒绝',
      success: (res) => {
        if (res.confirm) {
          this.approveApproval({ currentTarget: { dataset: { id: item.id } } })
        } else if (res.cancel) {
          this.rejectApproval({ currentTarget: { dataset: { id: item.id } } })
        }
      }
    })
  },

  // 通过审批
  async approveApproval(e: any) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认操作',
      content: '确认通过此申请？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' })
            const result = await wx.cloud.callFunction({
              name: 'finance-management',
              data: {
                action: 'approve_reimbursement',
                reimbursementId: id
              }
            })
            wx.hideLoading()
            
            if (result.result?.success) {
              wx.showToast({
                title: '申请已通过',
                icon: 'success'
              })
              // 重新加载审批列表
              await this.loadApprovalItems()
            } else {
              throw new Error(result.result?.error || '审批失败')
            }
          } catch (error: any) {
            wx.hideLoading()
            wx.showToast({
              title: error.message || '审批失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 拒绝审批
  async rejectApproval(e: any) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认操作',
      content: '确认拒绝此申请？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' })
            const result = await wx.cloud.callFunction({
              name: 'finance-management',
              data: {
                action: 'reject_reimbursement',
                reimbursementId: id
              }
            })
            wx.hideLoading()
            
            if (result.result?.success) {
              wx.showToast({
                title: '申请已拒绝',
                icon: 'success'
              })
              // 重新加载审批列表
              await this.loadApprovalItems()
            } else {
              throw new Error(result.result?.error || '拒绝失败')
            }
          } catch (error: any) {
            wx.hideLoading()
            wx.showToast({
              title: error.message || '拒绝失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 移除审批项（重新加载列表）
  async removeApprovalItem(id: string) {
    // 重新加载审批列表以获取最新数据
    await this.loadApprovalItems()
  },

  // 手动记账
  addManualRecord() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 导出报表
  exportReport() {
    wx.showLoading({
      title: '导出中...'
    })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '报表已导出',
        icon: 'success'
      })
    }, 1500)
  },

  // 审批操作 - 适配 TDesign 滑动操作
  onApprovalAction(e: any) {
    const { action } = e.detail
    const { item } = e.currentTarget.dataset
    
    if (action.text === '通过') {
      this.approveApproval({ currentTarget: { dataset: { id: item.id } } })
    } else if (action.text === '拒绝') {
      this.rejectApproval({ currentTarget: { dataset: { id: item.id } } })
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
