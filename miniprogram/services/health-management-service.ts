
/**
 * 健康管理服务层
 * 封装所有健康相关的云函数调用
 */

import { smartCloudCall } from '@/utils/cloud-adapter'

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
    return await smartCloudCall('create_health_record', data)
  }
  
  /**
   * 获取健康记录列表
   */
  static async listHealthRecords(batchId: string, page = 1, pageSize = 20) {
    return await smartCloudCall('list_health_records', {
      batchId,
      page,
      pageSize
    })
  }
  
  /**
   * 更新健康记录
   */
  static async updateHealthRecord(recordId: string, updates: any) {
    return await smartCloudCall('update_health_record', {
      recordId,
      ...updates
    })
  }
  
  /**
   * 删除健康记录
   */
  static async deleteHealthRecord(recordId: string) {
    return await smartCloudCall('delete_health_record', {
      recordId
    })
  }
  
  /**
   * 获取健康记录详情
   */
  static async getHealthRecordDetail(recordId: string) {
    return await smartCloudCall('get_health_record_detail', {
      recordId
    })
  }
  
  /**
   * 按状态查询健康记录
   */
  static async getHealthRecordsByStatus(
    batchId: string,
    status: 'abnormal' | 'treating',
    limit = 20
  ) {
    return await smartCloudCall('get_health_records_by_status', {
      batchId,
      status,
      limit
    })
  }
  
  /**
   * 获取批次健康汇总
   */
  static async getBatchHealthSummary(batchId: string) {
    return await smartCloudCall('get_batch_health_summary', {
      batchId
    })
  }
  
  /**
   * 计算健康率
   */
  static async calculateHealthRate(batchId: string) {
    return await smartCloudCall('calculate_health_rate', {
      batchId
    })
  }
  
  // ========== 治疗管理 ==========
  
  /**
   * 创建治疗记录
   */
  static async createTreatmentRecord(data: any) {
    return await smartCloudCall('create_treatment_record', data)
  }
  
  /**
   * 更新治疗记录
   */
  static async updateTreatmentRecord(treatmentId: string, updates: any) {
    return await smartCloudCall('update_treatment_record', {
      treatmentId,
      ...updates
    })
  }
  
  /**
   * 获取治疗记录详情
   */
  static async getTreatmentRecordDetail(treatmentId: string) {
    return await smartCloudCall('get_treatment_record_detail', {
      treatmentId
    })
  }
  
  /**
   * 获取进行中的治疗
   */
  static async getOngoingTreatments(batchId: string) {
    return await smartCloudCall('get_ongoing_treatments', {
      batchId
    })
  }
  
  /**
   * 添加治疗备注
   */
  static async addTreatmentNote(treatmentId: string, note: string) {
    return await smartCloudCall('add_treatment_note', {
      treatmentId,
      note
    })
  }
  
  /**
   * 添加用药记录
   */
  static async addTreatmentMedication(treatmentId: string, medication: any) {
    return await smartCloudCall('add_treatment_medication', {
      treatmentId,
      medication
    })
  }
  
  /**
   * 标记治疗完成（治愈）
   */
  static async completeTreatmentAsCured(treatmentId: string, curedCount: number) {
    return await smartCloudCall('complete_treatment_as_cured', {
      treatmentId,
      curedCount
    })
  }
  
  /**
   * 标记治疗完成（死亡）
   */
  static async completeTreatmentAsDied(treatmentId: string, diedCount: number, deathDetails: any) {
    return await smartCloudCall('complete_treatment_as_died', {
      treatmentId,
      diedCount,
      deathDetails
    })
  }
  
  // ========== 死亡记录管理 ==========
  
  /**
   * 创建死亡记录
   */
  static async createDeathRecord(data: any) {
    return await smartCloudCall('create_death_record', data)
  }
  
  /**
   * 获取死亡记录列表
   */
  static async listDeathRecords(batchId: string, page = 1, pageSize = 20) {
    return await smartCloudCall('list_death_records', {
      batchId,
      page,
      pageSize
    })
  }
  
  /**
   * 获取死亡统计
   */
  static async getDeathStats(batchId: string) {
    return await smartCloudCall('get_death_stats', {
      batchId
    })
  }
  
  /**
   * 获取死亡记录详情
   */
  static async getDeathRecordDetail(recordId: string) {
    return await smartCloudCall('get_death_record_detail', {
      recordId
    })
  }
}
