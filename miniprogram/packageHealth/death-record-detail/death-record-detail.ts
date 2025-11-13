import { logger } from '../../utils/logger'
import { formatDateTime } from '../../utils/health-utils'
// miniprogram/packageHealth/death-record-detail/death-record-detail.ts

type AnyObject = Record<string, any>

interface AutopsyFindingsNormalized {
  abnormalities: string[]
  description?: string
}

interface DeathRecord {
  _id: string
  batchId: string
  batchNumber: string
  deathDate: string
  deathCount: number
  deathCause: string
  financeLoss?: number | string
  unitCost?: number | string
  breedingCost?: number | string
  treatmentCost?: number | string
  source?: string // ✅ 来源标识：'treatment' 治疗记录 | 'ai_diagnosis' AI死因剖析
  aiDiagnosisId: string
  diagnosisResult: AnyObject
  autopsyImages?: string[]
  autopsyFindings?: AutopsyFindingsNormalized | string | null
  isCorrected: boolean
  correctedCause?: string
  correctionReason?: string
  correctionType?: string
  aiAccuracyRating?: number
  veterinarianNote?: string
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
  description?: string
  symptomsText?: string
  displayDeathCause?: string
  displayFindings?: string
  unitCostDisplay?: string
  breedingCostDisplay?: string
  treatmentCostDisplay?: string
  financeLossDisplay?: string
}

interface CorrectionForm {
  correctedCause: string
  veterinarianDiagnosis: string
  aiAccuracyRating: number
}

interface PreviewDataset {
  index: number
}

interface RatingDataset {
  rating?: number | string
}

interface LoadOptions {
  id?: string
}

interface CloudFunctionSuccess<T> {
  success: true
  data: T
}

interface CloudFunctionFailure {
  success: false
  error?: string
}

type DeathRecordResponse = CloudFunctionSuccess<DeathRecord> | CloudFunctionFailure

type CorrectionPayload = CorrectionForm & { isConfirmed?: boolean }

type PageData = {
  loading: boolean
  recordId: string
  record: DeathRecord
  diagnosisResult: AnyObject
  primaryResult: AnyObject | null
  differentialList: AnyObject[]
  preventionList: string[]
  hasStructuredAutopsyFindings: boolean
  showCorrectionDialog: boolean
  originalCause: string
  correctionForm: CorrectionForm
  ratingHints: string[]
}

type PageCustom = {
  loadRecordDetail: (recordId: string) => Promise<void>
  onPreviewImage: (event: WechatMiniprogram.TouchEvent<PreviewDataset>) => void
  onCorrectDiagnosis: () => void
  onConfirmDiagnosis: () => Promise<void>
  onReCorrect: () => void
  onSubmitCorrection: () => Promise<void>
  submitCorrection: (data: CorrectionPayload) => Promise<void>
  onCancelCorrection: () => void
  onCorrectedCauseChange: (event: WechatMiniprogram.Input) => void
  onVeterinarianDiagnosisChange: (event: WechatMiniprogram.Input) => void
  onRatingChange: (event: WechatMiniprogram.TouchEvent<RatingDataset>) => void
}

type PageInstance = WechatMiniprogram.Page.Instance<PageData, PageCustom>

const ensureArray = <T>(value: T | T[] | undefined): T[] => (Array.isArray(value) ? value : [])

const formatCurrency = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '0.00'
  }

  const numeric = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return '0.00'
  }

  return numeric.toFixed(2)
}

const normalizeAutopsyFindings = (raw: any): AutopsyFindingsNormalized | null => {
  if (!raw) {
    return null
  }

  if (typeof raw === 'string') {
    const description = raw.trim()
    return description ? { abnormalities: [], description } : null
  }

  if (typeof raw === 'object') {
    const abnormalities = ensureArray<string>(raw.abnormalities)
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)

    const description = typeof raw.description === 'string' ? raw.description.trim() : ''

    if (!abnormalities.length && !description) {
      return null
    }

    return {
      abnormalities,
      ...(description ? { description } : {})
    }
  }

  return null
}

const initialCorrectionForm: CorrectionForm = {
  correctedCause: '',
  veterinarianDiagnosis: '',
  aiAccuracyRating: 0
}

