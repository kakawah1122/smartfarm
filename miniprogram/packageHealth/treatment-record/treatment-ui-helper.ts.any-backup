/**
 * 治疗记录UI辅助模块
 * 负责处理治疗记录页面的UI交互和状态管理
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * 进度状态配置接口
 */
export interface ProgressStatusConfig {
  label: string
  value: string
  color: string
  icon: string
  bgColor: string
}

/**
 * 统计卡片配置接口
 */
export interface StatCardConfig {
  title: string
  value: number | string
  unit?: string
  color: string
  icon: string
  trend?: number
}

/**
 * 治疗UI辅助类
 */
export class TreatmentUIHelper {
  /**
   * 获取进度状态配置
   */
  static getProgressStatusConfig(status: string): ProgressStatusConfig {
    const configs: Record<string, ProgressStatusConfig> = {
      improving: {
        label: '好转中',
        value: 'improving',
        color: '#22C55E',
        icon: 'trending-up',
        bgColor: '#DCFCE7'
      },
      stable: {
        label: '稳定',
        value: 'stable',
        color: '#3B82F6',
        icon: 'minus',
        bgColor: '#DBEAFE'
      },
      worsening: {
        label: '恶化',
        value: 'worsening',
        color: '#EF4444',
        icon: 'trending-down',
        bgColor: '#FEE2E2'
      },
      observing: {
        label: '观察中',
        value: 'observing',
        color: '#F59E0B',
        icon: 'time',
        bgColor: '#FEF3C7'
      }
    }

    return configs[status] || configs.observing
  }

  /**
   * 生成治疗统计卡片
   */
  static generateStatCards(data: {
    ongoingCount: number
    curedCount: number
    deathCount: number
    totalCost: number
  }): StatCardConfig[] {
    return [
      {
        title: '治疗中',
        value: data.ongoingCount,
        unit: '只',
        color: '#F59E0B',
        icon: 'time-circle'
      },
      {
        title: '已治愈',
        value: data.curedCount,
        unit: '只',
        color: '#22C55E',
        icon: 'check-circle'
      },
      {
        title: '死亡',
        value: data.deathCount,
        unit: '只',
        color: '#EF4444',
        icon: 'close-circle'
      },
      {
        title: '总费用',
        value: this.formatMoney(data.totalCost),
        unit: '元',
        color: '#3B82F6',
        icon: 'money-circle'
      }
    ]
  }

  /**
   * 获取症状标签颜色
   */
  static getSymptomTagColor(symptom: string): string {
    const colorMap: Record<string, string> = {
      '发热': '#EF4444',
      '咳嗽': '#F59E0B',
      '腹泻': '#8B5CF6',
      '食欲不振': '#EC4899',
      '精神萎靡': '#6B7280',
      '呼吸困难': '#DC2626',
      '皮肤异常': '#7C3AED',
      '行动异常': '#2563EB',
      '消化异常': '#16A34A',
      '其他': '#64748B'
    }

    // 匹配关键词
    for (const [key, color] of Object.entries(colorMap)) {
      if (symptom.includes(key)) {
        return color
      }
    }

    return '#64748B' // 默认颜色
  }

