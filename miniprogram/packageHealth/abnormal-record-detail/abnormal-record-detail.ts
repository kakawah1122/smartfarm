import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'
import type { AbnormalRecord, AbnormalDiagnosisDetails } from '../types/abnormal'
import { ensureArray, resolveTempFileURLs } from '../utils/data-utils'
// miniprogram/packageHealth/abnormal-record-detail/abnormal-record-detail.ts

type ConfirmDeathOptions = {
  returnBehavior?: 'detail' | 'back'
}

interface CorrectionForm {
  correctedDiagnosis: string
  veterinarianDiagnosis: string
  aiAccuracyRating: number
}

interface AbnormalDetailData {
  loading: boolean
  recordId: string
  record: AbnormalRecord | null
  isAutopsyRecord: boolean
  showCorrectionDialog: boolean
  originalDiagnosis: string
  correctionForm: CorrectionForm
  ratingHints: string[]
}

interface PreviewDataset {
  url: string
}

interface RatingDataset {
  rating?: number | string
}

type AbnormalDetailPageInstance = WechatMiniprogram.Page.Instance<AbnormalDetailData, AbnormalDetailPageCustom>

type AbnormalDetailPageCustom = {
  loadRecordDetail: (recordId: string) => Promise<void>
  preventMove: () => void
  previewImage: (event: WechatMiniprogram.TouchEvent<PreviewDataset>) => void
  correctDiagnosis: () => void
  onSubmitCorrection: () => Promise<void>
  onCancelCorrection: () => void
  onCorrectedDiagnosisChange: (event: WechatMiniprogram.Input) => void
  onVeterinarianDiagnosisChange: (event: WechatMiniprogram.Input) => void
  onRatingChange: (event: WechatMiniprogram.TouchEvent<RatingDataset>) => void
  createTreatmentPlan: () => void
  confirmDeath: (options?: ConfirmDeathOptions) => Promise<void>
}

const initialCorrectionForm: CorrectionForm = {
  correctedDiagnosis: '',
  veterinarianDiagnosis: '',
  aiAccuracyRating: 0
}

const initialData: AbnormalDetailData = {
  loading: true,
  recordId: '',
  record: null,
  isAutopsyRecord: false,
  showCorrectionDialog: false,
  originalDiagnosis: '',
  correctionForm: initialCorrectionForm,
  ratingHints: ['很不准确', '不太准确', '基本准确', '比较准确', '非常准确']
}

const normalizeRecommendation = (recommendation: unknown): AbnormalDiagnosisDetails | string | null => {
  if (!recommendation) {
    return null
  }

  if (typeof recommendation === 'string') {
    try {
      return JSON.parse(recommendation) as AbnormalDiagnosisDetails
    } catch (error) {
      logger.warn('AI 建议解析失败，使用原始文本:', recommendation)
      return recommendation
    }
  }

  if (typeof recommendation === 'object') {
    return recommendation as AbnormalDiagnosisDetails
  }

  return null
}

const deriveDiagnosisType = (record: AbnormalRecord): AbnormalRecord['diagnosisType'] => {
  if (record.diagnosisType) {
    return record.diagnosisType
  }

  if (record.autopsyDescription || record.totalDeathCount || record.deathCount) {
    return 'autopsy_analysis'
  }

  return 'live_diagnosis'
}

