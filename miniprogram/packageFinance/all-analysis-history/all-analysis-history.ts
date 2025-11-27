// 全部分析历史页面
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
    // 历史记录列表
    analysisHistory: [] as unknown[],
    
    // 加载状态
    loading: false,
    loadingMore: false,
    
    // 分页
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    
    // 弹窗
    showDetailPopup: false,
    selectedAnalysisItem: null as unknown,
    
    // 空状态
    isEmpty: false
  },

  onLoad() {
    this.loadAnalysisHistory()
  },

  onUnload() {
    this._clearAllTimers()
  },
  
  // 加载分析历史
  async loadAnalysisHistory(append: boolean = false) {
    if (this.data.loading || this.data.loadingMore) return
    
    this.setData({
      [append ? 'loadingMore' : 'loading']: true
    })
    
    try {
      const db = wx.cloud.database()
      
      // 分页查询
      const skip = append ? this.data.analysisHistory.length : 0
      const result = await db.collection('finance_analysis_history')
        .where({
          _openid: '{openid}'
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(this.data.pageSize)
        .get()
      
      const records = (result.data || []).map((item: unknown) => ({
        ...item,
        formattedDate: this.formatDateTime(item.createTime),
        summary: this.extractSummary(item.analysisResult)
      }))
      
      const newList = append ? [...this.data.analysisHistory, ...records] : records
      const hasMore = records.length >= this.data.pageSize
      
      this.setData({
        analysisHistory: newList,
        hasMore,
        isEmpty: newList.length === 0
      })
      
    } catch (error) {
      console.error('加载分析历史失败:', error)
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
  
  // 提取分析摘要
  extractSummary(result: unknown): string {
    if (!result) return '暂无摘要'
    
    if (result.format === 'text') {
      return (result.rawText || '').substring(0, 50) + '...'
    }
    
    // JSON格式，提取关键信息
    const summaries = []
    
    if (result.profitability?.summary) {
      summaries.push(result.profitability.summary)
    }
    
    if (result.costStructure?.summary) {
      summaries.push(result.costStructure.summary)
    }
    
    if (result.suggestions?.summary) {
      summaries.push(result.suggestions.summary)
    }
    
    return summaries.length > 0 
      ? summaries.join('；').substring(0, 80) + '...'
      : '分析完成'
  },
  
  // 格式化日期时间（兼容iOS，24小时制）
  formatDateTime(dateValue: unknown): string {
    if (!dateValue) return '未知时间'
    
    // 检查是否是空对象
    if (typeof dateValue === 'object' && dateValue !== null && Object.keys(dateValue).length === 0) {
      return '未知时间'
    }
    
    try {
      let date: Date | null = null
      
      // 处理不同的日期格式
      if (typeof dateValue === 'string') {
        // iOS兼容：将 'YYYY-MM-DD HH:mm:ss' 转换为 'YYYY/MM/DD HH:mm:ss'
        const iosCompatible = dateValue.replace(/-/g, '/')
        date = new Date(iosCompatible)
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue)
      } else if (dateValue instanceof Date) {
        date = dateValue
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        const obj = dateValue as Record<string, unknown>
        
        if (obj.$date) {
          date = new Date(obj.$date as number)
        } else if (obj._seconds !== undefined) {
          date = new Date((obj._seconds as number) * 1000)
        } else if (obj.seconds !== undefined) {
          date = new Date((obj.seconds as number) * 1000)
        } else if (obj.time !== undefined) {
          date = new Date(obj.time as number)
        }
      }
      
      // 检查日期是否有效
      if (!date || isNaN(date.getTime())) {
        return '未知时间'
      }
      
      // 手动格式化为24小时制（iOS兼容）
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}/${month}/${day} ${hours}:${minutes}`
    } catch (error) {
      console.error('日期格式化错误:', error)
      return '未知时间'
    }
  },
  
  // 点击历史记录项
  onClickHistoryItem(e: CustomEvent) {
    const item = e.currentTarget.dataset.item
    this.setData({
      selectedAnalysisItem: item,
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
        selectedAnalysisItem: null
      })
    }, 300)
  },
  
  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      analysisHistory: []
    })
    await this.loadAnalysisHistory()
    wx.stopPullDownRefresh()
  },
  
  // 上拉加载更多
  async onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    
    await this.loadAnalysisHistory(true)
    
    if (!this.data.hasMore) {
      wx.showToast({
        title: '已加载全部记录',
        icon: 'none',
        duration: 1500
      })
    }
  }
})
