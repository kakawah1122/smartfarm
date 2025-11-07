// reimbursement-list.ts - 报销列表页面
import { createPageWithNavbar } from '../../utils/navigation'

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

const pageConfig = {
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
    currentDetail: {} as any
  },

  onLoad() {
    this.loadList()
  },

  /**
   * 加载报销列表
   */
  async loadList() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'get_my_reimbursements',
          status: this.data.currentStatus === 'all' ? undefined : this.data.currentStatus
        }
      })
      
      if (result.result && result.result.success) {
        const list = result.result.data.records.map((item: any) => ({
          ...item,
          statusConfig: STATUS_CONFIG[item.reimbursement.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending,
          // 格式化时间显示（24小时制，不带秒）
          createTime: formatDateTime(item.createTime),
          reimbursement: {
            ...item.reimbursement,
            approvalTime: formatDateTime(item.reimbursement.approvalTime)
          }
        }))
        
        this.setData({ list })
      }
      
      wx.hideLoading()
    } catch (error) {
      wx.hideLoading()
      console.error('加载报销列表失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 切换状态筛选
   */
  onStatusChange(e: any) {
    const { status } = e.currentTarget.dataset
    this.setData({ currentStatus: status })
    this.loadList()
  },

  /**
   * 点击报销项 - 显示详情弹窗
   */
  onItemTap(e: any) {
    const { id } = e.currentTarget.dataset
    const item = this.data.list.find((item: any) => item._id === id)
    
    if (item) {
      this.setData({
        currentDetail: item,
        showDetailDialog: true
      })
    }
  },

  /**
   * 关闭详情弹窗
   */
  closeDetailDialog() {
    this.setData({
      showDetailDialog: false
    })
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 阻止冒泡，防止点击弹窗内容区域关闭弹窗
  },

  /**
   * 预览图片
   */
  previewImage(e: any) {
    const { url, index } = e.currentTarget.dataset
    const vouchers = this.data.currentDetail.reimbursement.vouchers || []
    
    // 提取所有图片的 fileId
    const urls = vouchers.map((v: any) => v.fileId)
    
    wx.previewImage({
      current: url,
      urls: urls
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))

