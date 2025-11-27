// 全部审批历史页面
import CloudApi from '../../utils/cloud-api'

// 微信小程序事件类型
type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>

// 审批历史项类型
interface ApprovalHistoryItem {
  _id: string
  createTime: Date | string
  status: string
  type: string
  metadata?: {
    amount?: number
    [key: string]: unknown
  }
  formattedDate?: string
  statusText?: string
}

Page({
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
    // 审批历史记录列表
    approvalHistory: [] as ApprovalHistoryItem[],
    
    // 加载状态
    loading: false,
    loadingMore: false,
    
    // 分页
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    
    // 弹窗
    showDetailPopup: false,
    selectedApprovalItem: null as ApprovalHistoryItem | null,
    
    // 空状态
    isEmpty: false
  },

  onLoad() {
    this.loadApprovalHistory()
  },

  onUnload() {
    this._clearAllTimers()
  },
  
  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        // 如果没有上一页，返回财务管理页
        wx.redirectTo({
          url: '/packageFinance/finance/finance'
        })
      }
    })
  },
  
  // 加载审批历史
  async loadApprovalHistory(append: boolean = false) {
    if (this.data.loading || this.data.loadingMore) return
    
    this.setData({
      [append ? 'loadingMore' : 'loading']: true
    })
    
    try {
      const result = await CloudApi.callFunction<unknown>(
        'finance-management',
        {
          action: 'get_approval_history',
          page: append ? this.data.currentPage + 1 : 1,
          pageSize: this.data.pageSize,
          status: 'all' // 获取所有状态
        },
        {
          showError: false
        }
      )
      
      if (result.success && result.data?.records) {
        const records = result.data.records.map((item: unknown) => this.formatApprovalItem(item))
        
        const newList = append ? [...this.data.approvalHistory, ...records] : records
        const hasMore = result.data.pagination.page < result.data.pagination.totalPages
        
        this.setData({
          approvalHistory: newList,
          hasMore,
          isEmpty: newList.length === 0,
          currentPage: result.data.pagination.page
        })
      } else {
        if (!append) {
          this.setData({ isEmpty: true })
        }
        this.setData({ hasMore: false })
      }
      
    } catch (error) {
      console.error('加载审批历史失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      
      if (!append) {
        this.setData({ isEmpty: true })
      }
    } finally {
      this.setData({
        loading: false,
        loadingMore: false
      })
    }
  },
  
  // 格式化审批项
  formatApprovalItem(record: unknown): unknown {
    // 获取申请人信息
    const applicant = record.metadata?.operator || '未知'
    
    // 获取报销类型名称
    const typeName = record.metadata?.typeName || '报销申请'
    
    // 格式化日期
    const date = record.approvalTime || 
                record.createTime
    const formattedDate = date ? new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : '未知时间'
    
    return {
      id: record._id || record.recordId,
      recordId: record.recordId,  // 关联的报销记录ID
      type: 'expense',
      applicant: applicant,
      title: typeName,
      description: record.metadata?.reason || '',
      amount: this.formatAmount(record.metadata?.amount),
      status: record.status || 'pending',
      formattedDate: formattedDate,
      rejectReason: record.rejectionReason || '',
      approvedBy: record.metadata?.approverInfo?.name || '',
      rejectedBy: record.status === 'rejected' ? (record.metadata?.approverInfo?.name || '') : '',
      submitTime: this.formatSubmitTime(record.createTime),
      approvalRemark: record.approvalRemark || ''
    }
  },
  
  // 获取报销类型标题
  getReimbursementTypeTitle(type: string): string {
    const typeMap: unknown = {
      'feed': '饲料采购',
      'medicine': '兽药疫苗',
      'equipment': '设备维护',
      'utility': '水电燃料',
      'labor': '人工费用',
      'transport': '运输费用',
      'office': '办公用品',
      'other': '其他费用'
    }
    return typeMap[type] || '其他费用'
  },
  
  // 格式化金额
  formatAmount(amount: number | undefined): string {
    if (!amount || isNaN(amount)) return '0.00'
    return amount.toFixed(2)
  },
  
  // 格式化提交时间
  formatSubmitTime(createTime: string | number | Date | undefined): string {
    if (!createTime) return '未知时间'
    
    const date = new Date(createTime)
    if (isNaN(date.getTime())) return '未知时间'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  },
  
  // 点击历史记录项
  onClickHistoryItem(e: CustomEvent) {
    const { item } = e.currentTarget.dataset
    this.setData({
      selectedApprovalItem: item,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeDetailPopup() {
    this.setData({
      showDetailPopup: false
    })
    // 延迟清空数据，避免动画时闪烁
    this._safeSetTimeout(() => {
      this.setData({
        selectedApprovalItem: null
      })
    }, 300)
  },

  // 弹窗visible状态变化（支持点击遮罩层关闭）
  onDetailPopupVisibleChange(e: CustomEvent) {
    const { visible } = e.detail
    if (!visible && this.data.showDetailPopup) {
      this.closeDetailPopup()
    }
  },
  
  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadApprovalHistory()
    wx.stopPullDownRefresh()
  },
  
  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadApprovalHistory(true)
    }
  }
})
