/**
 * 首页导航模块
 * 管理首页所有的页面跳转逻辑
 */

interface NavigationOptions {
  batchId?: string
  id?: string
  recordId?: string
  [key: string]: any
}

class IndexNavigationModule {
  /**
   * 跳转到健康管理页面
   */
  static navigateToHealth() {
    wx.switchTab({
      url: '/pages/health/health'
    })
  }
  
  /**
   * 跳转到生产管理页面
   */
  static navigateToProduction() {
    wx.switchTab({
      url: '/pages/production/production'
    })
  }
  
  /**
   * 跳转到财务管理页面
   */
  static navigateToFinance() {
    wx.navigateTo({
      url: '/packageFinance/finance/finance'
    })
  }
  
  /**
   * 跳转到知识详情页
   */
  static navigateToKnowledgeDetail(article: any) {
    const category = article.category || 'basic'
    const encodedData = encodeURIComponent(JSON.stringify(article))
    wx.navigateTo({
      url: `/packageUser/knowledge-detail/knowledge-detail?category=${category}&data=${encodedData}`
    })
  }
  
  /**
   * 跳转到任务列表页
   */
  static navigateToTaskList(options?: NavigationOptions) {
    const url = options?.batchId 
      ? `/packageHealth/breeding-todo/breeding-todo?batchId=${options.batchId}`
      : '/packageHealth/breeding-todo/breeding-todo'
    wx.navigateTo({ url })
  }
  
  /**
   * 批量创建页面导航方法
   */
  static createNavigationMethods() {
    return {
      navigateToHealth: this.navigateToHealth.bind(this),
      navigateToProduction: this.navigateToProduction.bind(this),
      navigateToFinance: this.navigateToFinance.bind(this),
      navigateToKnowledgeDetail: this.navigateToKnowledgeDetail.bind(this),
      navigateToTaskList: this.navigateToTaskList.bind(this)
    }
  }
}

export { IndexNavigationModule }

/**
 * 快速设置导航处理器
 */
export function setupIndexNavigation(pageInstance: any) {
  const methods = IndexNavigationModule.createNavigationMethods()
  Object.assign(pageInstance, methods)
}
