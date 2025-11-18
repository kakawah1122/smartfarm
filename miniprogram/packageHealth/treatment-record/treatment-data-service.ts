/**
 * 治疗记录数据服务模块
 * 负责处理治疗记录相关的数据获取和管理
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * 治疗记录接口
 */
export interface TreatmentRecord {
  _id: string
  treatmentId?: string
  batchId: string
  animalIds: string[]
  symptoms: string
  diagnosis: string
  treatmentPlan: string
  medications: MedicationRecord[]
  veterinarianName: string
  veterinarianContact: string
  treatmentDate: string
  status: 'ongoing' | 'completed' | 'cancelled'
  notes?: string
  createTime: Date
  updateTime: Date
}

/**
 * 用药记录接口
 */
export interface MedicationRecord {
  medicineId: string
  medicineName: string
  dosage: string
  frequency: string
  duration: number
  quantity: number
  unit: string
  purpose?: string
}

/**
 * 治疗进度接口
 */
export interface TreatmentProgress {
  date: string
  description: string
  operator: string
  status: string
  images?: string[]
}

/**
 * 治疗数据服务类
 */
export class TreatmentDataService {
  private static cache = new Map<string, any>()
  private static cacheTime = 5 * 60 * 1000 // 5分钟缓存

  /**
   * 获取治疗记录详情
   */
  static async getTreatmentDetail(treatmentId: string): Promise<TreatmentRecord | null> {
    const cacheKey = `treatment_${treatmentId}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_treatment_record_detail',
          treatmentId: treatmentId
        }
      })

      if (result.result?.success) {
        const data = result.result.data as TreatmentRecord
        this.setCache(cacheKey, data)
        return data
      }

      return null
    } catch (error) {
      console.error('获取治疗记录详情失败:', error)
      return null
    }
  }

  /**
   * 获取进行中的治疗记录列表
   */
  static async getOngoingTreatments(batchId?: string): Promise<TreatmentRecord[]> {
    const cacheKey = `ongoing_treatments_${batchId || 'all'}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_ongoing_treatments',
          batchId: batchId
        }
      })

      if (result.result?.success) {
        const data = result.result.data || []
        this.setCache(cacheKey, data)
        return data
      }

      return []
    } catch (error) {
      console.error('获取进行中治疗记录失败:', error)
      return []
    }
  }

  /**
   * 创建治疗记录
   */
  static async createTreatmentRecord(data: Partial<TreatmentRecord>): Promise<any> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_treatment_record',
          ...data
        }
      })

      if (result.result?.success) {
        // 清除相关缓存
        this.clearRelatedCache('treatment_')
        this.clearRelatedCache('ongoing_treatments_')
        return result.result
      }

      throw new Error(result.result?.error || '创建失败')
    } catch (error) {
      console.error('创建治疗记录失败:', error)
      throw error
    }
  }

  /**
   * 更新治疗记录
   */
  static async updateTreatmentRecord(treatmentId: string, updates: Partial<TreatmentRecord>): Promise<any> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_treatment_record',
          treatmentId: treatmentId,
          ...updates
        }
      })

      if (result.result?.success) {
        // 清除缓存
        this.clearCache(`treatment_${treatmentId}`)
        this.clearRelatedCache('ongoing_treatments_')
        return result.result
      }

      throw new Error(result.result?.error || '更新失败')
    } catch (error) {
      console.error('更新治疗记录失败:', error)
      throw error
    }
  }

  /**
   * 添加治疗进度
   */
  static async addTreatmentProgress(treatmentId: string, progress: TreatmentProgress): Promise<any> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_treatment_progress',
          treatmentId: treatmentId,
          progress: progress
        }
      })

      if (result.result?.success) {
        // 清除缓存
        this.clearCache(`treatment_${treatmentId}`)
        return result.result
      }

      throw new Error(result.result?.error || '添加进度失败')
    } catch (error) {
      console.error('添加治疗进度失败:', error)
      throw error
    }
  }

  /**
   * 添加治疗笔记
   */
  static async addTreatmentNote(treatmentId: string, note: string): Promise<any> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'add_treatment_note',
          treatmentId: treatmentId,
          note: note
        }
      })

      if (result.result?.success) {
        // 清除缓存
        this.clearCache(`treatment_${treatmentId}`)
        return result.result
      }

      throw new Error(result.result?.error || '添加笔记失败')
    } catch (error) {
      console.error('添加治疗笔记失败:', error)
      throw error
    }
  }

  /**
   * 添加用药记录
   */
  static async addMedicationRecord(treatmentId: string, medication: MedicationRecord): Promise<any> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'add_treatment_medication',
          treatmentId: treatmentId,
          medication: medication
        }
      })

      if (result.result?.success) {
        // 清除缓存
        this.clearCache(`treatment_${treatmentId}`)
        return result.result
      }

      throw new Error(result.result?.error || '添加用药记录失败')
    } catch (error) {
      console.error('添加用药记录失败:', error)
      throw error
    }
  }

  /**
   * 完成治疗（标记为已治愈）
   */
  static async completeTreatmentAsCured(treatmentId: string, finalNote?: string): Promise<any> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'complete_treatment_as_cured',
          treatmentId: treatmentId,
          finalNote: finalNote
        }
      })

      if (result.result?.success) {
        // 清除所有相关缓存
        this.clearCache(`treatment_${treatmentId}`)
        this.clearRelatedCache('ongoing_treatments_')
        return result.result
      }

      throw new Error(result.result?.error || '完成治疗失败')
    } catch (error) {
      console.error('完成治疗失败:', error)
      throw error
    }
  }

  /**
   * 获取可用药品列表
   */
  static async getAvailableMedicines(): Promise<any[]> {
    const cacheKey = 'available_medicines'
    const cached = this.getCache(cacheKey)
    if (cached) return cached

    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          type: 'medicine'
        }
      })

      if (result.result?.success) {
        const data = result.result.data || []
        this.setCache(cacheKey, data, 30 * 60 * 1000) // 30分钟缓存
        return data
      }

      return []
    } catch (error) {
      console.error('获取可用药品列表失败:', error)
      return []
    }
  }

  /**
   * 设置缓存
   */
  private static setCache(key: string, data: any, expireTime?: number): void {
    const expire = expireTime || this.cacheTime
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      expire: expire
    })
  }

  /**
   * 获取缓存
   */
  private static getCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && cached.timestamp && cached.data) {
      if (Date.now() - cached.timestamp < cached.expire) {
        return cached.data
      }
      this.cache.delete(key)
    }
    return null
  }

  /**
   * 清除指定缓存
   */
  private static clearCache(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清除相关缓存
   */
  private static clearRelatedCache(prefix: string): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * 清除所有缓存
   */
  static clearAllCache(): void {
    this.cache.clear()
  }
}
