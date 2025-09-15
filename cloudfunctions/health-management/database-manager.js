// 数据库操作封装层
// 统一管理所有数据库操作，确保命名规范一致性

const { COLLECTIONS } = require('./collections')

class DatabaseManager {
  constructor(db) {
    this.db = db
    this._ = db.command
  }

  // ============ 用户管理相关操作 ============
  
  // 获取用户信息
  async getUser(openid) {
    const result = await this.db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .get()
    return result.data.length > 0 ? result.data[0] : null
  }

  // 创建用户
  async createUser(userData) {
    return await this.db.collection(COLLECTIONS.WX_USERS).add({
      data: this.formatUserData(userData)
    })
  }

  // 更新用户信息
  async updateUser(openid, updateData) {
    return await this.db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .update({
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      })
  }

  // ============ 健康管理相关操作 ============

  // 创建预防记录
  async createPreventionRecord(data) {
    return await this.db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS).add({
      data: this.formatPreventionRecord(data)
    })
  }

  // 查询预防记录
  async listPreventionRecords(params = {}) {
    const { page = 1, pageSize = 20, preventionType, batchId, dateRange } = params
    
    let query = this.db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where({ isDeleted: this._.neq(true) })

    if (preventionType) {
      query = query.where({ preventionType })
    }
    
    if (batchId) {
      query = query.where({ batchId })
    }

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        preventionDate: this._.gte(dateRange.start).and(this._.lte(dateRange.end))
      })
    }

    const result = await query
      .orderBy('preventionDate', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      records: result.data,
      total: result.data.length,
      page,
      pageSize
    }
  }

  // 创建健康记录
  async createHealthRecord(data) {
    return await this.db.collection(COLLECTIONS.HEALTH_RECORDS).add({
      data: this.formatHealthRecord(data)
    })
  }

  // 创建治疗记录
  async createTreatmentRecord(data) {
    return await this.db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: this.formatTreatmentRecord(data)
    })
  }

  // 创建AI诊断记录
  async createAiDiagnosisRecord(data) {
    return await this.db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS).add({
      data: this.formatAiDiagnosisRecord(data)
    })
  }

  // ============ 财务管理相关操作 ============

  // 创建成本记录
  async createCostRecord(data) {
    const costRecord = this.formatCostRecord(data)
    const result = await this.db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({
      data: costRecord
    })
    
    // 触发财务汇总更新
    await this.updateFinanceSummary(costRecord.costDate)
    
    return result
  }

  // 创建收入记录
  async createRevenueRecord(data) {
    const revenueRecord = this.formatRevenueRecord(data)
    const result = await this.db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS).add({
      data: revenueRecord
    })
    
    // 触发财务汇总更新
    await this.updateFinanceSummary(revenueRecord.revenueDate)
    
    return result
  }

  // 查询成本记录
  async listCostRecords(params = {}) {
    const { page = 1, pageSize = 20, costType, dateRange, batchId } = params
    
    let query = this.db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
      .where({ isDeleted: this._.neq(true) })

    if (costType) {
      query = query.where({ costType })
    }
    
    if (batchId) {
      query = query.where({ batchId })
    }

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        costDate: this._.gte(dateRange.start).and(this._.lte(dateRange.end))
      })
    }

    return await query
      .orderBy('costDate', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
  }

  // 更新财务汇总
  async updateFinanceSummary(date) {
    const month = date.substring(0, 7) // YYYY-MM格式
    
    try {
      // 计算月度成本和收入
      const [costStats, revenueStats] = await Promise.all([
        this.calculateMonthlyCosts(month),
        this.calculateMonthlyRevenue(month)
      ])

      const summaryData = {
        period: month,
        periodType: 'month',
        totalRevenue: revenueStats.total,
        totalCost: costStats.total,
        netProfit: revenueStats.total - costStats.total,
        profitMargin: revenueStats.total > 0 ? 
          ((revenueStats.total - costStats.total) / revenueStats.total * 100).toFixed(2) : 0,
        costBreakdown: costStats.breakdown,
        revenueBreakdown: revenueStats.breakdown,
        generatedAt: new Date(),
        generatedBy: 'system',
        isLocked: false
      }

      // 查找现有汇总记录
      const existingResult = await this.db.collection(COLLECTIONS.FINANCE_SUMMARIES)
        .where({ period: month })
        .limit(1)
        .get()

      if (existingResult.data.length > 0) {
        // 更新现有记录
        await this.db.collection(COLLECTIONS.FINANCE_SUMMARIES)
          .doc(existingResult.data[0]._id)
          .update({ data: summaryData })
      } else {
        // 创建新记录
        await this.db.collection(COLLECTIONS.FINANCE_SUMMARIES)
          .add({ data: summaryData })
      }

      // 已移除调试日志
    } catch (error) {
      // 已移除调试日志
    }
  }

  // 计算月度成本
  async calculateMonthlyCosts(month) {
    const result = await this.db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
      .where({
        isDeleted: this._.neq(true),
        costDate: this._.gte(`${month}-01`).and(this._.lte(`${month}-31`))
      })
      .get()

    const total = result.data.reduce((sum, record) => sum + record.amount, 0)
    const breakdown = {}
    
    result.data.forEach(record => {
      breakdown[record.costType] = (breakdown[record.costType] || 0) + record.amount
    })

    return { total, breakdown }
  }

  // 计算月度收入
  async calculateMonthlyRevenue(month) {
    const result = await this.db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS)
      .where({
        isDeleted: this._.neq(true),
        revenueDate: this._.gte(`${month}-01`).and(this._.lte(`${month}-31`))
      })
      .get()

    const total = result.data.reduce((sum, record) => sum + record.amount, 0)
    const breakdown = {}
    
    result.data.forEach(record => {
      breakdown[record.revenueType] = (breakdown[record.revenueType] || 0) + record.amount
    })

    return { total, breakdown }
  }

  // ============ 任务管理相关操作 ============

  // 完成任务
  async completeTask(taskId, openid, batchId) {
    const completionData = {
      taskId,
      batchId,
      completedBy: openid,
      completedAt: new Date(),
      status: 'completed'
    }

    return await this.db.collection(COLLECTIONS.TASK_COMPLETIONS).add({
      data: completionData
    })
  }

  // 查询任务完成记录
  async getTaskCompletions(batchId, openid) {
    return await this.db.collection(COLLECTIONS.TASK_COMPLETIONS)
      .where({
        batchId,
        completedBy: openid
      })
      .get()
  }

  // ============ 系统管理相关操作 ============

  // 更新概览统计
  async updateOverviewStats(batchId, updateType = 'all') {
    const month = new Date().toISOString().substring(0, 7)
    const statsId = `${batchId}_${month}`

    try {
      // 查找现有统计记录
      const existingResult = await this.db.collection(COLLECTIONS.SYS_OVERVIEW_STATS)
        .where({ 
          batchId: batchId,
          period: month 
        })
        .limit(1)
        .get()

      // 计算各项统计数据
      const statsData = await this.calculateOverviewStats(batchId, month, updateType)

      if (existingResult.data.length > 0) {
        // 更新现有记录
        await this.db.collection(COLLECTIONS.SYS_OVERVIEW_STATS)
          .doc(existingResult.data[0]._id)
          .update({ 
            data: {
              ...statsData,
              lastUpdated: new Date()
            }
          })
      } else {
        // 创建新记录
        await this.db.collection(COLLECTIONS.SYS_OVERVIEW_STATS)
          .add({ 
            data: {
              batchId,
              period: month,
              periodType: 'month',
              ...statsData,
              lastUpdated: new Date(),
              isLocked: false
            }
          })
      }

      // 已移除调试日志
    } catch (error) {
      // 已移除调试日志
      throw error
    }
  }

  // 计算概览统计数据
  async calculateOverviewStats(batchId, month, updateType) {
    const dateStart = `${month}-01`
    const dateEnd = `${month}-31`

    const stats = {}

    // 根据更新类型计算相应统计
    if (updateType === 'all' || updateType === 'health') {
      // 健康统计
      const healthRecords = await this.db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId,
          checkDate: this._.gte(dateStart).and(this._.lte(dateEnd))
        })
        .get()

      stats.healthStats = {
        totalChecks: healthRecords.data.length,
        healthyCount: healthRecords.data.reduce((sum, r) => sum + (r.healthyCount || 0), 0),
        sickCount: healthRecords.data.reduce((sum, r) => sum + (r.sickCount || 0), 0),
        deadCount: healthRecords.data.reduce((sum, r) => sum + (r.deadCount || 0), 0)
      }
    }

    if (updateType === 'all' || updateType === 'prevention') {
      // 预防统计
      const preventionRecords = await this.db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where({
          batchId,
          preventionDate: this._.gte(dateStart).and(this._.lte(dateEnd))
        })
        .get()

      stats.preventionStats = {
        totalPreventions: preventionRecords.data.length,
        vaccineCount: preventionRecords.data.filter(r => r.preventionType === 'vaccine').length,
        disinfectionCount: preventionRecords.data.filter(r => r.preventionType === 'disinfection').length,
        totalCost: preventionRecords.data.reduce((sum, r) => sum + (r.costInfo?.totalCost || 0), 0)
      }
    }

    if (updateType === 'all' || updateType === 'finance') {
      // 财务统计
      const [costRecords, revenueRecords] = await Promise.all([
        this.db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
          .where({
            batchId,
            costDate: this._.gte(dateStart).and(this._.lte(dateEnd))
          })
          .get(),
        this.db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS)
          .where({
            batchId,
            revenueDate: this._.gte(dateStart).and(this._.lte(dateEnd))
          })
          .get()
      ])

      const totalCost = costRecords.data.reduce((sum, r) => sum + r.amount, 0)
      const totalRevenue = revenueRecords.data.reduce((sum, r) => sum + r.amount, 0)

      stats.financeStats = {
        totalCost,
        totalRevenue,
        netProfit: totalRevenue - totalCost,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(2) : 0
      }
    }

    return stats
  }

  // ============ 数据格式化方法 ============

  formatUserData(data) {
    return {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
  }

  formatPreventionRecord(data) {
    return {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
  }

  formatHealthRecord(data) {
    return {
      ...data,
      createdAt: new Date(),
      isDeleted: false
    }
  }

  formatTreatmentRecord(data) {
    return {
      ...data,
      createdAt: new Date(),
      isDeleted: false
    }
  }

  formatAiDiagnosisRecord(data) {
    return {
      ...data,
      createdAt: new Date()
    }
  }

  formatCostRecord(data) {
    return {
      ...data,
      currency: 'CNY',
      createdAt: new Date(),
      isDeleted: false
    }
  }

  formatRevenueRecord(data) {
    return {
      ...data,
      currency: 'CNY',
      createdAt: new Date(),
      isDeleted: false
    }
  }

  // ============ 审计日志 ============

  async createAuditLog(userId, action, resource, resourceId, details = {}) {
    const logData = {
      userId,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date(),
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown',
      result: details.result || 'success'
    }

    return await this.db.collection(COLLECTIONS.SYS_AUDIT_LOGS).add({
      data: logData
    })
  }
}

module.exports = DatabaseManager
