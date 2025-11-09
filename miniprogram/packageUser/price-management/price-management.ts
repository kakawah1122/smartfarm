// packageUser/price-management/price-management.ts
/**
 * 鹅价管理页面
 * 
 * 功能特性：
 * 1. 智能去重：同一日期只保留一条记录，新数据自动更新
 * 2. 双模式录入：手动录入 + AI批量识别（Qwen-VL-Max）
 * 3. 批量识别：AI自动提取图片中所有日期的价格数据，一次保存多条记录
 * 4. 历史数据：完整保存90天内所有日期数据，支持趋势分析
 * 5. 数据验证：自动计算平均价、格式化价格区间
 * 
 * v2.0 更新：
 * - 支持从价格表格截图中批量提取多天的数据
 * - 优化AI识别，一次可识别10天以上的历史价格
 * - 批量保存，自动去重，新增/更新混合处理
 */
import Message from 'tdesign-miniprogram/message/index'

interface BaseBreed {
  key: string
  label: string
  range: string
  price: number
}

interface GoslingBreed extends BaseBreed {}

interface MeatBreed extends BaseBreed {}

interface PreviewData {
  date: string
  goslingBreeds: GoslingBreed[]
  meatBreeds: MeatBreed[]
  rawData: any
}

interface BatchPreviewData {
  records: PreviewData[]  // 多条日期记录
  totalCount: number      // 识别到的总记录数
}

interface HistoryItem {
  _id: string
  date: string
  source: string
  updateTime: Date
}

interface ParsedBreedItem {
  key?: string
  label?: string
  min?: number | string
  max?: number | string
  range?: string
  price?: number | string
}

interface ParsedGoosePriceResult {
  date?: string
  goslingBreeds?: ParsedBreedItem[]
  meatBreeds?: ParsedBreedItem[]
  [key: string]: any
}

interface ParsedBatchGoosePriceResult {
  records?: ParsedGoosePriceResult[]  // 多条日期记录
  [key: string]: any
}

const GOOSE_PRICE_SYSTEM_PROMPT =
  '你是一名擅长从价格表截图中提取结构化数据的助手，请严格按照示例JSON输出结果。'

const GOOSE_PRICE_USER_PROMPT = `你是一个专业的价格表格识别助手。请识别图片中的鹅价表格，精确提取**所有日期**的价格信息：

**识别要求：**
1. 提取表格中的**所有日期**及对应的价格数据（不要遗漏任何一行）
2. 对于每个日期，提取：
   - 鹅苗价格（单位：元/只）：
     * 中种鹅：价格区间（如：30-33）
     * 大种鹅：价格区间（如：44-46）
     * 特大种鹅：价格区间（如：48-52）
   - 肉鹅价格（单位：元/斤）：
     * 120日龄：价格区间
     * 130日龄：价格区间
3. 按日期从早到晚排序

**注意事项：**
- 必须提取所有日期的数据，不要遗漏
- 价格区间格式：最低价-最高价
- 如果某个品种或日龄没有数据，可以省略
- 日期格式：YYYY-MM-DD（如：2025-10-30）

**输出格式（严格JSON）：**
\`\`\`json
{
  "records": [
    {
      "date": "2025-10-30",
      "goslingBreeds": [
        {"key": "middle", "label": "中种鹅", "min": 38, "max": 41},
        {"key": "large", "label": "大种鹅", "min": 52, "max": 54},
        {"key": "extraLarge", "label": "特大种鹅", "min": 56, "max": 60}
      ],
      "meatBreeds": [
        {"key": "meat120", "label": "肉鹅120日龄", "min": 18.5, "max": 18.5},
        {"key": "meat130", "label": "肉鹅130日龄", "min": 19.0, "max": 19.0}
      ]
    },
    {
      "date": "2025-10-31",
      "goslingBreeds": [...],
      "meatBreeds": [...]
    }
  ]
}
\`\`\`

请严格按照上述JSON格式输出，records数组中包含所有日期的数据，不要添加任何其他说明文字。`

const RANGE_SPLIT_REGEX = /[-~－—到]/g

