/**
 * 数据更新辅助工具
 * 用于优化setData调用，减少渲染次数
 * 保持原有功能不变
 */

/**
 * 批量数据路径更新器
 * 用于更新对象的嵌套属性，避免替换整个对象
 */
export class DataPathBuilder {
  private updates: Record<string, any> = {}
  
  /**
   * 设置健康统计数据
   */
  setHealthStats(data: {
    totalChecks?: number
    healthyCount?: number
    sickCount?: number
    deadCount?: number
    healthyRate?: string
    mortalityRate?: string
    originalQuantity?: number
  }) {
    if (data.totalChecks !== undefined) {
      this.updates['healthStats.totalChecks'] = data.totalChecks
    }
    if (data.healthyCount !== undefined) {
      this.updates['healthStats.healthyCount'] = data.healthyCount
    }
    if (data.sickCount !== undefined) {
      this.updates['healthStats.sickCount'] = data.sickCount
    }
    if (data.deadCount !== undefined) {
      this.updates['healthStats.deadCount'] = data.deadCount
    }
    if (data.healthyRate !== undefined) {
      this.updates['healthStats.healthyRate'] = data.healthyRate
    }
    if (data.mortalityRate !== undefined) {
      this.updates['healthStats.mortalityRate'] = data.mortalityRate
    }
    if (data.originalQuantity !== undefined) {
      this.updates['healthStats.originalQuantity'] = data.originalQuantity
    }
    return this
  }
  
  /**
   * 设置预防统计数据
   */
  setPreventionStats(data: {
    totalPreventions?: number
    vaccineCount?: number
    vaccineCoverage?: number
    medicationCount?: number
    totalCost?: number
  }) {
    Object.keys(data).forEach(key => {
      if (data[key as keyof typeof data] !== undefined) {
        this.updates[`preventionStats.${key}`] = data[key as keyof typeof data]
      }
    })
    return this
  }
  
  /**
   * 设置治疗统计数据
   */
  setTreatmentStats(data: {
    pendingDiagnosis?: number
    ongoingTreatment?: number
    recoveredCount?: number
    deadCount?: number
    totalTreatmentCost?: number
    cureRate?: number
    ongoingAnimalsCount?: number
  }) {
    Object.keys(data).forEach(key => {
      if (data[key as keyof typeof data] !== undefined) {
        this.updates[`treatmentData.stats.${key}`] = data[key as keyof typeof data]
      }
    })
    return this
  }
  
  /**
   * 设置分析数据
   */
  setAnalysisData(section: string, data: unknown) {
    Object.keys(data).forEach(key => {
      this.updates[`analysisData.${section}.${key}`] = data[key]
    })
    return this
  }
  
  /**
   * 设置任意数据路径
   */
  set(path: string, value: unknown) {
    this.updates[path] = value
    return this
  }
  
  /**
   * 批量设置
   */
  setBatch(updates: Record<string, any>) {
    Object.assign(this.updates, updates)
    return this
  }
  
  /**
   * 获取所有更新
   */
  build(): Record<string, any> {
    return this.updates
  }
  
  /**
   * 清空
   */
  clear() {
    this.updates = {}
    return this
  }
}

/**
 * 创建数据路径更新器
 */
export function createDataUpdater() {
  return new DataPathBuilder()
}

/**
 * 数据更新器 - 带commit功能
 */
export class DataUpdater extends DataPathBuilder {
  private pageInstance: any
  
  constructor(pageInstance: any) {
    super()
    this.pageInstance = pageInstance
  }
  
  /**
   * 提交所有更新
   */
  commit() {
    const updates = this.build()
    if (Object.keys(updates).length > 0) {
      this.pageInstance.setData(updates)
      this.clear()
    }
    return this
  }
}
