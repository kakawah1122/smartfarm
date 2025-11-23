import type {
  InputEvent,
  TapEvent,
  CustomEvent
} from '../../../typings/core';

// 分析历史详情弹窗组件
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 分析记录数据
    record: {
      type: Object,
      value: undefined
    }
  },

  data: {
    // 内部处理的记录数据
    processedRecord: null as any
  },

  observers: {
    'record': function(record: unknown) {
      if (record) {
        this.processRecord(record)
      }
    }
  },

  methods: {
    // 格式化日期时间
    formatDateTime(dateValue: unknown): string {
      if (!dateValue) return '未知时间'
      
      try {
        let date: Date
        
        // 处理不同的日期格式
        if (typeof dateValue === 'string') {
          date = new Date(dateValue)
        } else if (dateValue.$date) {
          // 处理 MongoDB 日期格式
          date = new Date(dateValue.$date)
        } else if (dateValue instanceof Date) {
          date = dateValue
        } else {
          // 尝试转换为毫秒时间戳
          date = new Date(dateValue)
        }
        
        // 检查日期是否有效
        if (isNaN(date.getTime())) {
          return '未知时间'
        }
        
        // 格式化为中文日期时间
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch (error) {
        console.error('日期格式化错误:', error, dateValue)
        return '未知时间'
      }
    },
    
    // 处理记录数据
    processRecord(record: unknown) {
      if (!record) return
      
      const processed = {
        ...record,
        // 格式化日期时间，兼容多种字段名
        formattedDate: this.formatDateTime(record.createTime || record.analyzedAt || record._createTime),
        // 分析类型
        analysisType: record.customQuery ? '自定义分析' : '全面分析',
        // 时间范围
        dateRangeText: record.dateRangeText || '全部时间',
        // 摘要
        summary: this.extractSummary(record.analysisResult),
        // 展开后的分析结果
        expandedResult: this.formatAnalysisResult(record.analysisResult)
      }
      
      this.setData({
        processedRecord: processed
      })
    },

    // 提取分析摘要
    extractSummary(result: unknown): string {
      if (!result) return '暂无摘要'
      
      if (result.format === 'text') {
        // 文本格式，取前200个字符
        const text = result.rawText || ''
        return text.length > 200 ? text.substring(0, 200) + '...' : text
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
      
      if (summaries.length > 0) {
        const fullSummary = summaries.join('；')
        // 显示更多内容，最多300个字符
        return fullSummary.length > 300 ? fullSummary.substring(0, 300) + '...' : fullSummary
      }
      
      return '分析完成'
    },

    // 格式化分析结果
    formatAnalysisResult(result: unknown): unknown[] {
      if (!result) return []
      
      const sections = []
      
      // 盈利能力分析
      if (result.profitability) {
        sections.push({
          title: '盈利能力分析',
          type: 'profitability',
          summary: result.profitability.summary || '',
          details: this.extractDetails(result.profitability, ['summary'])
        })
      }
      
      // 成本结构分析
      if (result.costStructure) {
        sections.push({
          title: '成本结构分析',
          type: 'cost',
          summary: result.costStructure.summary || '',
          details: this.extractDetails(result.costStructure, ['summary'])
        })
      }
      
      // 现金流分析
      if (result.cashFlow) {
        sections.push({
          title: '现金流分析',
          type: 'cashflow',
          summary: result.cashFlow.summary || '',
          details: this.extractDetails(result.cashFlow, ['summary'])
        })
      }
      
      // 趋势分析
      if (result.trend) {
        sections.push({
          title: '趋势分析',
          type: 'trend',
          summary: result.trend.summary || '',
          details: this.extractDetails(result.trend, ['summary'])
        })
      }
      
      // 风险评估
      if (result.risk) {
        sections.push({
          title: '风险评估',
          type: 'risk',
          summary: result.risk.summary || '',
          details: this.extractDetails(result.risk, ['summary'])
        })
      }
      
      // 优化建议
      if (result.suggestions) {
        const suggestionDetails = []
        
        if (result.suggestions.immediate?.length > 0) {
          suggestionDetails.push({
            label: '立即执行',
            value: result.suggestions.immediate.join('；')
          })
        }
        
        if (result.suggestions.shortTerm?.length > 0) {
          suggestionDetails.push({
            label: '短期优化',
            value: result.suggestions.shortTerm.join('；')
          })
        }
        
        if (result.suggestions.longTerm?.length > 0) {
          suggestionDetails.push({
            label: '长期战略',
            value: result.suggestions.longTerm.join('；')
          })
        }
        
        sections.push({
          title: '优化建议',
          type: 'suggestions',
          summary: result.suggestions.summary || '',
          details: suggestionDetails
        })
      }
      
      // 文本格式结果
      if (result.format === 'text' && result.rawText) {
        sections.push({
          title: '分析结果',
          type: 'text',
          summary: result.rawText,
          details: []
        })
      }
      
      return sections
    },

    // 提取详情字段
    extractDetails(obj: unknown, excludeKeys: string[] = []): unknown[] {
      const details = []
      const labelMap: unknown = {
        profitMargin: '利润率分析',
        efficiency: '经营效率',
        breakdown: '成本分解',
        optimization: '优化潜力',
        incomeFlow: '收入流',
        expenseFlow: '支出流',
        stability: '稳定性',
        incomeTrend: '收入趋势',
        expenseTrend: '支出趋势',
        profitTrend: '利润趋势',
        financialRisk: '财务风险',
        operationalRisk: '经营风险',
        recommendations: '风险控制建议'
      }
      
      for (const key in obj) {
        if (!excludeKeys.includes(key) && obj[key] && typeof obj[key] === 'string') {
          details.push({
            label: labelMap[key] || key,
            value: obj[key]
          })
        }
      }
      
      return details
    },

    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 弹窗可见性变化
    onVisibleChange(e: InputEvent) {
      if (!e.detail.visible) {
        this.onClose()
      }
    }
  }
})