function parseFloatOrNull(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null) {
    return null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function extractMinMax(item: ParsedBreedItem): { min: number | null; max: number | null } {
  let min = parseFloatOrNull(item.min as any)
  let max = parseFloatOrNull(item.max as any)

  if ((min === null || max === null) && item.range) {
    const parts = item.range
      .toString()
      .split(RANGE_SPLIT_REGEX)
      .map(part => part.trim())
      .filter(Boolean)
    if (parts.length >= 1) {
      min = parseFloatOrNull(parts[0])
    }
    if (parts.length >= 2) {
      max = parseFloatOrNull(parts[1])
    }
  }

  if ((min === null || max === null) && item.price !== undefined) {
    const priceVal = parseFloatOrNull(item.price as any)
    if (priceVal !== null) {
      min = priceVal
      max = priceVal
    }
  }

  if (min === null && max !== null) {
    min = max
  }
  if (max === null && min !== null) {
    max = min
  }

  return { min, max }
}

function normalizeBreedList(list: ParsedBreedItem[] | undefined): BaseBreed[] {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map((item, index) => {
      const { min, max } = extractMinMax(item)

      if (min === null || max === null) {
        return null
      }

      const minVal = Number(min.toFixed ? min.toFixed(1) : min)
      const maxVal = Number(max.toFixed ? max.toFixed(1) : max)
      const average = Number((((minVal + maxVal) / 2) || 0).toFixed(1))

      const key = item.key || `item_${index}`
      const label = item.label || item.key || `数据${index + 1}`

      return {
        key,
        label,
        range: `${minVal}-${maxVal}`,
        price: average
      }
    })
    .filter((item): item is GoslingBreed => item !== null)
}

function parseGoosePriceContent(content: string): ParsedBatchGoosePriceResult | ParsedGoosePriceResult {
  if (!content) {
    throw new Error('AI未返回识别内容')
  }

  let parsed: any = null
  const trimmed = content.trim()

  const tryParse = (text: string) => {
    try {
      return JSON.parse(text)
    } catch (err) {
      return null
    }
  }

  // 尝试1: 直接解析整个内容
  parsed = tryParse(trimmed)

  // 尝试2: 提取 ```json ... ``` 代码块
  if (!parsed) {
    const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
    if (jsonMatch && jsonMatch[1]) {
      parsed = tryParse(jsonMatch[1])
    }
  }

  // 尝试3: 提取 ``` ... ``` 代码块（可能没有json标记）
  if (!parsed) {
    const codeMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/)
    if (codeMatch && codeMatch[1]) {
      parsed = tryParse(codeMatch[1])
    }
  }

  // 尝试4: 查找第一个完整的JSON对象
  if (!parsed) {
    const objectMatch = trimmed.match(/\{[\s\S]*\}/)
    if (objectMatch && objectMatch[0]) {
      parsed = tryParse(objectMatch[0])
    }
  }

  // 尝试5: 查找第一个 { 到最后一个 }
  if (!parsed) {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = trimmed.substring(firstBrace, lastBrace + 1)
      parsed = tryParse(jsonStr)
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`AI返回内容无法解析为JSON结构。内容长度: ${content.length}字符`)
  }

  // 判断是批量数据还是单条数据
  if (parsed.records && Array.isArray(parsed.records) && parsed.records.length > 0) {
    // 批量数据格式
    parsed.records = parsed.records.map((record: any) => {
      record.date = record.date || new Date().toISOString().split('T')[0]
      record.goslingBreeds = Array.isArray(record.goslingBreeds) ? record.goslingBreeds : []
      record.meatBreeds = Array.isArray(record.meatBreeds) ? record.meatBreeds : []
      return record
    })
    
    // 过滤掉没有数据的记录
    parsed.records = parsed.records.filter((record: any) => 
      (record.goslingBreeds && record.goslingBreeds.length > 0) ||
      (record.meatBreeds && record.meatBreeds.length > 0)
    )
    
    if (parsed.records.length === 0) {
      throw new Error('AI未识别出价格数据，请尝试更清晰的截图')
    }
    
    return parsed as ParsedBatchGoosePriceResult
  } else {
    // 单条数据格式（兼容旧格式）
    parsed.date = parsed.date || new Date().toISOString().split('T')[0]
    parsed.goslingBreeds = Array.isArray(parsed.goslingBreeds) ? parsed.goslingBreeds : []
    parsed.meatBreeds = Array.isArray(parsed.meatBreeds) ? parsed.meatBreeds : []

    if (
      (!parsed.goslingBreeds || parsed.goslingBreeds.length === 0) &&
      (!parsed.meatBreeds || parsed.meatBreeds.length === 0)
    ) {
      throw new Error('AI未识别出价格数据，请尝试更清晰的截图')
    }

    return parsed as ParsedGoosePriceResult
  }
}