  /**
   * 格式化治疗时间显示
   */
  static formatTreatmentTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (days > 30) {
      return this.formatDate(d, 'MM-DD')
    } else if (days > 0) {
      return `${days}天前`
    } else if (hours > 0) {
      return `${hours}小时前`
    } else if (minutes > 0) {
      return `${minutes}分钟前`
    } else {
      return '刚刚'
    }
  }

  /**
   * 生成用药清单显示
   */
  static formatMedicationList(medications: any[]): string[] {
    return medications.map(med => {
      const parts = []
      parts.push(med.medicineName)
      if (med.dosage) parts.push(med.dosage)
      if (med.frequency) parts.push(med.frequency)
      if (med.duration) parts.push(`${med.duration}天`)
      return parts.join(' · ')
    })
  }

  /**
   * 获取批次选项列表
   */
  static formatBatchOptions(batches: any[]): Array<{
    label: string
    value: string
    subLabel?: string
  }> {
    return batches.map(batch => ({
      label: batch.batchNumber || batch._id,
      value: batch._id,
      subLabel: batch.currentCount ? `存栏${batch.currentCount}只` : undefined
    }))
  }

  /**
   * 获取快速操作按钮
   */
  static getQuickActions(): Array<{
    id: string
    label: string
    icon: string
    color: string
    bgColor: string
  }> {
    return [
      {
        id: 'add_progress',
        label: '添加进度',
        icon: 'edit',
        color: '#3B82F6',
        bgColor: '#DBEAFE'
      },
      {
        id: 'add_medication',
        label: '添加用药',
        icon: 'add-circle',
        color: '#22C55E',
        bgColor: '#DCFCE7'
      },
      {
        id: 'complete_cure',
        label: '标记治愈',
        icon: 'check-circle',
        color: '#10B981',
        bgColor: '#D1FAE5'
      },
      {
        id: 'record_death',
        label: '记录死亡',
        icon: 'close-circle',
        color: '#EF4444',
        bgColor: '#FEE2E2'
      }
    ]
  }

  /**
   * 获取筛选选项
   */
  static getFilterOptions(): {
    status: Array<{label: string; value: string}>
    dateRange: Array<{label: string; value: string}>
    batch: Array<{label: string; value: string}>
  } {
    return {
      status: [
        { label: '全部', value: 'all' },
        { label: '治疗中', value: 'ongoing' },
        { label: '已治愈', value: 'cured' },
        { label: '已死亡', value: 'death' },
        { label: '已取消', value: 'cancelled' }
      ],
      dateRange: [
        { label: '今天', value: 'today' },
        { label: '本周', value: 'week' },
        { label: '本月', value: 'month' },
        { label: '全部', value: 'all' }
      ],
      batch: [
        { label: '全部批次', value: 'all' }
      ]
    }
  }

  /**
   * 验证图片
   */
  static validateImage(filePath: string): {
    valid: boolean
    error?: string
  } {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    // const maxSize = 10 * 1024 * 1024 // 10MB - 保留供后续文件大小验证使用
    
    const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
    
    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        error: '仅支持 JPG、PNG、GIF、WEBP 格式'
      }
    }
    
    // 注意：小程序中无法直接获取文件大小，需要通过wx.getFileInfo
    
    return { valid: true }
  }

  /**
   * 生成导出数据
   */
  static formatExportData(records: any[]): string {
    const headers = ['治疗ID', '批次', '动物数', '症状', '诊断', '兽医', '开始时间', '状态', '费用']
    
    const rows = records.map(record => [
      record.treatmentId || record._id,
      record.batchNumber || '',
      record.animalIds?.length || 0,
      record.symptoms || '',
      record.diagnosis || '',
      record.veterinarianName || '',
      this.formatDate(record.treatmentDate),
      this.getStatusLabel(record.status),
      record.totalCost || 0
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    return csvContent
  }

  /**
   * 获取状态标签
   */
  private static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      ongoing: '治疗中',
      cured: '已治愈',
      death: '已死亡',
      cancelled: '已取消'
    }
    return labels[status] || status
  }

  /**
   * 格式化金额
   */
  private static formatMoney(value: number): string {
    if (value >= 10000) {
      return (value / 10000).toFixed(2) + '万'
    }
    return value.toFixed(2)
  }

  /**
   * 格式化日期
   */
  private static formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
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
   * 生成空状态提示
   */
  static getEmptyStateConfig(type: string): {
    icon: string
    title: string
    description: string
    actionText?: string
  } {
    const configs: Record<string, any> = {
      noData: {
        icon: 'folder-add',
        title: '暂无治疗记录',
        description: '点击下方按钮创建新的治疗记录',
        actionText: '创建治疗记录'
      },
      noResult: {
        icon: 'search',
        title: '无搜索结果',
        description: '请尝试调整筛选条件'
      },
      error: {
        icon: 'error-circle',
        title: '加载失败',
        description: '请检查网络连接后重试',
        actionText: '重新加载'
      }
    }
    
    return configs[type] || configs.noData
  }
}
