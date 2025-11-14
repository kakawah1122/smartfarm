// survival-analysis.ts - 存活率分析页面
import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'

type DateRange = 'week' | 'month' | 'quarter' | 'year'

interface SurvivalOverview {
  currentRate: number
  previousRate: number
  trend: 'improving' | 'declining' | 'steady'
  trendValue: number
  totalAnimals: number
  survivedAnimals: number
}

interface StageAnalysisItem {
  stage: string
  rate: number
  total: number
  survived: number
  color?: string
}

interface TrendDataItem {
  date: string
  rate: number
}

interface FactorAnalysisItem {
  name: string
  impact: 'high' | 'medium' | 'low'
  value: number
  correlation: number
}

interface ComparisonData {
  industryAverage: number
  lastYear: number
  target: number
  bestPractice: number
}

interface ExportPayload {
  overview: SurvivalOverview
  stageAnalysis: StageAnalysisItem[]
  trendData: TrendDataItem[]
  factors: FactorAnalysisItem[]
}

interface SurvivalAnalysisResponse {
  overview?: SurvivalOverview
  stageAnalysis?: StageAnalysisItem[]
  trendData?: TrendDataItem[]
  factors?: FactorAnalysisItem[]
  comparison?: ComparisonData
}

type SurvivalAnalysisData = {
  loading: boolean
  dateRange: DateRange
  overview: SurvivalOverview
  stageAnalysis: StageAnalysisItem[]
  trendData: TrendDataItem[]
  factors: FactorAnalysisItem[]
  comparison: ComparisonData
}

type SurvivalAnalysisCustom = {
  loadAnalysisData: () => Promise<void>
  onDateRangeChange: (event: WechatMiniprogram.PickerChange) => void
  onStageDetail: (event: WechatMiniprogram.TouchEvent<{ stage: StageAnalysisItem }>) => void
  exportReport: () => Promise<void>
}

type SurvivalAnalysisPageInstance = WechatMiniprogram.Page.Instance<SurvivalAnalysisData, SurvivalAnalysisCustom>

const defaultData: SurvivalAnalysisData = {
  loading: false,
  dateRange: 'month',
  overview: {
    currentRate: 99.6,
    previousRate: 99.2,
    trend: 'improving',
    trendValue: 0.4,
    totalAnimals: 2340,
    survivedAnimals: 2330
  },
  stageAnalysis: [
    { stage: '育雏期', rate: 97.2, total: 800, survived: 778, color: '#0052D9' },
    { stage: '成长期', rate: 98.8, total: 900, survived: 889, color: '#00A870' },
    { stage: '全周期', rate: 99.6, total: 2340, survived: 2330, color: '#E37318' }
  ],
  trendData: [
    { date: '第1周', rate: 98.5 },
    { date: '第2周', rate: 98.8 },
    { date: '第3周', rate: 99.1 },
    { date: '第4周', rate: 99.4 },
    { date: '本周', rate: 99.6 }
  ],
  factors: [
    { name: '防疫用药', impact: 'high', value: 96.8, correlation: 0.85 },
    { name: '环境消毒频率', impact: 'medium', value: 12, correlation: 0.73 },
    { name: '饲料质量', impact: 'high', value: 95, correlation: 0.79 },
    { name: '密度控制', impact: 'medium', value: 88, correlation: 0.65 }
  ],
  comparison: {
    industryAverage: 97.5,
    lastYear: 98.8,
    target: 99.0,
    bestPractice: 99.8
  }
}

const pageConfig: WechatMiniprogram.Page.Options<SurvivalAnalysisData, SurvivalAnalysisCustom> = {
  data: defaultData,

  onLoad() {
    void this.loadAnalysisData()
  },

  async loadAnalysisData() {
    const page = this as SurvivalAnalysisPageInstance
    page.setData({ loading: true })

    const response = await CloudApi.callFunction<SurvivalAnalysisResponse>(
      'health-management',
      {
        action: 'get_survival_analysis',
        dateRange: page.data.dateRange
      },
      {
        loading: true,
        loadingText: '加载存活率数据...',
        showError: false
      }
    )

    if (response.success) {
      const data = response.data || {}
      page.setData({
        overview: data.overview ?? defaultData.overview,
        stageAnalysis: data.stageAnalysis ?? defaultData.stageAnalysis,
        trendData: data.trendData ?? defaultData.trendData,
        factors: data.factors ?? defaultData.factors,
        comparison: data.comparison ?? defaultData.comparison,
        loading: false
      })
    } else {
      wx.showToast({
        title: response.error || '加载数据失败',
        icon: 'none'
      })
      page.setData({ loading: false })
    }
  },

  onDateRangeChange(event) {
    const page = this as SurvivalAnalysisPageInstance
    const value = event.detail.value as DateRange
    page.setData({ dateRange: value })
    void page.loadAnalysisData()
  },

  onStageDetail(event) {
    const { stage } = event.currentTarget.dataset as { stage: StageAnalysisItem }

    if (!stage) {
      return
    }

    wx.showModal({
      title: `${stage.stage}详细数据`,
      content: `存活率: ${stage.rate}%\n总数: ${stage.total}只\n存活: ${stage.survived}只\n死亡: ${stage.total - stage.survived}只`,
      showCancel: false
    })
  },

  async exportReport() {
    const page = this as SurvivalAnalysisPageInstance

    const response = await CloudApi.callFunction(
      'health-management',
      {
        action: 'export_survival_report',
        dateRange: page.data.dateRange,
        data: {
          overview: page.data.overview,
          stageAnalysis: page.data.stageAnalysis,
          trendData: page.data.trendData,
          factors: page.data.factors
        } as ExportPayload
      },
      {
        loading: true,
        loadingText: '生成报告中...',
        showError: false,
        showSuccess: true,
        successText: '报告已生成'
      }
    )

    if (!response.success) {
      wx.showToast({
        title: response.error || '导出失败',
        icon: 'none'
      })
    }
  }
}

Page(createPageWithNavbar(pageConfig))
