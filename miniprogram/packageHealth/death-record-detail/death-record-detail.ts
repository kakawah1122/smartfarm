import { createPageWithNavbar } from '../../utils/navigation'
import { HealthCloud } from '../../utils/cloud-functions'
import { logger } from '../../utils/logger'
import { formatDateTime } from '../../utils/health-utils'
import type {
  DeathRecord,
  AutopsyFindingsNormalized,
  DiagnosisResult,
  AnyObject
} from '../types/death-record'
import { ensureArray, resolveTempFileURLs } from '../utils/data-utils'
// miniprogram/packageHealth/death-record-detail/death-record-detail.ts

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

type CorrectionPayload = CorrectionForm & { isConfirmed?: boolean }

type PageData = {
  loading: boolean
  recordId: string
  record: DeathRecord
  diagnosisResult: DiagnosisResult
  primaryResult: string | null
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
  goBack: () => void
}

type PageInstance = WechatMiniprogram.Page.Instance<PageData, PageCustom>

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

const normalizeAutopsyFindings = (raw: unknown): AutopsyFindingsNormalized | null => {
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
  diagnosisResult: {} as DiagnosisResult,
  primaryResult: null,
  differentialList: [],
  preventionList: [],
  hasStructuredAutopsyFindings: false,
  showCorrectionDialog: false,
  originalCause: '',
  correctionForm: initialCorrectionForm,
  ratingHints: ['很不准确', '不太准确', '基本准确', '比较准确', '非常准确']
}

