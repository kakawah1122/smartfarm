// notification-settings.ts - 通知设置页面
import { createPageWithNavbar } from '../../utils/navigation'
import { getSubscriptionTemplates, SubscriptionTemplate } from '../utils/notification-config'
import { logger } from '../../utils/logger'

type SubscriptionStatus = 'accept' | 'reject' | 'ban' | 'filter' | 'unknown'
type RenderStatus = SubscriptionStatus | 'global-off' | 'unconfigured'

interface SubscriptionItem {
  tmplId: string
  title: string
  description: string
  status: SubscriptionStatus
  renderStatus: RenderStatus
  statusText: string
  statusClass: string
  canSubscribe: boolean
}

const STATUS_META: Record<RenderStatus, { text: string; badgeClass: string; canSubscribe: boolean }> = {
  accept: { text: '已订阅', badgeClass: 'accepted', canSubscribe: false },
  reject: { text: '已拒绝', badgeClass: 'rejected', canSubscribe: true },
  ban: { text: '已被后台禁用', badgeClass: 'banned', canSubscribe: false },
  filter: { text: '默认拒收', badgeClass: 'filtered', canSubscribe: true },
  unknown: { text: '未设置', badgeClass: 'unknown', canSubscribe: true },
  'global-off': { text: '全局开关已关闭', badgeClass: 'global-off', canSubscribe: true },
  unconfigured: { text: '未配置模板ID', badgeClass: 'unconfigured', canSubscribe: false }
}

function resolveRenderStatus(options: {
  status: SubscriptionStatus
  hasTemplateId: boolean
  mainSwitch: boolean
}): RenderStatus {
  if (!options.hasTemplateId) {
    return 'unconfigured'
  }

  if (!options.mainSwitch && options.status === 'accept') {
    return 'global-off'
  }

  return options.status
}

function mapSubscriptionItem(template: SubscriptionTemplate, itemSettings: Record<string, SubscriptionStatus>, mainSwitch: boolean): SubscriptionItem {
  const hasTemplateId = Boolean(template.tmplId)
  const status = (itemSettings?.[template.tmplId] || 'unknown') as SubscriptionStatus
  const renderStatus = resolveRenderStatus({ status, hasTemplateId, mainSwitch })
  const meta = STATUS_META[renderStatus]

  return {
    tmplId: template.tmplId,
    title: template.title,
    description: template.description,
    status,
    renderStatus,
    statusText: meta.text,
    statusClass: meta.badgeClass,
    canSubscribe: meta.canSubscribe && hasTemplateId
  }
}

const SUBSCRIBE_FAIL_TIPS: Record<number, string> = {
  10001: '参数缺失，请检查模板配置',
  20001: '模板无效或已被删除',
  20002: '模板已失效，请重新选择',
  20003: '该账号无权申请此模板',
  20004: '用户关闭了消息总开关，请先开启'
}

const pageConfig = {
  data: {
    loading: true,
    mainSwitch: false,
    canSubscribe: false,
    subscriptions: [] as SubscriptionItem[]
  },

  onLoad() {
    this.loadNotificationSettings()
  },

  onShow() {
    if (!this.data.loading) {
      this.loadNotificationSettings()
    }
  },

  /**
   * 加载通知设置
   */
  loadNotificationSettings() {
    this.setData({ loading: true })
    wx.getSetting({
      withSubscriptions: true,
      success: (res) => {
        const subscriptionsSetting = res.subscriptionsSetting || {}
        const mainSwitch = subscriptionsSetting.mainSwitch ?? false
        const itemSettings = (subscriptionsSetting.itemSettings || {}) as Record<string, SubscriptionStatus>
        const templates = getSubscriptionTemplates()

        if (!templates || templates.length === 0) {
          this.setData({
            loading: false,
            mainSwitch,
            subscriptions: [],
            canSubscribe: false
          })
          wx.showToast({
            title: '尚未配置订阅模板',
            icon: 'none'
          })
          return
        }

        const subscriptions = templates.map(template => mapSubscriptionItem(template, itemSettings, mainSwitch))
        const canSubscribe = subscriptions.some(item => item.canSubscribe && item.status !== 'accept')

        this.setData({
          loading: false,
          mainSwitch,
          subscriptions,
          canSubscribe
        })
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({
          title: '获取通知设置失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 请求订阅消息
   */
  requestSubscribeMessage() {
    if (!this.data.canSubscribe) {
      wx.showToast({
        title: '暂无可订阅的消息',
        icon: 'none'
      })
      return
    }

    if (!this.data.mainSwitch) {
      wx.showModal({
        title: '订阅消息未开启',
        content: '检测到订阅消息总开关已关闭，请先在系统设置中开启后再尝试订阅。',
        confirmText: '前往设置',
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.openSystemSettings()
          }
        }
      })
      return
    }

    const pendingIds = this.data.subscriptions
      .filter(item => item.canSubscribe && item.status !== 'accept')
      .map(item => item.tmplId)

    if (pendingIds.length === 0) {
      wx.showToast({
        title: '已全部订阅',
        icon: 'none'
      })
      return
    }

    const tmplIds = pendingIds.slice(0, 3)

    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        const resultEntries = Object.entries(res).filter(([key]) => key !== 'errMsg')
        const accepted = resultEntries.filter(([, value]) => value === 'accept').map(([key]) => key)
        const rejected = resultEntries.filter(([, value]) => value === 'reject').map(([key]) => key)

        if (accepted.length > 0) {
          wx.showToast({
            title: accepted.length === tmplIds.length ? '订阅成功' : '部分模板订阅成功',
            icon: 'success'
          })
        } else if (rejected.length > 0) {
          wx.showToast({
            title: '用户拒绝订阅',
            icon: 'none'
          })
        }

        this.loadNotificationSettings()
      },
      fail: (err) => {
        logger.error('订阅消息失败:', err)
        const errCode = err?.errCode as number | undefined
        const message = (errCode && SUBSCRIBE_FAIL_TIPS[errCode]) || '订阅失败，请稍后重试'
        wx.showToast({
          title: message,
          icon: 'none'
        })
      }
    })
  },

  /**
   * 打开系统设置
   */
  openSystemSettings() {
    wx.openSetting({
      success: () => {
        this.loadNotificationSettings()
      }
    })
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/profile/profile'
        })
      }
    })
  }
}

Page(createPageWithNavbar(pageConfig))