function buildPreviewData(parsed: ParsedGoosePriceResult): PreviewData {
  const goslingBreeds = normalizeBreedList(parsed.goslingBreeds) as GoslingBreed[]
  const meatBreeds = normalizeBreedList(parsed.meatBreeds) as MeatBreed[]

  return {
    date: parsed.date || new Date().toISOString().split('T')[0],
    goslingBreeds,
    meatBreeds,
    rawData: parsed
  }
}

function buildBatchPreviewData(parsed: ParsedBatchGoosePriceResult): BatchPreviewData {
  if (!parsed.records || !Array.isArray(parsed.records)) {
    throw new Error('批量数据格式错误')
  }
  
  const records = parsed.records.map((record: ParsedGoosePriceResult) => {
    const goslingBreeds = normalizeBreedList(record.goslingBreeds) as GoslingBreed[]
    const meatBreeds = normalizeBreedList(record.meatBreeds) as MeatBreed[]
    
    return {
      date: record.date || new Date().toISOString().split('T')[0],
      goslingBreeds,
      meatBreeds,
      rawData: record
    }
  })
  
  return {
    records,
    totalCount: records.length
  }
}

Page({
  data: {
    uploadedImage: '',
    recognizing: false,
    historyList: [] as HistoryItem[],
    manualData: {
      date: new Date().toISOString().split('T')[0],
      gosling: {
        middle: { min: '', max: '' },
        large: { min: '', max: '' },
        extraLarge: { min: '', max: '' }
      },
      meat: {
        meat120: { min: '', max: '' },
        meat130: { min: '', max: '' }
      }
    }
  },

  onLoad() {
    this.loadHistory()
  },

  onShow() {
    // 每次显示时刷新历史记录
    this.loadHistory()
  },

  // 日期选择
  onDateChange(e: any) {
    this.setData({
      'manualData.date': e.detail.value
    })
  },

  // 鹅苗最低价输入
  onGoslingMinInput(e: any) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`manualData.gosling.${key}.min`]: e.detail.value
    })
  },

  // 鹅苗最高价输入
  onGoslingMaxInput(e: any) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`manualData.gosling.${key}.max`]: e.detail.value
    })
  },

  // 肉鹅最低价输入
  onMeatMinInput(e: any) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`manualData.meat.${key}.min`]: e.detail.value
    })
  },

  // 肉鹅最高价输入
  onMeatMaxInput(e: any) {
    const { key } = e.currentTarget.dataset
    this.setData({
      [`manualData.meat.${key}.max`]: e.detail.value
    })
  },

  // 提交手动录入数据
  async submitManualData() {
    const { manualData } = this.data

    // 验证数据
    if (!manualData.date) {
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请选择日期'
      })
      return
    }

    // 转换数据格式
    const goslingBreeds: GoslingBreed[] = []
    const meatBreeds: MeatBreed[] = []

    // 处理鹅苗数据
    const goslingKeys = [
      { key: 'middle', label: '中种鹅' },
      { key: 'large', label: '大种鹅' },
      { key: 'extraLarge', label: '特大种鹅' }
    ]

    goslingKeys.forEach(({ key, label }) => {
      const data = manualData.gosling[key as keyof typeof manualData.gosling]
      if (data.min && data.max) {
        const min = parseFloat(data.min)
        const max = parseFloat(data.max)
        const price = ((min + max) / 2).toFixed(1)
        
        goslingBreeds.push({
          key,
          label,
          range: `${min}-${max}`,
          price: parseFloat(price)
        })
      }
    })

    // 处理肉鹅数据
    const meatKeys = [
      { key: 'meat120', label: '肉鹅120日龄' },
      { key: 'meat130', label: '肉鹅130日龄' }
    ]

    meatKeys.forEach(({ key, label }) => {
      const data = manualData.meat[key as keyof typeof manualData.meat]
      if (data.min && data.max) {
        const min = parseFloat(data.min)
        const max = parseFloat(data.max)
        const price = ((min + max) / 2).toFixed(1)
        
        meatBreeds.push({
          key,
          label,
          range: `${min}-${max}`,
          price: parseFloat(price)
        })
      }
    })

    if (goslingBreeds.length === 0 && meatBreeds.length === 0) {
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请至少录入一组价格数据'
      })
      return
    }

    wx.showLoading({ title: '保存中...', mask: true })

    try {
      const db = wx.cloud.database()
      
      // 1. 查询该日期是否已存在记录
      const existingResult = await db.collection('goose_prices')
        .where({
          date: manualData.date
        })
        .get()

      const saveData = {
          date: manualData.date,
          goslingBreeds,
          meatBreeds,
          rawData: { goslingBreeds, meatBreeds },
          source: 'manual',
          operator: wx.getStorageSync('userInfo')?.nickName || '管理员',
          updateTime: db.serverDate()
        }

      if (existingResult.data.length > 0) {
        // 2. 已存在：更新该记录
        const existingId = existingResult.data[0]._id
        await db.collection('goose_prices').doc(existingId).update({
          data: saveData
      })

      wx.hideLoading()
        Message.success({
          context: this,
          offset: [20, 32],
          content: `已更新 ${manualData.date} 的价格数据`,
          duration: 2000
        })
      } else {
        // 3. 不存在：新增记录
        await db.collection('goose_prices').add({
          data: {
            ...saveData,
            createTime: db.serverDate()
          }
        })

        wx.hideLoading()
      Message.success({
        context: this,
        offset: [20, 32],
          content: `已保存 ${manualData.date} 的价格数据`,
        duration: 2000
      })
      }

      // 清空表单
      this.setData({
        manualData: {
          date: new Date().toISOString().split('T')[0],
          gosling: {
            middle: { min: '', max: '' },
            large: { min: '', max: '' },
            extraLarge: { min: '', max: '' }
          },
          meat: {
            meat120: { min: '', max: '' },
            meat130: { min: '', max: '' }
          }
        }
      })

      // 刷新历史记录
      setTimeout(() => {
        this.loadHistory()
      }, 500)

    } catch (error: any) {
      wx.hideLoading()

      Message.error({
        context: this,
        offset: [20, 32],
        content: '保存失败：' + error.message
      })
    }
  },

  // 输入链接变化
  onUrlChange(e: any) {
    this.setData({
      articleUrl: e.detail.value
    })
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          uploadedImage: tempFilePath
        })
        
        Message.success({
          context: this,
          offset: [20, 32],
          content: '图片上传成功'
        })
      },
      fail: (err) => {
        Message.error({
          context: this,
          offset: [20, 32],
          content: '选择图片失败'
        })
      }
    })
  },

  // 清除图片
  clearImage() {
    this.setData({
      uploadedImage: ''
    })
  },

  // 填充表单数据（AI识别成功后调用）
  fillFormData(parsedData: ParsedGoosePriceResult) {
    console.log('=== fillFormData 开始 ===')
    console.log('parsedData:', parsedData)
    
    const formData: any = {
      date: parsedData.date || new Date().toISOString().split('T')[0],
      gosling: {
        middle: { min: '', max: '' },
        large: { min: '', max: '' },
        extraLarge: { min: '', max: '' }
      },
      meat: {
        meat120: { min: '', max: '' },
        meat130: { min: '', max: '' }
      }
    }

    // 填充鹅苗价格
    if (parsedData.goslingBreeds && Array.isArray(parsedData.goslingBreeds)) {
      console.log('处理鹅苗价格，数量:', parsedData.goslingBreeds.length)
      parsedData.goslingBreeds.forEach((breed: ParsedBreedItem) => {
        const { min, max } = extractMinMax(breed)
        console.log(`品种 ${breed.key}: min=${min}, max=${max}`)
        if (min !== null && max !== null) {
          const key = breed.key || ''
          if (key === 'middle' && formData.gosling.middle) {
            formData.gosling.middle = { min: min.toString(), max: max.toString() }
          } else if (key === 'large' && formData.gosling.large) {
            formData.gosling.large = { min: min.toString(), max: max.toString() }
          } else if (key === 'extraLarge' && formData.gosling.extraLarge) {
            formData.gosling.extraLarge = { min: min.toString(), max: max.toString() }
          }
        }
      })
    }

    // 填充肉鹅价格
    if (parsedData.meatBreeds && Array.isArray(parsedData.meatBreeds)) {
      console.log('处理肉鹅价格，数量:', parsedData.meatBreeds.length)
      parsedData.meatBreeds.forEach((breed: ParsedBreedItem) => {
        const { min, max } = extractMinMax(breed)
        console.log(`品种 ${breed.key}: min=${min}, max=${max}`)
        if (min !== null && max !== null) {
          const key = breed.key || ''
          if (key === 'meat120' && formData.meat.meat120) {
            formData.meat.meat120 = { min: min.toString(), max: max.toString() }
          } else if (key === 'meat130' && formData.meat.meat130) {
            formData.meat.meat130 = { min: min.toString(), max: max.toString() }
          }
        }
      })
    }

    console.log('最终 formData:', formData)
    this.setData({ manualData: formData })
    console.log('=== fillFormData 完成 ===')
  },

  // AI识别图片
  async recognizeWithAI() {
    console.log('=== 开始AI识别 ===')
    const { uploadedImage } = this.data
    console.log('uploadedImage:', uploadedImage)

    if (!uploadedImage) {
      console.warn('没有上传图片')
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请先上传截图'
      })
      return
    }

    this.setData({ recognizing: true })
    console.log('设置 recognizing = true')

    try {
      // 先上传图片到云存储
      console.log('开始上传图片到云存储...')
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `goose-price-temp/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`,
        filePath: uploadedImage
      })
      console.log('图片上传成功:', uploadResult.fileID)

      // 调用多模型AI服务进行识别
      console.log('开始调用AI服务...')
      const aiResult: any = await wx.cloud.callFunction({
        name: 'ai-multi-model',
        data: {
          action: 'chat_completion',
          taskType: 'goose_price_ocr',
          messages: [
            {
              role: 'system',
              content: GOOSE_PRICE_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: `${GOOSE_PRICE_USER_PROMPT}\n\n请结合我提供的截图完成识别。`
            }
          ],
          images: [uploadResult.fileID],
          options: {
            temperature: 0,
            maxTokens: 2000  // 增加到2000，给AI更多空间输出
          }
        },
        timeout: 60000  // 微信云函数总超时60秒
      })
      console.log('AI服务调用完成')

      console.log('=== AI识别响应 ===')
      console.log('aiResult:', JSON.stringify(aiResult, null, 2))

      if (!aiResult.result || !aiResult.result.success) {
        console.error('AI识别失败:', aiResult.result)
        throw new Error(aiResult.result?.error || 'AI识别失败')
      }

      const aiContent = aiResult.result.data?.content || aiResult.result.data?.text || ''
      console.log('AI返回内容:', aiContent)
      console.log('内容长度:', aiContent.length)
      
      const parsedGoosePrice = parseGoosePriceContent(aiContent)
      console.log('解析后的数据:', parsedGoosePrice)
      
      // 判断是批量数据还是单条数据
      if ('records' in parsedGoosePrice && parsedGoosePrice.records && parsedGoosePrice.records.length > 0) {
        console.log('识别为批量数据，记录数:', parsedGoosePrice.records.length)
        // 批量数据：填充第一条数据到表单
        const firstRecord = parsedGoosePrice.records[0]
        console.log('第一条记录:', firstRecord)
        this.fillFormData(firstRecord)
      } else {
        console.log('识别为单条数据')
        // 单条数据（兼容旧格式）
        this.fillFormData(parsedGoosePrice as ParsedGoosePriceResult)
      }
      
      this.setData({ recognizing: false })
      console.log('=== AI识别流程结束 ===')
    } catch (error: any) {
      console.error('=== AI识别出错 ===')
      console.error('错误信息:', error)
      console.error('错误堆栈:', error.stack)
      
      this.setData({ recognizing: false })

      Message.error({
        context: this,
        offset: [20, 32],
        content: error.message || 'AI识别失败，请重试或使用手动录入',
        duration: 3000
      })
    }
  },

  // 文章文本输入
  onArticleTextInput(e: any) {
    this.setData({
      articleText: e.detail.value
    })
  },

  // 解析文章文本（已废弃，改用OCR）
  async parseArticleText() {
    const { articleText } = this.data

    if (!articleText) {
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请输入文章内容'
      })
      return
    }

    this.setData({ parsing: true })

    try {
      // 解析文本内容
      const result = this.parseTextContent(articleText)

      if (result.success && result.data) {
        this.setData({
          previewData: result.data,
          parsing: false
        })

        Message.success({
          context: this,
          offset: [20, 32],
          content: '解析成功，请查看预览数据'
        })
      } else {
        throw new Error(result.message || '解析失败')
      }
    } catch (error: any) {
      Message.error({
        context: this,
        offset: [20, 32],
        content: error.message || '解析失败，请检查文本格式'
      })

      this.setData({ parsing: false })
    }
  },

  // 解析文本内容
  parseTextContent(text: string) {
    try {
      // 提取最新日期（找文本中最后一个日期）
      const allDateMatches = text.matchAll(/(\d{1,2})月(\d{1,2})日/g)
      let date = new Date().toISOString().split('T')[0]
      let latestDate: any = null
      
      for (const match of allDateMatches) {
        latestDate = match
      }
      
      if (latestDate) {
        const year = new Date().getFullYear()
        const month = latestDate[1].padStart(2, '0')
        const day = latestDate[2].padStart(2, '0')
        date = `${year}-${month}-${day}`
      }

      const goslingBreeds: GoslingBreed[] = []
      const meatBreeds: MeatBreed[] = []

      // 检查是否包含表头关键词
      const hasGoslingTable = text.includes('中种鹅') || text.includes('大种鹅') || text.includes('特大种鹅')
      const hasMeatTable = text.includes('120日龄') || text.includes('130日龄') || text.includes('肉鹅')

      if (hasGoslingTable) {
        // 解析鹅苗价格表格格式
        // 找到包含表头的部分，确定列的顺序
        const headerMatch = text.match(/中种鹅[\s\S]*?大种鹅[\s\S]*?特大种鹅/)
        
        if (headerMatch) {
          // 找到最后一行数据（最新日期的数据）
          // 格式：11月6日30-3344-4648-52
          const lines = text.split(/[\n\r_]/).filter(line => line.trim())
          
          // 从后往前找第一行包含日期和价格的数据
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i]
            // 匹配格式：月日+三组价格区间
            const rowMatch = line.match(/(\d{1,2})月(\d{1,2})日\s*(\d+)\s*[-~－—]\s*(\d+)\s*(\d+)\s*[-~－—]\s*(\d+)\s*(\d+)\s*[-~－—]\s*(\d+)/)
            
            if (rowMatch) {
              
              // 中种鹅
              goslingBreeds.push({
                key: 'middle',
                label: '中种鹅',
                range: `${rowMatch[3]}-${rowMatch[4]}`,
                price: parseFloat(((parseFloat(rowMatch[3]) + parseFloat(rowMatch[4])) / 2).toFixed(1))
              })
              
              // 大种鹅
              goslingBreeds.push({
                key: 'large',
                label: '大种鹅',
                range: `${rowMatch[5]}-${rowMatch[6]}`,
                price: parseFloat(((parseFloat(rowMatch[5]) + parseFloat(rowMatch[6])) / 2).toFixed(1))
              })
              
              // 特大种鹅
              goslingBreeds.push({
                key: 'extraLarge',
                label: '特大种鹅',
                range: `${rowMatch[7]}-${rowMatch[8]}`,
                price: parseFloat(((parseFloat(rowMatch[7]) + parseFloat(rowMatch[8])) / 2).toFixed(1))
              })
              
              break
            }
          }
        }
      }

      if (hasMeatTable) {
        // 解析肉鹅价格
        // 尝试各种格式
        const patterns = [
          { key: 'meat120', label: '肉鹅120日龄', regex: /(?:肉鹅)?120日?龄?[\\s:：(（]*([\\d.]+)\\s*[-~－—]?\\s*([\\d.]+)?/ },
          { key: 'meat130', label: '肉鹅130日龄', regex: /(?:肉鹅)?130日?龄?[\\s:：(（]*([\\d.]+)\\s*[-~－—]?\\s*([\\d.]+)?/ }
        ]

        patterns.forEach(({ key, label, regex }) => {
          const match = text.match(regex)
          
          if (match) {
            const price1 = parseFloat(match[1])
            const price2 = match[2] ? parseFloat(match[2]) : price1
            const avgPrice = parseFloat(((price1 + price2) / 2).toFixed(1))
            
            meatBreeds.push({
              key,
              label,
              range: price1 === price2 ? `${price1}` : `${price1}-${price2}`,
              price: avgPrice
            })
          }
        })
      }

      if (goslingBreeds.length === 0 && meatBreeds.length === 0) {
        return {
          success: false,
          message: '未能识别出价格数据。请确保复制了完整的表格内容（包含日期和价格）'
        }
      }

      return {
        success: true,
        data: {
          date,
          goslingBreeds,
          meatBreeds,
          rawData: { goslingBreeds, meatBreeds }
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: '解析失败：' + error.message
      }
    }
  },

  // 解析文章（链接方式 - 已弃用）
  async parseArticle() {
    const { articleUrl } = this.data

    if (!articleUrl) {
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请输入文章链接'
      })
      return
    }

    // 验证是否是微信公众号链接
    if (!articleUrl.includes('mp.weixin.qq.com')) {
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请输入有效的微信公众号文章链接'
      })
      return
    }

    this.setData({ parsing: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'parse-wechat-article',
        data: { url: articleUrl }
      })

      const res = result.result as any

      if (res.success && res.data) {
        this.setData({
          previewData: res.data,
          parsing: false
        })

        Message.success({
          context: this,
          offset: [20, 32],
          content: '解析成功，请查看预览数据'
        })
      } else {
        throw new Error(res.message || '解析失败')
      }
    } catch (error: any) {
      Message.error({
        context: this,
        offset: [20, 32],
        content: error.message || '解析失败，请检查链接是否正确'
      })

      this.setData({ parsing: false })
    }
  },


  // 加载历史记录
  async loadHistory() {
    try {
      const db = wx.cloud.database()
      
      // 查询最近90天的历史记录（按日期降序）
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const dateStr = ninetyDaysAgo.toISOString().split('T')[0]
      
      const result = await db.collection('goose_prices')
        .where({
          date: db.command.gte(dateStr)
        })
        .orderBy('date', 'desc')
        .limit(30)
        .get()

      this.setData({
        historyList: result.data.map((item: any) => ({
          _id: item._id,
          date: item.date,
          source: item.source === 'ai_recognition' ? 'AI识别' : item.source === 'manual' ? '手动录入' : '文章解析',
          updateTime: item.updateTime
        }))
      })
    } catch (error) {
      // 加载历史记录失败，静默处理
    }
  },

  // 查看历史记录
  viewHistory(e: any) {
    const { item } = e.currentTarget.dataset
    wx.showModal({
      title: '历史记录',
      content: `日期：${item.date}\n来源：${item.source}\n更新时间：${new Date(item.updateTime).toLocaleString()}`,
      showCancel: false
    })
  }
})

