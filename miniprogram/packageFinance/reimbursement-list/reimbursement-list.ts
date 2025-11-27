// reimbursement-list.ts - 报销列表页面
import { createPageWithNavbar, type PageInstance } from '../../utils/navigation'
import { logger } from '../../utils/logger'
import { safeCloudCall } from '../../utils/safe-cloud-call'

type ReimbursementRecord = FinanceSchema.ReimbursementRecord
type ExtendedReimbursementRecord = ReimbursementRecord & { approvalTime?: string }

interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

interface ReimbursementListResponse {
  records: Array<{
    _id: string
    reimbursement: ExtendedReimbursementRecord
    createTime?: string
    [key: string]: unknown}>
}

/**
 * 格式化时间为 24 小时制，不带秒
 * @param dateStr ISO 时间字符串
 * @returns 格式化后的时间，如 "2025/11/6 20:00"
 */
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  
  return `${year}/${month}/${day} ${hour}:${minute}`
}

// 状态配置
const STATUS_CONFIG = {
  pending: {
    text: '待审批',
    theme: 'warning'
  },
  approved: {
    text: '已通过',
    theme: 'success'
  },
  rejected: {
    text: '已拒绝',
    theme: 'danger'
  }
}

type PageData = {
  list: unknown[]
  currentStatus: 'all' | 'pending' | 'approved' | 'rejected'
  statusTabs: { label: string; value: 'all' | 'pending' | 'approved' | 'rejected' }[]
  loading: boolean
  showDetailDialog: boolean
  selectedRecord: unknown}

const pageConfig: Partial<PageInstance<PageData>> & { data: PageData } = {
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
    list: [],
    currentStatus: 'all', // all, pending, approved, rejected
    statusTabs: [
      { label: '全部', value: 'all' },
      { label: '待审批', value: 'pending' },
      { label: '已通过', value: 'approved' },
      { label: '已拒绝', value: 'rejected' }
    ],
    loading: false,
    showDetailDialog: false,
    selectedRecord: null as unknown
  },

  onLoad(this: PageInstance<PageData>) {
    this.loadList()
  },

  onUnload() {
    this._clearAllTimers()
  },

  /**
   * 返回上一页
   */
  goBack(e?: unknown) {
    // 阻止事件冒泡，避免 navigation-bar 执行默认返回
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
    
    const pages = getCurrentPages()
    
    if (pages.length > 1) {
      // 有上一页，正常返回
      wx.navigateBack({
        delta: 1,
        fail: (err) => {
          logger.error('返回失败:', err)
          // 返回失败，跳转到个人中心页面
          wx.redirectTo({
            url: '/pages/profile/profile',
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
      // 没有上一页，直接跳转到个人中心页面
      wx.redirectTo({
        url: '/pages/profile/profile',
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
    }
  },

  /**
   * 加载报销列表
   */
  async loadList(this: PageInstance<PageData>) {
    try {
      this.setData({ loading: true })
      wx.showLoading({ title: '加载中...' })
      
      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'get_my_reimbursements',
          status: this.data.currentStatus === 'all' ? undefined : this.data.currentStatus
        }
      }) as CloudCallResult<ReimbursementListResponse>
      
      if (result?.success && result.data?.records) {
        const list = result.data.records.map((item) => ({
          ...item,
          statusConfig: STATUS_CONFIG[item.reimbursement.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending,
          createTime: formatDateTime(item.createTime),
          reimbursement: {
            ...item.reimbursement,
            approvalTime: formatDateTime(item.reimbursement?.approvalTime)
          }
        }))
        
        this.setData({ list })
      }
      
      wx.hideLoading()
      this.setData({ loading: false })
    } catch (error) {
      wx.hideLoading()
      this.setData({ loading: false })
      logger.error('加载报销列表失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 切换状态筛选
   */
  onStatusChange(this: PageInstance<PageData>, e: WechatMiniprogram.BaseEvent & { currentTarget: { dataset: { status: 'all' | 'pending' | 'approved' | 'rejected' } } }) {
    const { status } = e.currentTarget.dataset
    this.setData({ currentStatus: status })
    this.loadList()
  },

  /**
   * 点击报销项 - 显示详情弹窗
   */
  onItemTap(this: PageInstance<PageData>, e: WechatMiniprogram.BaseEvent & { currentTarget: { dataset: { id: string } } }) {
    const { id } = e.currentTarget.dataset
    const item = this.data.list.find((item: unknown) => item._id === id)
    
    if (item) {
      this.setData({
        selectedRecord: item,
        showDetailDialog: true
      })
    }
  },

  /**
   * 关闭详情弹窗
   */
  closeDetailDialog(this: PageInstance<PageData>) {
    this.setData({
      showDetailDialog: false
    })
    // ⚠️ 重要：延迟清空数据，避免弹窗关闭动画时数据闪烁
    this._safeSetTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))