const pageConfig: WechatMiniprogram.Page.Options<PageData, PageCustom> & {
  _timerIds: number[]
  _safeSetTimeout: (callback: () => void, delay: number) => number
  _clearAllTimers: () => void
} = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },
  
  data: initialPageData,

  onLoad(options: LoadOptions) {
    const page = this as PageInstance

    if (options.id) {
      page.setData({ recordId: options.id })
      void page.loadRecordDetail(options.id)
    } else {
      wx.showToast({ title: '记录ID缺失', icon: 'none' })
      this._safeSetTimeout(() => wx.navigateBack(), 1500)
    }
  },

  onUnload() {
    this._clearAllTimers()
  },

  async loadRecordDetail(recordId: string) {
    const page = this as PageInstance
    page.setData({ loading: true })

    try {
      wx.showLoading({ title: '加载记录详情...' })
      
      const response = await HealthCloud.death.getDetail({ recordId })
      
      wx.hideLoading()

      if (!response.success || !response.data) {
        throw new Error(response.error || '加载失败')
      }

      const record = response.data

      let diagnosisResultData: DiagnosisResult = {} as DiagnosisResult
      const rawDiagnosis = record.diagnosisResult

      if (typeof rawDiagnosis === 'string') {
        try {
          diagnosisResultData = JSON.parse(rawDiagnosis) as DiagnosisResult
        } catch (parseError) {
          logger.warn('诊断结果解析失败，使用空对象:', parseError)
          diagnosisResultData = {} as DiagnosisResult
        }
      } else if (rawDiagnosis && typeof rawDiagnosis === 'object') {
        diagnosisResultData = rawDiagnosis as DiagnosisResult
      }

      const processedImages = await resolveTempFileURLs(ensureArray<string>(record.autopsyImages))

      const displayDeathCause = record.isCorrected && record.correctedCause
        ? record.correctedCause
        : record.deathCause || '未知死因'

      const normalizedAutopsyFindings = normalizeAutopsyFindings(record.autopsyFindings)

      // 处理成本分解数据（直接使用云函数计算好的数据）
      let costBreakdown = null
      const financialLossAny = record.financialLoss as unknown
      if (financialLossAny?.costBreakdown) {
        const breakdown = financialLossAny.costBreakdown
        
        // ✅ 优先使用云函数计算好的每只成本
        if (breakdown.entryUnitCost && breakdown.breedingCost !== undefined) {
          costBreakdown = {
            entryUnitCost: breakdown.entryUnitCost,
            breedingCost: breakdown.breedingCost,
            preventionCost: breakdown.preventionCost || '0.00',
            treatmentCost: breakdown.treatmentCost || '0.00'
          }
        } else {
          // ⚠️ 向后兼容：旧数据需要前端计算
          const deathCount = record.deathCount || 1
          const unitCostNum = parseFloat(String(record.unitCost || 40))
          const batchInitialQuantity = parseFloat(breakdown.entryCostTotal || breakdown.entryCost || 0) > 0 
            ? Math.round(parseFloat(breakdown.entryCostTotal || breakdown.entryCost) / unitCostNum)
            : deathCount
          const currentCount = batchInitialQuantity - (record.totalDeathCount || 0) || deathCount

          const entryUnitCost = parseFloat(breakdown.entryCostTotal || breakdown.entryCost || 0) / batchInitialQuantity
          const breedingCost = parseFloat(breakdown.materialCostTotal || breakdown.materialCost || 0) / currentCount
          const preventionCost = parseFloat(breakdown.preventionCostTotal || breakdown.preventionCost || 0) / currentCount
          const treatmentCost = parseFloat(breakdown.treatmentCostTotal || breakdown.treatmentCost || 0) / currentCount

          costBreakdown = {
            entryUnitCost: formatCurrency(entryUnitCost),
            breedingCost: formatCurrency(breedingCost),
            preventionCost: formatCurrency(preventionCost),
            treatmentCost: formatCurrency(treatmentCost)
          }
        }
      }

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
        diagnosisResultData.primaryCause || diagnosisResultData.primaryDiagnosis || null
      const differentialListRaw = ensureArray<AnyObject>(diagnosisResultData.differentialCauses)
      const differentialList =
        differentialListRaw.length > 0
          ? differentialListRaw
          : ensureArray<AnyObject>(diagnosisResultData.differentialDiagnosis)
      const preventionListRaw = ensureArray<string>(diagnosisResultData.preventionAdvice)
      const preventionList =
        preventionListRaw.length > 0
          ? preventionListRaw
          : ensureArray<string>(diagnosisResultData.preventionMeasures)

      page.setData({
        record: {
          ...record,
          diagnosisResult: diagnosisResultData,
          autopsyImages: processedImages,
          autopsyFindings: normalizedAutopsyFindings,
          displayDeathCause,
          displayFindings,
          unitCostDisplay: formatCurrency(record.unitCost),
          breedingCostDisplay: formatCurrency(record.breedingCost),
          treatmentCostDisplay: formatCurrency(record.treatmentCost),
          financeLossDisplay: formatCurrency(record.financeLoss),
          correctedAt: record.correctedAt ? formatDateTime(record.correctedAt) : record.correctedAt,
          costBreakdown: costBreakdown
        } as unknown,
        diagnosisResult: diagnosisResultData,
        primaryResult,
        differentialList,
        preventionList,
        hasStructuredAutopsyFindings: Boolean(normalizedAutopsyFindings),
        loading: false
      })
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '加载失败',
        icon: 'none'
      })
      page.setData({ loading: false })
    }
  },

  goBack() {
    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: '/pages/index/index' })
        }
      })
    } else {
      wx.switchTab({ url: '/pages/index/index' })
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

    wx.showLoading({ title: '提交中...' })
    
    const response = await HealthCloud.death.correctDiagnosis({
      recordId: page.data.recordId,
      correctedCause: data.correctedCause,
      correctionReason: data.veterinarianDiagnosis,
      aiAccuracyRating: data.aiAccuracyRating,
      isConfirmed: data.isConfirmed || false
    })
    
    wx.hideLoading()

    if (response.success) {
      wx.showToast({ title: '提交成功', icon: 'success' })

      page.setData({ showCorrectionDialog: false })

      setTimeout(() => {
        void page.loadRecordDetail(page.data.recordId)
      }, 1000)
    } else {
      wx.showToast({
        title: response.error || '提交失败',
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

Page(createPageWithNavbar(pageConfig))

