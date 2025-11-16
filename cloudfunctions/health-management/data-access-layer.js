// 健康管理数据访问层（DAL）- 统一数据库操作
// 解决：数据查询分散、条件不一致、规范违规等问题

const { COLLECTIONS } = require('./collections')

class HealthDataAccessLayer {
  constructor(db, openid) {
    this.db = db
    this._ = db.command
    this.openid = openid
  }

  /**
   * ✅ 统一的批次查询（支持 userId 和 _openid）
   * 符合规范：使用 COLLECTIONS 常量、OR 条件、字段限制
   */
  async getBatchById(batchId) {
    const result = await this.db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(this._.or([
        { _id: batchId, userId: this.openid, isDeleted: this._.neq(true) },
        { _id: batchId, _openid: this.openid, isDeleted: this._.neq(true) }
      ]))
      .field({
        _id: true,
        batchNumber: true,
        breed: true,
        quantity: true,
        unitPrice: true,
        entryDate: true,
        currentCount: true
      })
      .get()
    return result.data[0] || null
  }

  /**
   * ✅ 统一的批次列表查询
   */
  async getAllActiveBatches() {
    const result = await this.db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(this._.or([
        { userId: this.openid, isDeleted: this._.neq(true) },
        { _openid: this.openid, isDeleted: this._.neq(true) }
      ]))
      .field({
        _id: true,
        batchNumber: true,
        breed: true,
        quantity: true,
        entryDate: true,
        unitPrice: true
      })
      .get()
    return result.data
  }

  /**
   * ✅ 统一的治疗记录查询
   */
  async getTreatmentRecords(batchId = null) {
    const where = {
      _openid: this.openid,
      isDeleted: this._.neq(true),
      isDraft: false
    }
    
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    const result = await this.db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(where)
      .field({
        _id: true,
        treatmentNumber: true,
        batchId: true,
        diagnosis: true,
        outcome: true,
        cost: true,
        createdAt: true,
        affectedCount: true
      })
      .get()
    return result.data
  }

  /**
   * ✅ 统一的AI诊断记录查询
   */
  async getAIDiagnosisRecords(batchId = null, hasTreatment = null) {
    const where = {
      _openid: this.openid,
      isDeleted: false
    }
    
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    if (hasTreatment !== null) {
      where.hasTreatment = hasTreatment
    }
    
    const result = await this.db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .where(where)
      .field({
        _id: true,
        diagnosisType: true,
        diagnosisDate: true,
        diagnosis: true,
        affectedCount: true,
        deathCount: true,
        hasTreatment: true,
        batchId: true
      })
      .orderBy('diagnosisDate', 'desc')
      .get()
    return result.data
  }

  /**
   * ✅ 统一的异常记录查询
   */
  async getAbnormalRecords(batchId = null, limit = 50) {
    const where = {
      _openid: this.openid,
      recordType: 'ai_diagnosis',
      status: 'abnormal',
      isDeleted: this._.neq(true)
    }
    
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    const result = await this.db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(where)
      .limit(limit)
      .orderBy('checkDate', 'desc')
      .get()
    return result.data
  }

  /**
   * ✅ 统一的死亡记录查询
   */
  async getDeathRecords(batchId = null) {
    const where = {
      _openid: this.openid,
      isDeleted: this._.neq(true)
    }
    
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    const result = await this.db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where(where)
      .field({
        _id: true,
        batchId: true,
        deathCount: true,
        deathCause: true,
        createdAt: true
      })
      .get()
    return result.data
  }
}

module.exports = HealthDataAccessLayer
