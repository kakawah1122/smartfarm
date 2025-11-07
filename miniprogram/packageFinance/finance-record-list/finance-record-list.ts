// finance-record-list.ts - 财务记录列表页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    records: [],
    displayRecords: [],
    currentType: 'all', // all, income, expense
    typeTabs: [
      { label: '全部', value: 'all' },
      { label: '收入', value: 'income' },
      { label: '支出', value: 'expense' }
    ],
    loading: false,
    page: 1,
    pageSize: 50,
    hasMore: true,
    
    // 交易详情弹窗
    showDetailPopup: false,
    selectedRecord: null as any
  },

  onLoad() {
    this.loadRecords()
  },

  // 返回上一页
  goBack(e?: any) {
    // 阻止事件冒泡，避免 navigation-bar 执行默认返回
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
    
    const pages = getCurrentPages()
    console.log('当前页面栈长度:', pages.length)
    
    if (pages.length > 1) {
      // 有上一页，正常返回
      wx.navigateBack({
        delta: 1,
        success: () => {
          console.log('返回成功')
        },
        fail: (err) => {
          console.error('返回失败:', err)
          // 返回失败，跳转到财务管理页面
          wx.redirectTo({
            url: '/packageFinance/finance/finance',
            fail: () => {
              // 如果跳转失败，尝试切换到首页
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    } else {
      // 没有上一页，直接跳转到财务管理页面
      console.log('没有上一页，跳转到财务管理页面')
      wx.redirectTo({
        url: '/packageFinance/finance/finance',
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
    }
  },

  // 切换类型
  onTypeChange(e: any) {
    const type = e.currentTarget.dataset.type
    this.setData({
      currentType: type
    })
    this.filterRecords()
  },

  // 加载记录
  async loadRecords() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const now = new Date()
      const startDate = new Date(now.getFullYear(), 0, 1).toISOString() // 今年开始
      const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString() // 今年结束

      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'get_all_finance_records',
          page: this.data.page,
          pageSize: this.data.pageSize,
          dateRange: { start: startDate, end: endDate }
        }
      })

      if (result.result?.success) {
        const allRecords = result.result.data?.records || []
        const records: any[] = []

        // 处理所有记录
        allRecords.forEach((record: any) => {
          let title = ''
          let description = record.description || ''
          
          // 确保 rawRecord 包含完整的原始数据
          let rawRecord = record.rawRecord || record
          
          // 对于业务记录，确保 rawRecord 包含所有必要字段
          if (record.source === 'exit' || record.source === 'entry' || record.source === 'feed' || record.source === 'purchase') {
            // 如果没有 rawRecord，使用 record 本身
            if (!record.rawRecord) {
              rawRecord = {
                ...record,
                batchNumber: record.batchNumber,
                customer: record.customer,
                supplier: record.supplier,
                quantity: record.quantity,
                breed: record.breed,
                exitNumber: record.exitNumber,
                amount: record.materialAmount || record.feedAmount,
                unit: record.unit,
                materialName: record.materialName,
                name: record.name
              }
            }
          }

          if (record.source === 'finance') {
            if (record.type === 'income') {
              title = this.getRevenueTitle(record.revenueType, record.description)
            } else {
              if (record.isReimbursement && record.reimbursement) {
                title = record.reimbursement.typeName || this.getReimbursementTypeTitle(record.reimbursement.type) || record.description || '报销申请'
              } else {
                title = this.getCostTitle(record.costType, record.description)
              }
            }
          } else if (record.source === 'exit') {
            title = '成鹅销售收入'
            description = record.description || `批次：${record.batchNumber || ''} - 客户：${rawRecord?.customer || '未知'}`
          } else if (record.source === 'entry') {
            title = '入栏采购'
            description = record.description || `批次：${record.batchNumber || ''}`
          } else if (record.source === 'feed') {
            title = '饲料成本'
            description = record.description || `批次：${record.batchNumber || ''}`
          } else if (record.source === 'purchase') {
            if (record.costType === 'feed') {
              title = '饲料成本'
            } else if (record.costType === 'health') {
              title = '医疗费用'
            } else {
              title = '其他费用'
            }
            description = record.description || '物料采购'
          }

          records.push({
            id: record.id,
            type: record.type,
            title: title,
            description: description,
            amount: this.formatAmount(record.amount),
            date: this.formatDate(record.createTime || record.date),
            source: record.source, // 保存来源字段，用于解析详情
            rawRecord: rawRecord // 使用处理后的完整 rawRecord
          })
        })

        // 合并记录
        const newRecords = [...this.data.records, ...records]
        this.setData({
          records: newRecords,
          hasMore: allRecords.length === this.data.pageSize,
          loading: false
        })
        
        this.filterRecords()
      } else {
        this.setData({ loading: false })
        wx.showToast({
          title: result.result?.error || '加载失败',
          icon: 'none'
        })
      }
    } catch (error: any) {
      this.setData({ loading: false })
      console.error('加载财务记录失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 筛选记录
  filterRecords() {
    const { records, currentType } = this.data
    let filtered = records

    if (currentType !== 'all') {
      filtered = records.filter((r: any) => r.type === currentType)
    }

    this.setData({
      displayRecords: filtered
    })
  },

  // 查看记录详情
  viewRecordDetail(e: any) {
    const item = e.currentTarget.dataset.item
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

  // 格式化金额
  formatAmount(amount: number): string {
    return amount ? amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '0'
  },

  // 安全解析日期
  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date()
    
    if (dateStr.includes('T')) {
      return new Date(dateStr)
    }
    
    if (dateStr.includes('-') && dateStr.includes(' ')) {
      const normalized = dateStr.replace(/-/g, '/')
      return new Date(normalized)
    }
    
    if (dateStr.includes('-') && !dateStr.includes(' ')) {
      return new Date(dateStr)
    }
    
    if (dateStr.includes('/')) {
      return new Date(dateStr)
    }
    
    return new Date(dateStr)
  },

  // 格式化日期
  formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = this.parseDate(dateStr)
    
    if (isNaN(date.getTime())) {
      return dateStr
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  },

  // 获取收入标题
  getRevenueTitle(revenueType: string, description: string): string {
    const typeMap: any = {
      'sales': '销售收入',
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
  }
}

Page(createPageWithNavbar(pageConfig))

