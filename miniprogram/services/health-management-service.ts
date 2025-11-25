/**
 * 健康管理服务层
 * 封装所有健康相关的云函数调用
 * 使用 HealthCloud 直接调用模块化云函数
 */

import { HealthCloud } from '../utils/cloud-functions'

export class HealthManagementService {
  // ========== 健康记录管理 ==========
  
  /**
   * 创建健康记录
   */
  static async createHealthRecord(data: {
    batchId: string
    totalCount: number
    healthyCount: number
    sickCount: number
    deadCount: number
    symptoms?: string[]
    diagnosis?: string
    treatment?: string
    notes?: string
  }) {
    return await HealthCloud.records.create(data)
  }
  
  /**
   * 获取健康记录列表
   */
  static async listHealthRecords(batchId: string, page = 1, pageSize = 20) {
    return await HealthCloud.records.list({ batchId, page, pageSize })
  }
  
  /**
   * 更新健康记录
   */
  static async updateHealthRecord(recordId: string, updates: any) {
    return await HealthCloud.records.update({ recordId, ...updates })
  }
  
  /**
   * 删除健康记录
   */
  static async deleteHealthRecord(recordId: string) {
    return await HealthCloud.records.delete({ recordId })
  }
  
  /**
   * 获取健康记录详情
   */
  static async getHealthRecordDetail(recordId: string) {
    return await HealthCloud.records.getDetail({ recordId })
  }
  
  /**
   * 按状态查询健康记录
   */
  static async getHealthRecordsByStatus(
    batchId: string,
    status: 'abnormal' | 'treating',
    limit = 20
  ) {
    return await HealthCloud.records.getByStatus({ batchId, status, limit })
  }
  
  /**
   * 获取批次健康汇总
   */
  static async getBatchHealthSummary(batchId: string) {
    return await HealthCloud.records.getBatchSummary({ batchId })
  }
  
  /**
   * 计算健康率
   */
  static async calculateHealthRate(batchId: string) {
    return await HealthCloud.records.calculateRate({ batchId })
  }
  
  // ========== 治疗管理 ==========
  
  /**
   * 创建治疗记录
   */
  static async createTreatmentRecord(data: any) {
    return await HealthCloud.treatment.create(data)
  }
  
  /**
   * 更新治疗记录
   */
  static async updateTreatmentRecord(treatmentId: string, updates: any) {
    return await HealthCloud.treatment.update({ treatmentId, ...updates })
  }
  
  /**
   * 获取治疗记录详情
   */
  static async getTreatmentRecordDetail(treatmentId: string) {
    return await HealthCloud.treatment.getDetail({ treatmentId })
  }
  
  /**
   * 获取进行中的治疗
   */
  static async getOngoingTreatments(batchId: string) {
    return await HealthCloud.treatment.getOngoing({ batchId })
  }
  
  /**
   * 添加治疗备注
   */
  static async addTreatmentNote(treatmentId: string, note: string) {
    return await HealthCloud.treatment.addNote({ treatmentId, note })
  }
  
  /**
   * 添加用药记录
   */
  static async addTreatmentMedication(treatmentId: string, medication: any) {
    return await HealthCloud.treatment.addMedication({ treatmentId, medication })
  }
  
  /**
   * 标记治疗完成（治愈）
   */
  static async completeTreatmentAsCured(treatmentId: string, curedCount: number) {
    return await HealthCloud.treatment.completeCured({ treatmentId, curedCount })
  }
  
  /**
   * 标记治疗完成（死亡）
   */
  static async completeTreatmentAsDied(treatmentId: string, diedCount: number, deathDetails: any) {
    return await HealthCloud.treatment.completeDied({ treatmentId, diedCount, deathDetails })
  }
  
  // ========== 死亡记录管理 ==========
  
  /**
   * 创建死亡记录
   */
  static async createDeathRecord(data: any) {
    return await HealthCloud.death.create(data)
  }
  
  /**
   * 获取死亡记录列表
   */
  static async listDeathRecords(batchId: string, page = 1, pageSize = 20) {
    return await HealthCloud.death.list({ batchId, page, pageSize })
  }
  
  /**
   * 获取死亡统计
   */
  static async getDeathStats(batchId: string) {
    return await HealthCloud.death.getStats({ batchId })
  }
  
  /**
   * 获取死亡记录详情
   */
  static async getDeathRecordDetail(recordId: string) {
    return await HealthCloud.death.getDetail({ recordId })
  }
}
