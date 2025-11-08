export interface SubscriptionTemplate {
  /** 订阅消息模板 ID，需要在微信公众平台配置后填入 */
  tmplId: string
  /** 用于前端展示的标题 */
  title: string
  /** 订阅消息说明，便于用户理解用途 */
  description: string
  /** 可选：业务场景标识，便于扩展 */
  scene?: string
}

/**
 * 默认订阅消息模板配置。
 * ⚠️ 请在发布前将 tmplId 替换为微信公众平台实际生成的模板 ID。
 * 如需统一维护，也可以在 app.ts 的 globalData.subscriptionTemplates 中动态注入。
 */
const DEFAULT_SUBSCRIPTION_TEMPLATES: SubscriptionTemplate[] = [
  {
    tmplId: '',
    title: '系统交互消息',
    description: '系统提醒类通知，例如审批进度、任务通知等'
  },
  {
    tmplId: '',
    title: '生产进度提醒',
    description: '与生产计划、排行榜等相关的通知消息'
  }
]

interface AppWithSubscriptionTemplates {
  globalData?: {
    subscriptionTemplates?: SubscriptionTemplate[]
  }
}

/**
 * 获取订阅消息模板配置
 */
export function getSubscriptionTemplates(): SubscriptionTemplate[] {
  try {
    const app = getApp<AppWithSubscriptionTemplates>()
    const globalTemplates = app?.globalData?.subscriptionTemplates
    if (Array.isArray(globalTemplates) && globalTemplates.length > 0) {
      return globalTemplates
    }
  } catch (error) {
    // getApp 可能在极端场景下抛错，此处兜底使用默认配置
  }
  return DEFAULT_SUBSCRIPTION_TEMPLATES
}

