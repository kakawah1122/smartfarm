// 健康管理业务逻辑层（BLL）- 统一业务逻辑处理
// 解决：业务逻辑分散、计算重复、缺乏复用等问题

const HealthDataAccessLayer = require('./data-access-layer')

class HealthBusinessLogic {
  constructor(db, openid) {
    this.dal = new HealthDataAccessLayer(db, openid)
  }

  /**
   * ✅ 计算单批次健康统计（完整版）
   * 一次性返回该批次所有需要的数据
   */
  async calculateBatchHealthStats(batchId) {
    console.log('[BLL] 计算批次健康统计, batchId:', batchId)
    const startTime = Date.now()

    // ✅ 并行查询所有需要的数据
    const [
      batch,
      treatments,
      aiDiagnosis,
      abnormalRecords,
      deathRecords
    ] = await Promise.all([
      this.dal.getBatchById(batchId),
      this.dal.getTreatmentRecords(batchId),
      this.dal.getAIDiagnosisRecords(batchId),
      this.dal.getAbnormalRecords(batchId),
      this.dal.getDeathRecords(batchId)
    ])

    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }

    // ✅ 计算统计数据
    const stats = this._calculateStats(treatments, aiDiagnosis)

    console.log(`[BLL] 批次统计完成，耗时: ${Date.now() - startTime}ms`)

    return {
      batchInfo: batch,
      stats,
      details: {
        treatments,
        aiDiagnosis,
        abnormalRecords,
        deathRecords
      }
    }
  }

  /**
   * ✅ 计算所有批次健康统计（汇总版）
   */
  async calculateAllBatchesHealthStats() {
    console.log('[BLL] 计算所有批次健康统计')
    const startTime = Date.now()

    const batches = await this.dal.getAllActiveBatches()
    
    if (batches.length === 0) {
      return {
        batches: [],
        aggregated: this._getEmptyStats(),
        totalBatches: 0
      }
    }

    // ✅ 并行计算所有批次的统计
    const batchStatsPromises = batches.map(batch => 
      this.calculateBatchHealthStats(batch._id)
        .catch(error => {
          console.error(`[BLL] 批次${batch.batchNumber}统计失败:`, error)
          return null
        })
    )

    const batchStats = (await Promise.all(batchStatsPromises))
      .filter(stats => stats !== null)

    // ✅ 汇总统计
    const aggregated = this._aggregateStats(batchStats)

    console.log(`[BLL] 所有批次统计完成，耗时: ${Date.now() - startTime}ms`)

    return {
      batches: batchStats,
      aggregated,
      totalBatches: batches.length
    }
  }

  /**
   * ✅ 内部：计算统计数据
   * 统一的计算逻辑，避免重复代码
   */
  _calculateStats(treatments, aiDiagnosis) {
    // 待处理诊断数（未建立治疗方案的AI诊断）
    const pendingDiagnosis = aiDiagnosis.filter(d => !d.hasTreatment).length

    // 治疗中的记录
    const ongoingTreatments = treatments.filter(t => {
      const status = t.outcome?.status
      return status === 'ongoing' || status === 'pending'
    })

    // 治疗中的动物数（总数 - 治愈数 - 死亡数）
    const ongoingAnimalsCount = ongoingTreatments.reduce((sum, t) => {
      const total = t.outcome?.totalTreated || 0
      const cured = t.outcome?.curedCount || 0
      const died = t.outcome?.deathCount || 0
      return sum + Math.max(0, total - cured - died)
    }, 0)

    // 治愈数
    const curedCount = treatments.reduce((sum, t) => 
      sum + (t.outcome?.curedCount || 0), 0
    )

    // 死亡数
    const deadCount = treatments.reduce((sum, t) => 
      sum + (t.outcome?.deathCount || 0), 0
    )

    // 总治疗数
    const totalTreated = treatments.reduce((sum, t) => 
      sum + (t.outcome?.totalTreated || 0), 0
    )

    // 治疗成本
    const totalCost = treatments.reduce((sum, t) => 
      sum + (t.cost?.total || 0), 0
    )

    // 治愈率
    const cureRate = totalTreated > 0 
      ? ((curedCount / totalTreated) * 100).toFixed(1)
      : '0'

    return {
      pendingDiagnosis,                    // 待处理诊断数
      ongoingTreatment: ongoingTreatments.length,  // 治疗中记录数
      ongoingAnimalsCount,                 // 治疗中动物数
      curedCount,                          // 治愈数
      deadCount,                           // 死亡数
      totalTreated,                        // 总治疗数
      totalCost: parseFloat(totalCost.toFixed(2)),  // 总成本
      cureRate: parseFloat(cureRate)       // 治愈率
    }
  }

  /**
   * ✅ 内部：汇总所有批次的统计
   */
  _aggregateStats(batchStats) {
    return batchStats.reduce((agg, batch) => {
      const stats = batch.stats
      return {
        pendingDiagnosis: agg.pendingDiagnosis + stats.pendingDiagnosis,
        ongoingTreatment: agg.ongoingTreatment + stats.ongoingTreatment,
        ongoingAnimalsCount: agg.ongoingAnimalsCount + stats.ongoingAnimalsCount,
        curedCount: agg.curedCount + stats.curedCount,
        deadCount: agg.deadCount + stats.deadCount,
        totalTreated: agg.totalTreated + stats.totalTreated,
        totalCost: agg.totalCost + stats.totalCost,
        cureRate: 0  // 最后统一计算
      }
    }, this._getEmptyStats())
  }

  /**
   * ✅ 内部：返回空统计
   */
  _getEmptyStats() {
    return {
      pendingDiagnosis: 0,
      ongoingTreatment: 0,
      ongoingAnimalsCount: 0,
      curedCount: 0,
      deadCount: 0,
      totalTreated: 0,
      totalCost: 0,
      cureRate: 0
    }
  }
}

module.exports = HealthBusinessLogic
