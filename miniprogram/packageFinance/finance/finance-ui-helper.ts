/**
 * 财务管理UI辅助模块
 * 负责处理财务页面的UI交互和状态管理
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * Tab配置接口
 */
export interface TabConfig {
  key: string
  label: string
  icon?: string
  badge?: number
}

/**
 * 筛选条件接口
 */
export interface FilterOptions {
  dateRange: {
    start: string
    end: string
    type: 'today' | 'week' | 'month' | 'year' | 'custom'
  }
  transactionType?: 'all' | 'income' | 'expense'
  category?: string
  status?: string
}

/**
 * 财务UI辅助类
 */
export class FinanceUIHelper {
  /**
   * 获取Tab配置
   */
  static getTabConfigs(): TabConfig[] {
    return [
      { key: 'overview', label: '财务概览', icon: 'chart-line' },
      { key: 'records', label: '交易记录', icon: 'bulletpoint' },
      { key: 'analysis', label: '成本分析', icon: 'chart-pie' },
      { key: 'ai', label: 'AI财务分析', icon: 'precise-monitor' }
    ]
  }
  
  /**
   * 获取默认筛选条件
   */
  static getDefaultFilters(): FilterOptions {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    return {
      dateRange: {
        start: this.formatDate(start),
        end: this.formatDate(end),
        type: 'month'
      },
      transactionType: 'all'
    }
  }
  
  /**
   * 获取快捷日期范围选项
   */
  static getDateRangeOptions(): Array<{label: string; value: string}> {
    return [
      { label: '今天', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '本月', value: 'month' },
      { label: '本季度', value: 'quarter' },
      { label: '本年', value: 'year' },
      { label: '自定义', value: 'custom' }
    ]
  }
  
  /**
   * 获取交易类型选项
   */
  static getTransactionTypes(): Array<{label: string; value: string; color: string}> {
    return [
      { label: '全部', value: 'all', color: '#666666' },
      { label: '收入', value: 'income', color: '#22C55E' },
      { label: '支出', value: 'expense', color: '#EF4444' }
    ]
  }
  
  /**
   * 获取收入类别选项
   */
  static getIncomeCategories(): Array<{label: string; value: string; icon: string}> {
    return [
      { label: '销售收入', value: 'sales', icon: 'money-circle' },
      { label: '补贴收入', value: 'subsidy', icon: 'discount' },
      { label: '其他收入', value: 'other', icon: 'more' }
    ]
  }
  
  /**
   * 获取支出类别选项
   */
  static getExpenseCategories(): Array<{label: string; value: string; icon: string}> {
    return [
      { label: '饲料成本', value: 'feed', icon: 'queue' },
      { label: '疫苗药品', value: 'medicine', icon: 'secured' },
      { label: '人工成本', value: 'labor', icon: 'user-group' },
      { label: '设备折旧', value: 'equipment', icon: 'tools' },
      { label: '水电费用', value: 'utility', icon: 'home' },
      { label: '运输费用', value: 'transport', icon: 'vehicle' },
      { label: '其他支出', value: 'other', icon: 'more-circle' }
    ]
  }
  
  /**
   * 格式化日期显示
   */
  static formatDateDisplay(date: string | Date, format: string = 'YYYY-MM-DD'): string {
    const d = typeof date === 'string' ? new Date(date) : date
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    
    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
  }
  
  /**
   * 格式化金额显示（带符号）
   */
  static formatAmountWithSign(amount: number, type: 'income' | 'expense'): string {
    const sign = type === 'income' ? '+' : '-'
    const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${sign}¥${formatted}`
  }
  
  /**
   * 获取状态标签配置
   */
  static getStatusConfig(status: string): {label: string; color: string} {
    const configs: Record<string, {label: string; color: string}> = {
      completed: { label: '已完成', color: '#22C55E' },
      pending: { label: '待处理', color: '#F59E0B' },
      cancelled: { label: '已取消', color: '#9CA3AF' },
      approved: { label: '已审批', color: '#3B82F6' },
      rejected: { label: '已拒绝', color: '#EF4444' }
    }
    
    return configs[status] || { label: status, color: '#666666' }
  }
  
  /**
   * 生成统计卡片数据
   */
  static generateStatCards(overview: any): Array<{
    title: string
    value: string
    unit?: string
    trend?: number
    color: string
    icon: string
  }> {
    return [
      {
        title: '总收入',
        value: this.formatAmount(overview.totalRevenue),
        unit: '万',
        trend: overview.revenueGrowth,
        color: '#22C55E',
        icon: 'money-circle'
      },
      {
        title: '总支出',
        value: this.formatAmount(overview.totalCost),
        unit: '万',
        trend: overview.costGrowth,
        color: '#EF4444',
        icon: 'wallet'
      },
      {
        title: '净利润',
        value: this.formatAmount(overview.netProfit),
        unit: '万',
        trend: overview.profitGrowth,
        color: overview.netProfit >= 0 ? '#3B82F6' : '#EF4444',
        icon: 'chart-line'
      },
      {
        title: '利润率',
        value: overview.profitMargin.toFixed(1),
        unit: '%',
        trend: overview.marginGrowth,
        color: '#8B5CF6',
        icon: 'chart-pie'
      }
    ]
  }
  
  /**
   * 验证金额输入
   */
  static validateAmount(value: string): {valid: boolean; amount: number; error?: string} {
    const amount = parseFloat(value)
    
    if (isNaN(amount)) {
      return { valid: false, amount: 0, error: '请输入有效的金额' }
    }
    
    if (amount < 0) {
      return { valid: false, amount: 0, error: '金额不能为负数' }
    }
    
    if (amount > 999999999) {
      return { valid: false, amount: 0, error: '金额超出限制' }
    }
    
    return { valid: true, amount: amount }
  }
  
  /**
   * 生成导出数据
   */
  static generateExportData(records: any[], format: 'csv' | 'excel'): string {
    const headers = ['日期', '类型', '类别', '金额', '描述', '操作人', '状态']
    const rows = records.map(record => [
      this.formatDateDisplay(record.date),
      record.type === 'income' ? '收入' : '支出',
      record.category,
      record.amount.toFixed(2),
      record.description || '',
      record.operator || '',
      this.getStatusConfig(record.status).label
    ])
    
    if (format === 'csv') {
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')
      return csvContent
    }
    
    // Excel格式需要更复杂的处理，这里简化为Tab分隔
    const excelContent = [headers, ...rows]
      .map(row => row.join('\t'))
      .join('\n')
    return excelContent
  }
  
  /**
   * 私有方法：格式化日期
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  /**
   * 私有方法：格式化金额（万元）
   */
  private static formatAmount(value: number): string {
    return (value / 10000).toFixed(2)
  }
}
