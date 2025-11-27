import { logger } from '../../utils/logger'
import { safeCloudCall } from '../../utils/safe-cloud-call'
// ai-finance-analysis.ts - AI财务分析组件

// 定义集合名称常量（小程序端不支持require共享配置）
const COLLECTIONS = {
  FINANCE_ANALYSIS_HISTORY: 'finance_analysis_history'
}
interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

Component({
  properties: {
    // 财务数据（从父组件传入）
    financeData: {
      type: Object,
      value: null as unknown
    },
    // 时间范围（可选，可能为 null 或 undefined）
    dateRange: {
      type: Object,
      value: null as unknown
    },
    // 可选：生产数据（如果父组件已加载，直接传入，避免重复调用云函数）
    productionData: {
      type: Object,
      value: null as unknown
    },
    // 可选：健康数据
    healthData: {
      type: Object,
      value: null as unknown
    },
    // 可选：鹅价数据
    goosePriceData: {
      type: Object,
      value: null as unknown
    }
  },

  data: {
    // 加载状态
    loading: false,
    analyzing: false,
    
    // AI分析结果
    analysisResult: null as unknown,
    analysisError: null as string | null,
    
    // 用户自定义分析需求
    customQuery: '',
    
    // 修正分析输入
    refinementQuery: '',
    
    // 输入框动态高度配置
    autosize: {
      minHeight: 80,
      maxHeight: 320
    },
    
    // 分析维度
    analysisDimensions: [
      { key: 'profitability', label: '盈利能力分析', icon: '💰' },
      { key: 'costStructure', label: '成本结构分析', icon: '📊' },
      { key: 'cashFlow', label: '现金流分析', icon: '💵' },
      { key: 'trend', label: '趋势分析', icon: '📈' },
      { key: 'risk', label: '风险评估', icon: '⚠️' },
      { key: 'suggestions', label: '优化建议', icon: '💡' }
    ]
  },

  methods: {
    
    // 保存分析到历史
    async saveToHistory(analysisResult: unknown, customQuery: string = '') {
      try {
        const db = wx.cloud.database()
        const dateRange = this.properties.dateRange
        
        // 使用时间戳而不是db.serverDate()，确保客户端保存后能正确读取
        const now = new Date()
        const createTimeValue = now.getTime() // 毫秒时间戳
        
        await db.collection(COLLECTIONS.FINANCE_ANALYSIS_HISTORY).add({
          data: {
            analysisResult,
            customQuery,
            dateRange,
            dateRangeText: this.getDateRangeText(dateRange),
            createTime: createTimeValue,
            createTimeStr: now.toISOString(), // 备用字符串格式
            financeData: {
              // 保存基本财务数据用于快速预览
              income: this.properties.financeData?.income?.total || 0,
              expense: this.properties.financeData?.expense?.total || 0,
              profit: this.properties.financeData?.profit?.total || 0
            }
          }
        })
        
        // 触发事件通知父组件
        this.triggerEvent('historyAdded')
      } catch (error) {
        logger.warn('保存到历史记录失败:', error)
        // 不影响用户体验，静默失败
      }
    },
    
    // 获取日期范围文本
    getDateRangeText(dateRange: unknown): string {
      const range = dateRange as { start?: string | number; end?: string | number } | null
      if (!range || !range.start || !range.end) {
        return '全部时间'
      }
      
      const start = new Date(range.start).toLocaleDateString('zh-CN')
      const end = new Date(range.end).toLocaleDateString('zh-CN')
      return `${start} - ${end}`
    },
    
    // 收集多模块数据
    // 带超时保护的Promise包装
    withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T, dataSource: string): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => 
          setTimeout(() => {
            logger.warn(`[${dataSource}] 数据收集超时 (${timeoutMs}ms)，使用默认值`)
            resolve(fallback)
          }, timeoutMs)
        )
      ])
    },
    
    async collectAllModuleData() {
      // ⭐ 优先使用props传入的数据，避免重复调用云函数
      const propsProduction = this.properties.productionData
      const propsHealth = this.properties.healthData
      const propsGoosePrice = this.properties.goosePriceData
      
      // 只有当props没有提供时，才按需加载（降级方案）
      // ⚠️ 已移除天气数据：对长期财务分析参考价值不大，季节信息已足够
      const [productionData, healthData, goosePriceData] = await Promise.all([
        propsProduction ? Promise.resolve(propsProduction) : this.withTimeout(this.collectProductionData(), 3000, null, '生产数据'),
        propsHealth ? Promise.resolve(propsHealth) : this.withTimeout(this.collectHealthData(), 2000, null, '健康数据'),
        propsGoosePrice ? Promise.resolve(propsGoosePrice) : this.collectGoosePriceData()
      ])
      
      return {
        production: productionData,
        health: healthData,
        goosePrice: goosePriceData
      }
    },
    
    // 收集生产数据（简化版：仅获取overview，快速模式）
    async collectProductionData() {
      try {
        // 只获取overview数据，快速超时
        const result = await safeCloudCall({
          name: 'production-dashboard',
          data: { action: 'overview' },
          timeout: 4000
        }) as CloudCallResult
        
        if (result?.success) {
          return result.data
        }
      } catch (error) {
        logger.warn('获取生产数据失败:', error)
      }
      return null
    },
    
    // 收集健康数据（简化版：仅获取死亡记录统计）
    async collectHealthData() {
      try {
        const db = wx.cloud.database()
        
        // 只查询死亡记录，限制3条
        const deathRecords = await db.collection('health_death_records')
          .where({
            isDeleted: false
          })
          .orderBy('deathDate', 'desc')
          .limit(3)
          .get()
        
        return {
          recentDeaths: deathRecords.data || [],
          totalDeaths: (deathRecords.data || []).reduce((sum: number, r: unknown) => sum + ((r as { deathCount?: number }).deathCount || 0), 0)
        }
      } catch (error) {
        logger.warn('获取健康数据失败:', error)
      }
      return null
    },
    
    // 收集鹅价数据（优先从全局状态获取，避免重复调用）
    collectGoosePriceData() {
      try {
        // 1. 尝试从全局状态获取（首页可能已加载）
        const app = getApp() as { globalData?: { goosePrice?: unknown } }
        if (app.globalData && app.globalData.goosePrice) {
          return Promise.resolve(app.globalData.goosePrice)
        }
        
        // 2. 尝试从缓存获取
        const cachedPrice = wx.getStorageSync('goose_price_cache')
        if (cachedPrice && cachedPrice.data) {
          return Promise.resolve(cachedPrice.data)
        }
      } catch (error) {
        logger.warn('获取全局/缓存鹅价失败:', error)
      }
      
      // 3. 如果没有数据，返回 null
      return Promise.resolve(null)
    },
    
    // 执行AI财务分析
    async performAnalysis(customQuery?: string) {
      const financeData = this.properties.financeData
      if (!financeData || !financeData.income) {
        wx.showToast({
          title: '财务数据未准备好',
          icon: 'none'
        })
        this.setData({
          loading: false,
          analyzing: false
        })
        return
      }

      // 使用用户自定义查询或默认查询
      const userQuery = customQuery || this.data.customQuery || ''

      this.setData({
        analyzing: true,
        loading: true,
        analysisError: null
      })

      try {
        // 收集所有模块数据
        const moduleData = await this.collectAllModuleData()
        
        // 构建财务分析prompt
        const prompt = this.buildFinanceAnalysisPrompt(financeData, userQuery, moduleData)
        
        // 调用AI多模型服务
        const result = await safeCloudCall({
          name: 'ai-multi-model',
          data: {
            action: 'chat_completion',
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt()
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            taskType: 'financial_analysis',
            priority: 'premium',
            options: {
              temperature: 0.7,
              max_tokens: 1500
            }
          },
          timeout: 55000
        }) as CloudCallResult<{ content: string }>

        if (result?.success && result.data?.content) {
          const aiResponse = result.data.content
          
          // 解析AI返回的结果
          const analysisResult = this.parseAnalysisResult(aiResponse)
          
          this.setData({
            analysisResult,
            analyzing: false,
            loading: false
          })

          // 触发分析完成事件
          this.triggerEvent('analysisComplete', { result: analysisResult })
        } else {
          throw new Error(result?.error || 'AI分析失败')
        }
      } catch (error: unknown) {
        logger.error('AI财务分析失败:', error)
        const errorMsg = (error as Error)?.message || '分析失败，请稍后重试'
        this.setData({
          analysisError: errorMsg,
          analyzing: false,
          loading: false
        })
        
        // 触发分析失败事件
        this.triggerEvent('analysisError', { error: errorMsg })
      }
    },

    // 构建系统提示词
    getSystemPrompt(): string {
      return `你是一位资深的狮头鹅养殖财务分析专家，拥有15年以上养殖场财务管理经验。

【你的专业背景】
- 精通狮头鹅120日龄标准养殖周期的成本核算
- 熟悉广东地区狮头鹅市场价格规律（春节前后高价期、夏季低谷期）
- 掌握批次养殖的资金周转和现金流管理
- 了解养殖场常见疾病（小鹅瘟、禽流感、球虫病等）对成本的影响

【季节性专业知识】
- **冬季（12-2月）**：鹅价最高（春节旺季12.5-15元/斤），保温成本增加15%，是最佳出栏期
- **春季（3-5月）**：气温适宜，成活率高达95%+，是最佳入栏期
- **夏季（6-8月）**：高温应激大，鹅价低谷（9-10元/斤），降温成本增加20%
- **秋季（9-11月）**：育肥黄金期，鹅价回升，食欲旺盛

【核心任务】
基于养殖场的实际财务数据，提供：
1. 精准的财务诊断（不是泛泛而谈）
2. 可立即执行的具体措施（包含数字和时间节点）
3. 针对当前批次的出栏时机建议
4. 基于成本结构的采购优化方案

【输出格式要求】
⭐⭐⭐ 所有字段值必须是纯文本字符串，禁止返回数组或嵌套对象 ⭐⭐⭐

请使用以下JSON格式输出，每个字段的值都是一段完整的中文描述：
{
  "profitability": {
    "summary": "直接给出盈利状况判断和具体数据，例如：当前处于亏损状态，主要原因是...",
    "profitMargin": "给出具体利润率数值和行业对比，例如：当前净利润率为-5%，低于行业平均10%...",
    "efficiency": "给出具体效率指标，例如：饲料转化率2.8:1，略高于标准2.5:1..."
  },
  "costStructure": {
    "summary": "直接分析成本占比，例如：鹅苗成本占67%，为最大支出项...",
    "breakdown": "用文字描述各项成本占比，例如：鹅苗成本5万元(67%)、饲料1万元(13%)、医疗1.2万元(16%)、其他0.3万元(4%)",
    "optimization": "给出具体可节省金额，例如：通过批量采购鹅苗可节省约8%成本，约4000元..."
  },
  "cashFlow": {
    "summary": "分析现金流状况，例如：当前现金流为负，主要因为批次尚未出栏...",
    "incomeFlow": "分析收入来源，例如：预计出栏后可获得收入约X万元...",
    "expenseFlow": "分析日常支出，例如：日均饲料支出约X元，月均固定成本X元...",
    "stability": "分析现金流稳定性，例如：建议保持X万元流动资金应对突发情况..."
  },
  "trend": {
    "summary": "分析整体趋势，例如：成本呈上升趋势，主要受饲料涨价影响...",
    "incomeTrend": "分析收入趋势，例如：随着鹅价季节性上涨，预计收入将增长X%...",
    "expenseTrend": "分析支出趋势，例如：冬季保温成本将增加约X元/天...",
    "profitTrend": "分析利润趋势，例如：若在春节前出栏，预计可实现利润X万元..."
  },
  "risk": {
    "summary": "总体风险评估，例如：当前风险等级中等，主要风险是...",
    "financialRisk": "财务风险分析，例如：现金流紧张，建议预留X万元应急资金...",
    "operationalRisk": "经营风险分析，例如：冬季需防范禽流感，死亡率可能上升X%...",
    "recommendations": "风险控制措施，例如：1.加强疫苗接种；2.储备3周饲料；3.购买养殖保险..."
  },
  "suggestions": {
    "summary": "总结核心建议，例如：当前重点是控制医疗成本和抓住春节高价出栏...",
    "immediate": ["本周内：完成禽流感疫苗补种，预防冬季疫病", "立即：与饲料供应商谈判，争取月结优惠价", "3天内：检查鹅舍保温设施，维修破损处"],
    "shortTerm": ["12月中旬：根据鹅价走势确定第一批出栏时间", "元旦前：联系收购商锁定春节档期订单", "1月：评估是否追加投苗计划"],
    "longTerm": ["春季3月：安排新批次入栏，利用最佳入栏期", "建立3个月饲料价格走势跟踪，择时批量采购", "优化批次安排：春入秋出+秋入春出双周期"],
    "productionAdvice": ["调整饲料配方：当前日龄建议使用育肥料，提高增重速度", "优化密度：当前存栏X只/平方，建议调整至X只/平方", "出栏建议：按当前体重和鹅价，建议在X月X日前完成出栏"]
  }
}

【重要限制】
- 只回答狮头鹅养殖和财务相关问题
- 所有建议必须包含具体数字、时间节点、可操作步骤
- 禁止空泛的通用性建议，必须结合实际数据
- 每条建议都要说明预期效果或节省金额`
    },

    // 获取当前季节信息和未来关键时间节点
    getSeasonInfo(): { season: string; month: number; day: number; seasonDescription: string; breedingAdvice: string; upcomingEvents: string; timelineGuidance: string } {
      const now = new Date()
      const month = now.getMonth() + 1 // 1-12
      const day = now.getDate()
      
      let season = ''
      let seasonDescription = ''
      let breedingAdvice = ''
      let upcomingEvents = ''  // 未来的关键节日和时间节点
      let timelineGuidance = ''  // 时间线指导
      
      if (month >= 3 && month <= 5) {
        season = '春季'
        seasonDescription = '气温逐渐回暖，昼夜温差大，是狮头鹅生长的黄金季节'
        upcomingEvents = `未来3个月关键节点：
- ${month <= 4 ? '清明节（4月初）、劳动节（5月初）' : '端午节（6月初）'}
- 7-8月进入夏季高温期，鹅价下跌`
        timelineGuidance = `当前${month}月，春季已过${month - 3}个月：
${month === 3 ? '- 春季刚开始，是最佳入栏期' : ''}
${month === 4 ? '- 春季中期，3月入栏的批次已养殖1个月' : ''}
${month === 5 ? '- 春季末期，3月入栏的批次已养殖2个月，可在7月夏季前出栏' : ''}
- 建议规避夏季（6-8月）高温期，提前或延后出栏`
        breedingAdvice = `【春季当前策略】
✓ 入栏时机：气温适宜（15-25°C），成活率高，现在入栏可在7-8月前出栏
✓ 防疫重点：加强禽流感等疾病防控
✓ 成本优势：无需额外取暖降温，饲料转化率高`
      } else if (month >= 6 && month <= 8) {
        season = '夏季'
        seasonDescription = '高温高湿，狮头鹅采食量下降，生长速度减缓，需重点防暑'
        upcomingEvents = `未来3个月关键节点：
- 中秋节（9月中旬）、国庆节（10月初）：鹅价回升
- 9-11月秋季是黄金出栏期
- 冬至（12月下旬）：冬补开始，鹅价上涨`
        timelineGuidance = `当前${month}月，夏季高温期：
- 建议减少新入栏，优先处理存栏
- 如现在入栏，4个月后（10-12月）出栏正值秋冬旺季
- 需额外预算15-20%的降温成本`
        breedingAdvice = `【夏季当前策略】
⚠ 谨慎入栏：高温期成活率低，但4个月后正值秋冬旺季
✓ 防暑降温：增加通风、喷雾降温设备
✓ 现有存栏：加快周转，争取在9月秋季前出栏`
      } else if (month >= 9 && month <= 11) {
        season = '秋季'
        seasonDescription = '气温适宜，食欲旺盛，是狮头鹅育肥和出栏的最佳季节'
        
        // 根据具体月份给出不同的未来节点
        if (month === 9) {
          upcomingEvents = `未来3个月关键节点：
- 中秋节（${day <= 15 ? '本月中旬' : '已过'}）、国庆节（${day <= 7 ? '月初' : '已过'}）
- 冬至（12月下旬）：冬补旺季开始
- 春节（次年1-2月）：全年最高价期`
          timelineGuidance = `当前9月初秋：
- 中秋国庆${day <= 7 ? '即将到来' : '已过去'}，现有存栏可${day <= 7 ? '把握' : '错过了'}这波行情
- 建议重点布局春节前出栏：现在入栏 → 次年1-2月春节前出栏（高价期）
- 5-6月入栏的批次（已养120天左右）应抓紧出栏`
        } else if (month === 10) {
          upcomingEvents = `未来3个月关键节点：
- 冬至（12月下旬）：冬补旺季，鹅价上涨
- 春节（次年1-2月）：全年最高价期，鹅价比平时高20-30%
- 元宵节（次年2月中旬）：春节后价格回落`
          timelineGuidance = `当前10月中秋国庆已过：
- 中秋国庆高价期已结束，不要再提这个时间点
- 下一个目标：春节（次年1-2月），还有3-4个月
- 建议：现在入栏的批次正好赶上春节前出栏（最高价期）
- 6-7月入栏的批次（已养120天）应立即出栏，或延迟至12月冬至`
        } else {  // month === 11
          upcomingEvents = `未来3个月关键节点：
- 冬至（12月下旬，约30天后）：冬补旺季开始
- 春节（次年1-2月，约60-90天后）：全年最高价期
- 元宵节（次年2月中旬）：春节后价格回落，需在此前出栏`
          timelineGuidance = `当前11月深秋，中秋国庆已过：
⚠ 重要：中秋国庆在9-10月，现已过去，不要再考虑这些节日
- 当前距离冬至约1个月，距离春节约2-3个月
- 7-8月入栏的批次（已养约120天）应立即出栏或延迟至春节前
- 现在入栏的批次将在次年3月出栏（春节后，价格已回落）
- 建议：现有存栏优先在春节前（1月中旬）出栏，把握全年最高价`
        }
        
        breedingAdvice = `【秋季当前策略】（当前${month}月${day}日）
✓ 出栏时机：${month === 9 && day <= 7 ? '中秋国庆即将到来，符合出栏标准的应立即出栏' : '中秋国庆已过，下一个目标是冬至（12月）和春节（1-2月）'}
✓ 入栏时机：${month <= 9 ? '现在入栏，次年1-2月春节前出栏（最佳）' : '现在入栏，次年3月出栏（春节后价格已降）'}
✓ 育肥策略：秋季采食量大，适合催肥，可延长至130-140日龄等春节
✓ 成本优势：气候适宜，无需额外取暖降温`
      } else {  // 冬季 12-2月
        season = '冬季'
        seasonDescription = '气温低，保温成本高，但冬季鹅价高，是销售的黄金期'
        
        if (month === 12) {
          upcomingEvents = `未来3个月关键节点：
- 冬至（本月下旬，${day <= 22 ? '即将到来' : '已过'}）：冬补旺季
- 春节（次年1-2月）：全年最高价期
- 元宵节（次年2月中旬）：价格回落分界点`
          timelineGuidance = `当前12月，冬季开始：
- 距离春节约1-2个月，这是全年最高价期
- 8-9月入栏的批次（已养120天）应在春节前（1月中旬）出栏
- 现在入栏的批次将在次年4月出栏（春节后，价格已降）
- 建议：所有符合标准的存栏都应在春节前出栏，不要拖到节后`
        } else if (month === 1) {
          upcomingEvents = `未来3个月关键节点：
- 春节（${day <= 15 ? '本月中旬，约' + (15 - day) + '天后' : '已过'}）：全年最高价
- 元宵节（2月中旬）：${day <= 15 ? '价格开始回落' : '春节已过，价格正在回落'}
- 清明节（4月初）：春季开始`
          timelineGuidance = `当前1月，春节${day <= 15 ? '即将到来' : '已过去'}：
${day <= 15 ? '- ⚠️紧急：春节前还有约' + (15 - day) + '天，所有达标存栏应立即出栏' : '- ⚠️春节已过，鹅价正在回落，应尽快出栏止损'}
- 9-10月入栏的批次（已养120天）应${day <= 15 ? '立即出栏抓住春节高价' : '尽快出栏，虽已过春节但仍处旺季尾期'}
- 不建议新入栏：保温成本高，4个月后（5月）出栏正值春夏低价期`
        } else {  // month === 2
          upcomingEvents = `未来3个月关键节点：
- 元宵节（本月中旬，${day <= 15 ? '即将到来' : '已过'}）：春节旺季结束
- 清明节（4月初）：春季开始
- 劳动节（5月初）`
          timelineGuidance = `当前2月，春节${day <= 15 ? '旺季尾期' : '已过，价格回落中'}：
- 春节高价期已${day <= 15 ? '接近尾声' : '结束'}，价格正在回落
- 10-11月入栏的批次（已养120天）应尽快出栏
- 现在入栏的批次将在6月出栏（夏季低价期），不建议
- 建议等3-4月春季再考虑入栏`
        }
        
        breedingAdvice = `【冬季当前策略】（当前${month}月${day}日）
${month === 12 || (month === 1 && day <= 15) ? '✓ 高价出栏期：春节前是全年最高价，所有达标存栏应立即出栏' : '⚠️ 春节已过：价格正在回落，应尽快出栏止损'}
${month === 12 ? '✓ 入栏谨慎：保温成本高10-15%，4个月后（4月）春季价格一般' : '✗ 不建议入栏：保温成本高，4个月后正值春夏低价期'}
✓ 保温管理：增加暖风机、保温灯等设施
✓ 饲料调整：增加能量饲料（玉米），提高抗寒能力`
      }
      
      return { season, month, day, seasonDescription, breedingAdvice, upcomingEvents, timelineGuidance }
    },
    
    // 构建财务分析用户提示词
    buildFinanceAnalysisPrompt(financeData: unknown, customQuery: string = '', moduleData?: unknown): string {
      // 定义财务数据类型
      type FinanceDataType = {
        income?: { total?: number; growth?: number }
        expense?: { total?: number; growth?: number }
        profit?: { total?: number; growth?: number }
        costBreakdown?: { feedCost?: number; goslingCost?: number; medicalCost?: number; otherCost?: number }
        dateRange?: { start?: string | number; end?: string | number }
      }
      // 定义模块数据类型
      type ModuleDataType = {
        production?: {
          entry?: { total?: string | number; stockQuantity?: string | number }
          exit?: { total?: string | number; batches?: string | number; avgWeight?: string | number; totalRevenue?: string | number }
        }
        health?: {
          totalDeaths?: number
          recentDeaths?: Array<{ deathReason?: string }>
        }
        goosePrice?: {
          adult?: number
          gosling?: number
          egg?: number
          trend?: string
          adultTrend?: number
        }
      }
      
      const fd = financeData as FinanceDataType
      const md = moduleData as ModuleDataType | undefined
      const { income, expense, profit, costBreakdown, dateRange } = fd
      
      // 获取当前日期和季节信息
      const now = new Date()
      const currentDate = now.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      })
      const seasonInfo = this.getSeasonInfo()
      
      // 格式化时间范围
      let timeRangeText = '全部时间'
      if (dateRange && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start).toLocaleDateString('zh-CN')
        const end = new Date(dateRange.end).toLocaleDateString('zh-CN')
        timeRangeText = `${start} 至 ${end}`
      }

      // 计算关键财务指标
      const totalIncome = income?.total || 0
      const totalExpense = expense?.total || 0
      const netProfit = profit?.total || 0
      const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0
      
      // 成本分解
      const feedCost = costBreakdown?.feedCost || 0
      const goslingCost = costBreakdown?.goslingCost || 0
      const medicalCost = costBreakdown?.medicalCost || 0
      const otherCost = costBreakdown?.otherCost || 0
      const totalCost = feedCost + goslingCost + medicalCost + otherCost

      // 构建生产数据部分（精简版）
      let productionInfo = ''
      if (md?.production) {
        const prod = md.production
        
        // 适配production-dashboard返回的数据结构
        const entryTotal = parseInt((prod.entry?.total || '0').toString().replace(/,/g, '')) || 0
        const stockQuantity = parseInt((prod.entry?.stockQuantity || '0').toString().replace(/,/g, '')) || 0
        const exitTotal = parseInt((prod.exit?.total || '0').toString().replace(/,/g, '')) || 0
        const exitBatches = parseInt(String(prod.exit?.batches || '0')) || 0
        const exitAvgWeight = parseFloat(String(prod.exit?.avgWeight || '0')) || 0
        const exitRevenue = parseInt((prod.exit?.totalRevenue || '0').toString().replace(/,/g, '')) || 0
        
        // 计算关键指标
        const exitRate = entryTotal > 0 ? ((exitTotal / entryTotal) * 100).toFixed(1) : '0.0'
        const survivalRate = entryTotal > 0 ? (((stockQuantity + exitTotal) / entryTotal) * 100).toFixed(1) : '100.0'
        const avgRevenuePerGoose = exitTotal > 0 ? (exitRevenue / exitTotal).toFixed(2) : 0
        
        // 基于当前鹅价计算预期收入
        const currentPrice = md?.goosePrice?.adult || 12.5
        const expectedRevenue = stockQuantity * exitAvgWeight * currentPrice
        
        productionInfo = `
【生产数据】
存栏：${stockQuantity}只 | 入栏：${entryTotal}只 | 出栏：${exitTotal}只（${exitBatches}批次）
平均重量：${exitAvgWeight}斤 | 出栏率：${exitRate}% | 存活率：${survivalRate}%
出栏收入：¥${(exitRevenue / 10000).toFixed(2)}万 | 单只收益：¥${avgRevenuePerGoose}
预期收入：${stockQuantity}只 × ${exitAvgWeight}斤 × ${currentPrice}元 = ¥${(expectedRevenue / 10000).toFixed(2)}万
`
      }
      
      // 构建健康数据部分
      let healthInfo = ''
      if (md?.health) {
        const health = md.health
        const totalDeaths = health.totalDeaths || 0
        const recentDeaths = health.recentDeaths?.length || 0
        healthInfo = `
【健康与死亡数据】
累计死亡：${totalDeaths}只
最近死亡记录：${recentDeaths}条
主要死因：${health.recentDeaths?.slice(0, 3).map((d) => d.deathReason).join('、') || '暂无'}
`
      }
      
      
      // 构建鹅价数据部分
      let priceInfo = ''
      if (md?.goosePrice) {
        const price = md.goosePrice
        priceInfo = `
【今日鹅价】（重要：用于出栏时机和预期收入计算）
成鹅价格：¥${price.adult}/斤
鹅苗价格：¥${price.gosling}/只
鹅蛋价格：¥${price.egg}/个
价格趋势：${price.trend}（近期${price.adultTrend > 0 ? '上涨' : '下跌'}¥${Math.abs(price.adultTrend)}/斤）
`
      }
      
      return `狮头鹅养殖财务分析（120日龄标准出栏）

【⚠️时间线警告 - 必须严格遵守】
当前日期：${currentDate}（${seasonInfo.month}月${seasonInfo.day}日）
${seasonInfo.timelineGuidance}

${seasonInfo.upcomingEvents}

⭐⭐⭐重要规则：
1. 禁止提及任何"已过去"的节日或时间点（如11月不能再说中秋国庆）
2. 只能基于"未来"的时间节点给建议（如11月应说冬至、春节）
3. 所有建议必须有明确的时间节点（具体月份、日期）
4. 必须计算4个月后是什么季节、什么价格水平

【当前季节】${seasonInfo.season}（${seasonInfo.month}月${seasonInfo.day}日）
${seasonInfo.seasonDescription}
${seasonInfo.breedingAdvice}

【分析时间】${timeRangeText}

【财务数据概览】
总收入：¥${(totalIncome / 10000).toFixed(2)}万元
总支出：¥${(totalExpense / 10000).toFixed(2)}万元
净利润：¥${(netProfit / 10000).toFixed(2)}万元
利润率：${profitMargin}%

【成本结构明细】
饲料成本：¥${(feedCost / 10000).toFixed(2)}万元，占比：${totalCost > 0 ? ((feedCost / totalCost) * 100).toFixed(2) : 0}%
鹅苗成本：¥${(goslingCost / 10000).toFixed(2)}万元，占比：${totalCost > 0 ? ((goslingCost / totalCost) * 100).toFixed(2) : 0}%
医疗费用：¥${(medicalCost / 10000).toFixed(2)}万元，占比：${totalCost > 0 ? ((medicalCost / totalCost) * 100).toFixed(2) : 0}%
其他费用：¥${(otherCost / 10000).toFixed(2)}万元，占比：${totalCost > 0 ? ((otherCost / totalCost) * 100).toFixed(2) : 0}%
${productionInfo}${healthInfo}${priceInfo}
【财务趋势】
收入增长率：${income?.growth || 0}%
支出增长率：${expense?.growth || 0}%
利润增长率：${profit?.growth || 0}%

【分析要求】基于当前时间点（${seasonInfo.season}${seasonInfo.month}月${seasonInfo.day}日）和实际数据：
- 存栏${md?.production ? parseInt((md.production.entry?.stockQuantity || '0').toString().replace(/,/g, '')) : 'X'}只
- 出栏${md?.production ? parseInt((md.production.exit?.total || '0').toString().replace(/,/g, '')) : 'X'}只，平均${md?.production?.exit?.avgWeight || 'X'}斤
- 当前鹅价${md?.goosePrice?.adult || 12.5}元/斤
- 死亡${md?.health?.totalDeaths || 'X'}只，医疗费用占比${totalCost > 0 ? ((medicalCost / totalCost) * 100).toFixed(1) : '?'}%
- 当前季节特点：${seasonInfo.seasonDescription}

必须遵守的时间线原则：
${seasonInfo.month === 11 ? `
⚠️ 11月的建议必须面向未来：
- ✗ 错误示例："把握中秋国庆黄金期"（已过去）
- ✓ 正确示例："距离春节还有2-3个月，现有存栏应在1月中旬前出栏，把握全年最高价"
- ✓ 正确示例："7-8月入栏的批次已养约120天，建议立即出栏或延迟至春节前"
- ✓ 正确示例："现在入栏的批次将在次年3月出栏（春节后价格已降），不建议"
` : ''}
${seasonInfo.month === 10 ? '⚠️ 10月：中秋国庆已过，不要再提。重点是冬至（12月）和春节（1-2月）' : ''}
${seasonInfo.month === 12 || seasonInfo.month === 1 ? '⚠️ 春节是全年最高价期，所有建议围绕"春节前出栏"展开' : ''}

分析维度：
1. 盈利能力：结合当前${seasonInfo.month}月的季节性价格水平
2. 成本结构：饲料（60-70%）、鹅苗、医疗，考虑${seasonInfo.season}的额外成本
3. 现金流：基于未来节日预测收入节奏
4. 趋势：识别季节性波动
5. 风险：${seasonInfo.season}特有风险

优化建议（必须包含具体时间节点和计算）：
- 立即执行：针对当前${seasonInfo.month}月，给出具体日期的出栏建议（例如"12月20日前""春节前15天"）
- 短期（未来3个月）：基于上述【未来3个月关键节点】给出批次规划
- 长期（未来12个月）：按春夏秋冬四季规划入栏出栏节奏
- 生产管理：计算"4个月后"是什么季节，价格如何，是否值得入栏
- 季节策略：必须基于【时间线指导】，所有建议都要有"几月几号""还有X天""X个月后"等明确时间

${customQuery ? `\n【用户自定义分析需求】\n用户希望重点关注：${customQuery}\n\n请根据用户的特定需求，在以上分析基础上，重点深入分析用户关注的问题，并提供针对性的建议。` : ''}

请确保分析专业、深入、有针对性，并给出可操作的生产管理建议。`
    },

    // 解析AI返回的分析结果
    parseAnalysisResult(aiResponse: string): unknown {
      try {
        // 尝试解析JSON格式
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const jsonStr = jsonMatch[0]
          const parsed = JSON.parse(jsonStr)
          
          // 深度转换对象为字符串的函数
          const deepConvertToString = (value: unknown, depth: number = 0): unknown => {
            // 防止无限递归
            if (depth > 10) {
              return String(value)
            }
            
            if (value === null || value === undefined) {
              return ''
            }
            
            if (typeof value === 'string') {
              return value
            }
            
            if (typeof value === 'number' || typeof value === 'boolean') {
              return String(value)
            }
            
            if (Array.isArray(value)) {
              // 数组保持原样，但确保数组元素是字符串
              return value.map(item => {
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                  // 对象元素转为可读字符串
                  return JSON.stringify(item)
                }
                return String(item)
              })
            }
            
            if (typeof value === 'object') {
              // 对象转为格式化的多行字符串
              const entries = Object.entries(value)
              if (entries.length === 0) {
                return ''
              }
              
              // 格式化为易读的字符串
              const lines = entries.map(([k, v]) => {
                const formattedValue = deepConvertToString(v, depth + 1)
                return `${k}：${formattedValue}`
              })
              
              // 使用分号分隔而不是换行符，这样在页面上能正确显示
              return lines.join('；')
            }
            
            return String(value)
          }
          
          // 格式化成本分解对象
          const formatCostBreakdown = (breakdown: unknown): string => {
            if (typeof breakdown === 'string') {
              return breakdown
            }
            if (typeof breakdown !== 'object' || breakdown === null) {
              return String(breakdown || '')
            }
            
            // 字段名映射（包含更多可能的字段）
            const fieldMap: unknown = {
              feedCostPercentage: '饯料成本占比',
              feedCost: '饯料成本',
              feedPercentage: '饯料占比',
              gooseChickCostPercentage: '鹅苗成本占比',
              gooseChickCost: '鹅苗成本',
              goslingCostPercentage: '鹅苗成本占比',
              goslingCost: '鹅苗成本',
              goslingPercentage: '鹅苗占比',
              medicalCostPercentage: '医疗费用占比',
              medicalCost: '医疗费用',
              medicalPercentage: '医疗占比',
              otherCostPercentage: '其他费用占比',
              otherCost: '其他费用',
              otherPercentage: '其他占比',
              采购策略和疾病防控: '采购策略和疾病防控',
              percentage: '占比',
              amount: '金额',
              category: '类别',
              item: '项目'
            }
            
            // 如果是数组，直接转换为字符串
            if (Array.isArray(breakdown)) {
              return breakdown.map((item, index) => {
                if (typeof item === 'object' && item !== null) {
                  // 如果数组元素是对象，格式化每个对象
                  const formattedFields = Object.entries(item).map(([k, v]) => {
                    const label = fieldMap[k] || k  // 使用字段映射
                    let value = v
                    // 格式化值
                    if (typeof v === 'number') {
                      if (k.toLowerCase().includes('percentage') || k.toLowerCase().includes('percent')) {
                        value = v.toFixed(2) + '%'
                      } else if (k.toLowerCase().includes('amount') && v > 1000) {
                        value = '¥' + (v / 10000).toFixed(2) + '万'
                      } else if (k.toLowerCase().includes('amount')) {
                        value = '¥' + v.toFixed(0)
                      } else {
                        value = v.toFixed(2)
                      }
                    }
                    return `${label}：${value}`
                  }).join('，')
                  return `${index + 1}. ${formattedFields}`
                }
                return `${index + 1}. ${String(item)}`
              }).join('；')
            }
            
            const lines: string[] = []
            for (const [key, value] of Object.entries(breakdown)) {
              const label = fieldMap[key] || key
              
              // 智能格式化值
              let val = ''
              if (typeof value === 'number') {
                // 判断是百分比还是金额
                if (key.toLowerCase().includes('percentage') || key.toLowerCase().includes('percent')) {
                  val = value.toFixed(2) + '%'
                } else if (value > 1000) {
                  val = '¥' + (value / 10000).toFixed(2) + '万'
                } else {
                  val = value.toFixed(2)
                }
              } else if (typeof value === 'object' && value !== null) {
                // 如果值还是对象，递归处理
                val = String(deepConvertToString(value, 1))
              } else {
                val = String(value || '')
              }
              
              lines.push(`${label}：${val}`)
            }
            
            return lines.join('；')
          }
          
          // 递归处理整个结果对象，确保所有值字段都是字符串
          const formatObject = (obj: unknown, depth: number = 0): unknown => {
            if (depth > 10 || typeof obj !== 'object' || obj === null) {
              return obj
            }
            
            if (Array.isArray(obj)) {
              // 保持数组结构，但确保内容是字符串
              return obj.map(item => {
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                  return formatObject(item, depth + 1)
                }
                return String(item)
              })
            }
            
            const result: { success?: boolean; data?: unknown; error?: string } = {}
            for (const [key, value] of Object.entries(obj)) {
              if (Array.isArray(value)) {
                // 数组特殊处理（如suggestions的各个数组）
                result[key] = value.map(item => String(item))
              } else if (typeof value === 'object' && value !== null) {
                // 嵌套对象：转换所有子字段为字符串
                const subObj: unknown = {}
                for (const [subKey, subValue] of Object.entries(value)) {
                  // 特殊处理breakdown字段
                  if (subKey === 'breakdown') {
                    // breakdown字段总是格式化为字符串
                    if (typeof subValue === 'string') {
                      subObj[subKey] = subValue
                    } else if (typeof subValue === 'object' && subValue !== null) {
                      subObj[subKey] = formatCostBreakdown(subValue)
                    } else {
                      subObj[subKey] = String(subValue || '')
                    }
                  } else if (Array.isArray(subValue)) {
                    subObj[subKey] = subValue.map(item => String(item))
                  } else if (typeof subValue === 'object' && subValue !== null) {
                    // 深层嵌套对象转为字符串
                    subObj[subKey] = deepConvertToString(subValue, depth + 1)
                  } else {
                    subObj[subKey] = String(subValue || '')
                  }
                }
                result[key] = subObj
              } else {
                // 基本类型直接转字符串
                result[key] = String(value || '')
              }
            }
            return result
          }
          
          const formatted = formatObject(parsed)
          return formatted
        }
      } catch (error) {
        logger.warn('JSON解析失败，使用文本格式:', error)
      }

      // 如果JSON解析失败，返回文本格式
      return {
        rawText: aiResponse,
        format: 'text'
      }
    },

    // 手动触发分析
    triggerAnalysis() {
      // 检查用户是否输入了自定义分析需求
      const userQuery = (this.data.customQuery || '').trim()
      
      if (userQuery) {
        // 如果用户输入了文字，按用户要求分析
        this.performAnalysis(userQuery)
      } else {
        // 如果没有输入文字，进行全面的多维度分析
        this.performAnalysis('')
      }
    },

    // 重新分析
    retryAnalysis() {
      this.setData({
        analysisResult: null,
        analysisError: null,
        customQuery: ''
      })
      this.performAnalysis()
    },

    // 输入框内容变化
    onQueryInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
      this.setData({
        customQuery: e.detail.value || ''
      })
    },

    // 清除分析结果
    clearAnalysis() {
      this.setData({
        analysisResult: null,
        analysisError: null,
        customQuery: '',
        refinementQuery: ''
      })
    },
    
    // 分析归档
    async archiveAnalysis() {
      const { analysisResult, customQuery } = this.data
      
      if (!analysisResult) {
        wx.showToast({
          title: '没有可归档的分析结果',
          icon: 'none'
        })
        return
      }
      
      wx.showLoading({
        title: '归档中...',
        mask: true
      })
      
      try {
        // 保存到历史记录
        await this.saveToHistory(analysisResult, customQuery)
        
        // 先隐藏loading再显示toast
        wx.hideLoading()
        wx.showToast({
          title: '归档成功',
          icon: 'success'
        })
        
        // 触发事件通知父组件刷新历史
        this.triggerEvent('historyAdded')
        
        // 清空当前分析结果
        this.setData({
          analysisResult: null,
          analysisError: null,
          customQuery: '',
          refinementQuery: ''
        })
        
      } catch (error) {
        logger.error('归档失败:', error)
        wx.hideLoading()
        wx.showToast({
          title: '归档失败',
          icon: 'none'
        })
      }
    },
    
    // 修正输入变化
    onRefinementInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
      this.setData({
        refinementQuery: e.detail.value || ''
      })
    },
    
    // 修正分析
    async refineAnalysis() {
      const query = this.data.refinementQuery.trim()
      if (!query) {
        wx.showToast({
          title: '请输入修正变量',
          icon: 'none'
        })
        return
      }
      
      // 使用修正查询重新分析
      await this.performAnalysis(query)
      
      // 清空修正输入框
      this.setData({
        refinementQuery: ''
      })
    }
  }
})