const pageConfig: WechatMiniprogram.Page.Options<AbnormalDetailData, AbnormalDetailPageCustom> = {
  data: initialData,

  onLoad(options: Record<string, string>) {
    const page = this as AbnormalDetailPageInstance

    if (options.id) {
      page.setData({ recordId: options.id })
      void page.loadRecordDetail(options.id)
    } else {
      wx.showToast({ title: '记录ID缺失', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  async loadRecordDetail(recordId: string) {
    const page = this as AbnormalDetailPageInstance
    page.setData({ loading: true })

    try {
      const response = await CloudApi.callFunction<AbnormalRecord>(
        'health-management',
        {
          action: 'get_abnormal_record_detail',
          recordId
        },
        {
          loading: true,
          loadingText: '加载记录详情...',
          showError: false
        }
      )

      if (!response.success || !response.data) {
        throw new Error(response.error || '加载失败')
      }

      const record = response.data

      const aiRecommendation = normalizeRecommendation(record.aiRecommendation)

      const processedImages = await resolveTempFileURLs(ensureArray<string>(record.images))

      const derivedDiagnosisType = deriveDiagnosisType(record)

      page.setData({
        record: {
          ...record,
          aiRecommendation: aiRecommendation ?? record.aiRecommendation,
          images: processedImages,
          diagnosisType: derivedDiagnosisType
        },
        isAutopsyRecord: derivedDiagnosisType === 'autopsy_analysis',
        loading: false
      })
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '加载失败',
        icon: 'none'
      })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  /**
   * 阻止事件冒泡
   */
  preventMove() {
    // 空方法，用于阻止事件冒泡
  },

  previewImage(event: WechatMiniprogram.TouchEvent<PreviewDataset>) {
    const page = this as AbnormalDetailPageInstance
    const { url } = event.currentTarget.dataset as PreviewDataset
    const images = ensureArray(page.data.record?.images)

    if (!url || images.length === 0) {
      return
    }

    wx.previewImage({
      current: url,
      urls: images
    })
  },

  /**
   * 修正诊断结果 - 显示修正弹窗
   */
  correctDiagnosis() {
    const page = this as AbnormalDetailPageInstance
    const record = page.data.record

    if (!record) {
      return
    }

    const currentDiagnosis = record.diagnosis || '待诊断'

    if (record.isCorrected) {
      page.setData({
        showCorrectionDialog: true,
        originalDiagnosis: currentDiagnosis,
        correctionForm: {
          correctedDiagnosis: record.correctedDiagnosis || '',
          veterinarianDiagnosis: record.correctionReason || '',
          aiAccuracyRating: record.aiAccuracyRating || 3
        }
      })
    } else {
      page.setData({
        showCorrectionDialog: true,
        originalDiagnosis: currentDiagnosis,
        correctionForm: {
          correctedDiagnosis: '',
          veterinarianDiagnosis: '',
          aiAccuracyRating: 3
        }
      })
    }
  },

  /**
   * 取消修正
   */
  onCancelCorrection() {
    this.setData({ showCorrectionDialog: false })
  },

  /**
   * 提交修正
   */
  async onSubmitCorrection() {
    const page = this as AbnormalDetailPageInstance
    const form = page.data.correctionForm
    const record = page.data.record

    if (!record) {
      return
    }

    if (!form.correctedDiagnosis) {
      wx.showToast({ title: '请输入修正后的诊断', icon: 'none' })
      return
    }
    if (!form.veterinarianDiagnosis) {
      wx.showToast({ title: '请输入兽医诊断', icon: 'none' })
      return
    }
    if (form.aiAccuracyRating === 0) {
      wx.showToast({ title: '请对AI准确性进行评分', icon: 'none' })
      return
    }

    const response = await CloudApi.callFunction(
      'health-management',
      {
        action: 'correct_abnormal_diagnosis',
        recordId: record._id,
        correctedDiagnosis: form.correctedDiagnosis,
        veterinarianDiagnosis: form.veterinarianDiagnosis,
        aiAccuracyRating: form.aiAccuracyRating
      },
      {
        loading: true,
        loadingText: '提交中...',
        showError: false
      }
    )

    if (response.success) {
      wx.showToast({ title: '修正成功', icon: 'success', duration: 1500 })

      page.setData({ showCorrectionDialog: false })

      if (page.data.isAutopsyRecord) {
        setTimeout(() => {
          void page.confirmDeath({ returnBehavior: 'back' })
        }, 800)
      } else {
        setTimeout(() => {
          void page.loadRecordDetail(page.data.recordId)
        }, 1000)
      }
    } else {
      wx.showToast({
        title: response.error || '提交失败',
        icon: 'none'
      })
    }
  },

  /**
   * 表单输入处理
   */
  onCorrectedDiagnosisChange(event: WechatMiniprogram.Input) {
    const value = event.detail.value
    this.setData({
      'correctionForm.correctedDiagnosis': value
    })
  },

  onVeterinarianDiagnosisChange(event: WechatMiniprogram.Input) {
    const value = event.detail.value
    this.setData({
      'correctionForm.veterinarianDiagnosis': value
    })
  },

  onRatingChange(event: WechatMiniprogram.TouchEvent<RatingDataset>) {
    const ratingRaw = event.currentTarget.dataset.rating
    const rating = typeof ratingRaw === 'string' ? Number(ratingRaw) : Number(ratingRaw || 0)
    this.setData({
      'correctionForm.aiAccuracyRating': rating
    })
  },

  /**
   * 创建治疗方案 - 直接跳转到治疗记录页面
   */
  createTreatmentPlan() {
    const page = this as AbnormalDetailPageInstance
    const record = page.data.record

    if (!record) {
      return
    }

    if (page.data.isAutopsyRecord) {
      wx.showToast({ title: '死因剖析记录无需制定治疗方案', icon: 'none' })
      return
    }

    const finalDiagnosis = record.isCorrected && record.correctedDiagnosis
      ? record.correctedDiagnosis
      : record.diagnosis

    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?abnormalRecordId=${record._id}&batchId=${record.batchId}&diagnosis=${encodeURIComponent(finalDiagnosis)}`
    })
  },

  /**
   * 死因剖析：确认死亡并归档
   */
  async confirmDeath(options?: ConfirmDeathOptions) {
    const { record, isAutopsyRecord } = this.data

    const returnBehavior = options?.returnBehavior || 'detail'

    if (!record) return

    if (!isAutopsyRecord) {
      // 病鹅诊断不支持直接归档
      wx.showToast({ title: '请通过治疗流程处理该记录', icon: 'none' })
      return
    }

    const deathCount = record.totalDeathCount || record.deathCount || record.affectedCount || 0

    if (deathCount <= 0) {
      wx.showToast({ title: '请先在诊断中填写死亡数量', icon: 'none' })
      return
    }

    const response = await CloudApi.callFunction<{ deathRecordId?: string }>(
      'health-management',
      {
        action: 'create_death_record_with_finance',
        diagnosisId: record.diagnosisId,
        batchId: record.batchId,
        deathCount,
        deathCause: record.diagnosis || '待确定',
        deathCategory: 'disease',
        autopsyFindings: record.autopsyDescription || record.symptoms || '',
        diagnosisResult: record.diagnosisDetails || null,
        images: ensureArray(record.images)
      },
      {
        loading: true,
        loadingText: '归档中...',
        showError: false
      }
    )

    if (response.success) {
      const deathRecordId = response.data?.deathRecordId

        wx.showToast({
          title: '已归档至死亡记录',
          icon: 'success',
          duration: 1500
        })

        setTimeout(() => {
          if (returnBehavior === 'back') {
            const pages = getCurrentPages()
            if (pages.length > 1) {
              wx.navigateBack({
                delta: 1,
                fail: () => {
                  wx.redirectTo({
                    url: '/packageHealth/death-records-list/death-records-list',
                    fail: () => {
                      wx.switchTab({ url: '/pages/index/index' })
                    }
                  })
                }
              })
            } else {
              wx.redirectTo({
                url: '/packageHealth/death-records-list/death-records-list',
                fail: () => {
                  wx.switchTab({ url: '/pages/index/index' })
                }
              })
            }
          } else if (deathRecordId) {
            wx.redirectTo({
              url: `/packageHealth/death-records-list/death-records-list?recordId=${encodeURIComponent(deathRecordId)}`
            })
          } else {
            wx.redirectTo({
              url: '/packageHealth/death-records-list/death-records-list'
            })
          }
        }, 1500)
    } else {
      logger.error('确认死亡归档失败:', response.error)
      wx.showToast({
        title: response.error || '归档失败，请重试',
        icon: 'none'
      })
    }
  }
}

Page(createPageWithNavbar(pageConfig))