const initialPageData: PageData = {
  loading: true,
  recordId: '',
  record: {} as DeathRecord,
  diagnosisResult: {},
  primaryResult: null,
  differentialList: [],
  preventionList: [],
  hasStructuredAutopsyFindings: false,
  showCorrectionDialog: false,
  originalCause: '',
  correctionForm: initialCorrectionForm,
  ratingHints: ['很不准确', '不太准确', '基本准确', '比较准确', '非常准确']
}

const pageConfig: WechatMiniprogram.Page.Options<PageData, PageCustom> = {
  data: initialPageData,

  onLoad(options: LoadOptions) {
    const page = this as PageInstance

    if (options.id) {
      page.setData({ recordId: options.id })
      void page.loadRecordDetail(options.id)
    } else {
      wx.showToast({ title: '记录ID缺失', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  async loadRecordDetail(recordId: string) {
    const page = this as PageInstance
    page.setData({ loading: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_death_record_detail',
          recordId
        }
      })

      const response = result.result as DeathRecordResponse | undefined

      if (response && response.success) {
        const record = response.data

        let diagnosisResult = record.diagnosisResult
        if (typeof diagnosisResult === 'string') {
          try {
            diagnosisResult = JSON.parse(diagnosisResult)
          } catch (error) {
            diagnosisResult = {}
          }
        }

        let processedImages = record.autopsyImages || []
        processedImages = processedImages.filter((url): url is string => Boolean(url) && typeof url === 'string')

        if (processedImages.length > 0) {
          try {
            const tempUrlResult = await wx.cloud.getTempFileURL({
              fileList: processedImages
            })

            if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
              processedImages = tempUrlResult.fileList
                .map((item: { tempFileURL?: string; fileID?: string }) => item.tempFileURL || item.fileID)
                .filter((url: string | undefined): url is string => Boolean(url) && typeof url === 'string')
            }
          } catch (urlError) {
            logger.warn('剖检图片URL转换失败，使用原始URL:', urlError)
          }
        }

        const displayDeathCause = record.isCorrected && record.correctedCause
          ? record.correctedCause
          : record.deathCause || '未知死因'

        const normalizedAutopsyFindings = normalizeAutopsyFindings(record.autopsyFindings)

        const meaningfulTexts: string[] = []
        const pushIfMeaningful = (text?: string) => {
          if (!text) {
            return
          }
          const trimmed = text.trim()
          if (!trimmed || trimmed === '无明显生前症状') {
            return
          }
          meaningfulTexts.push(trimmed)
        }

        if (normalizedAutopsyFindings) {
          if (normalizedAutopsyFindings.abnormalities.length > 0) {
            pushIfMeaningful(normalizedAutopsyFindings.abnormalities.join('、'))
          }
          pushIfMeaningful(normalizedAutopsyFindings.description)
        }

        pushIfMeaningful(record.description)
        pushIfMeaningful(record.symptomsText)

        const displayFindings = meaningfulTexts
          .filter((value, index, self) => self.indexOf(value) === index)
          .join('；')

        const primaryResult =
          (diagnosisResult && (diagnosisResult.primaryCause || diagnosisResult.primaryDiagnosis)) || null
        const differentialListRaw = ensureArray(diagnosisResult && diagnosisResult.differentialCauses)
        const differentialList =
          differentialListRaw.length > 0
            ? differentialListRaw
            : ensureArray(diagnosisResult && diagnosisResult.differentialDiagnosis)
        const preventionListRaw = ensureArray(diagnosisResult && diagnosisResult.preventionAdvice)
        const preventionList =
          preventionListRaw.length > 0
            ? preventionListRaw
            : ensureArray(diagnosisResult && diagnosisResult.preventionMeasures)

        page.setData({
          record: {
            ...record,
            autopsyImages: processedImages,
            autopsyFindings: normalizedAutopsyFindings,
            displayDeathCause,
            displayFindings,
            unitCostDisplay: formatCurrency(record.unitCost),
            breedingCostDisplay: formatCurrency(record.breedingCost),
            treatmentCostDisplay: formatCurrency(record.treatmentCost),
            financeLossDisplay: formatCurrency(record.financeLoss),
            correctedAt: record.correctedAt ? formatDateTime(record.correctedAt) : record.correctedAt
          },
          diagnosisResult: diagnosisResult || {},
          primaryResult,
          differentialList,
          preventionList,
          hasStructuredAutopsyFindings: Boolean(normalizedAutopsyFindings),
          loading: false
        })
      } else {
        throw new Error(response?.error || result.errMsg || '加载失败')
      }
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '加载失败',
        icon: 'none'
      })
      page.setData({ loading: false })
    }
  },

  onPreviewImage(event) {
    const page = this as PageInstance
    const { index } = event.currentTarget.dataset as PreviewDataset
    const images = page.data.record.autopsyImages || []

    if (typeof index !== 'number' || !images[index]) {
      return
    }

    wx.previewImage({
      current: images[index],
      urls: images
    })
  },

  onCorrectDiagnosis() {
    const page = this as PageInstance
    const currentCause = page.data.record.deathCause || ''

    page.setData({
      showCorrectionDialog: true,
      originalCause: currentCause,
      correctionForm: {
        correctedCause: '',
        veterinarianDiagnosis: '',
        aiAccuracyRating: 3
      }
    })
  },

  async onConfirmDiagnosis() {
    const page = this as PageInstance

    wx.showModal({
      title: '确认诊断',
      content: '确认AI诊断结果准确无误？此操作将标记为"已确认"。',
      success: async res => {
        if (res.confirm) {
          await page.submitCorrection({
            correctedCause: page.data.record.deathCause,
            veterinarianDiagnosis: '确认AI诊断准确',
            aiAccuracyRating: 5,
            isConfirmed: true
          })
        }
      }
    })
  },

  onReCorrect() {
    const page = this as PageInstance
    const currentCause = page.data.record.deathCause || ''

    page.setData({
      showCorrectionDialog: true,
      originalCause: currentCause,
      correctionForm: {
        correctedCause: page.data.record.correctedCause || '',
        veterinarianDiagnosis: page.data.record.correctionReason || '',
        aiAccuracyRating: page.data.record.aiAccuracyRating || 3
      }
    })
  },

  async onSubmitCorrection() {
    const page = this as PageInstance
    const form = page.data.correctionForm

    if (!form.correctedCause) {
      wx.showToast({ title: '请输入修正后的死因', icon: 'none' })
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

    await page.submitCorrection(form)
  },

  async submitCorrection(data) {
    const page = this as PageInstance
    wx.showLoading({ title: '提交中...', mask: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'correct_death_diagnosis',
          recordId: page.data.recordId,
          correctedCause: data.correctedCause,
          correctionReason: data.veterinarianDiagnosis,
          aiAccuracyRating: data.aiAccuracyRating,
          isConfirmed: data.isConfirmed || false
        }
      })

      const response = result.result as { success?: boolean; error?: string } | undefined

      if (response && response.success) {
        wx.hideLoading()
        wx.showToast({ title: '提交成功', icon: 'success' })

        page.setData({ showCorrectionDialog: false })

        setTimeout(() => {
          void page.loadRecordDetail(page.data.recordId)
        }, 1000)
      } else {
        throw new Error(response?.error || result.errMsg || '提交失败')
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: (error as Error).message || '提交失败',
        icon: 'none'
      })
    }
  },

  onCancelCorrection() {
    const page = this as PageInstance
    page.setData({ showCorrectionDialog: false })
  },

  onCorrectedCauseChange(event) {
    const page = this as PageInstance
    page.setData({
      'correctionForm.correctedCause': event.detail.value
    })
  },

  onVeterinarianDiagnosisChange(event) {
    const page = this as PageInstance
    page.setData({
      'correctionForm.veterinarianDiagnosis': event.detail.value
    })
  },

  onRatingChange(event) {
    const page = this as PageInstance
    const ratingRaw = event.currentTarget.dataset.rating
    const rating = typeof ratingRaw === 'string' ? Number(ratingRaw) : ratingRaw || 0

    page.setData({
      'correctionForm.aiAccuracyRating': rating || 0
    })
  }
}

Page(pageConfig)

