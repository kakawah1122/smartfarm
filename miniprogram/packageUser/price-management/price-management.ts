// packageUser/price-management/price-management.ts
/**
 * 鹅价管理页面
 * 
 * 功能特性：
 * 1. 智能去重：同一日期只保留一条记录，新数据自动更新
 * 2. 双模式录入：手动录入 + AI批量识别（Qwen-VL-Max）
 * 3. 批量识别：AI自动提取图片中所有日期的价格数据，一次保存多条记录
 * 4. 历史数据：完整保存90天内所有日期数据，支持趋势分析
 * 5. 数据验证：格式化价格区间
 * 
 * v2.0 更新：
 * - 支持从价格表格截图中批量提取多天的数据
 * - 优化AI识别，一次可识别10天以上的历史价格
 * - 批量保存，自动去重，新增/更新混合处理
 */

interface BaseBreed {
  key: string
  label: string
  range: string
  min: number
  max: number
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
  goslingBreeds?: BaseBreed[]
  meatBreeds?: BaseBreed[]
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

const GOOSE_PRICE_USER_PROMPT = `识别表格中的鹅价信息，**只提取最新日期（最后一行）的价格数据**：

**输出格式（纯JSON，无其他文字）：**
    {
  "date": "2025-11-09",
      "goslingBreeds": [
    {"key": "middle", "min": 24, "max": 27},
    {"key": "large", "min": 38, "max": 40},
    {"key": "extraLarge", "min": 42, "max": 46}
      ],
      "meatBreeds": [
    {"key": "meat120", "min": 16.5, "max": 16.5},
    {"key": "meat130", "min": 17, "max": 17}
      ]
}

**要求：**
1. 只提取最新日期（表格最后一行）
2. 日期格式：YYYY-MM-DD
3. 鹅苗价格3项：中种鹅(middle)、大种鹅(large)、特大种鹅(extraLarge)
4. 肉鹅价格2项：120日龄(meat120)、130日龄(meat130)
5. 价格单位：鹅苗(元/只)、肉鹅(元/斤)
6. 直接输出JSON，不要markdown代码块`

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

      const key = item.key || `item_${index}`
      const label = item.label || item.key || `数据${index + 1}`

      return {
        key,
        label,
        range: `${minVal}-${maxVal}`,
        min: minVal,
        max: maxVal
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
    uploadedImageUrl: '',
    uploadedImageFileID: '',
    recognizing: false,
    scrollViewHeight: 0, // 动态计算的滚动容器高度
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
    },
    // 弹窗相关
    showDetailPopup: false,
    selectedDate: '',
    selectedDateRecords: [] as any[]
  },

  onLoad() {
    this.loadHistory()
    // 动态计算 scroll-view 高度
    this.calculateScrollHeight()
  },

  // 计算滚动容器高度
  calculateScrollHeight() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const statusBarHeight = systemInfo.statusBarHeight || 44
      const navbarHeight = 88 // 导航栏高度
      const safeAreaTop = 16 // 安全间距
      const windowHeight = systemInfo.windowHeight
      
      // 计算可用高度
      const availableHeight = windowHeight - statusBarHeight - navbarHeight - safeAreaTop
      
      // 设置 scroll-view 高度（单位：px）
      this.setData({
        scrollViewHeight: availableHeight
      })
    } catch (error) {
      // 计算滚动高度失败，静默处理
    }
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
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请选择日期'
      })
      }
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
        
        goslingBreeds.push({
          key,
          label,
          range: `${min}-${max}`,
          min,
          max
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
        
        meatBreeds.push({
          key,
          label,
          range: `${min}-${max}`,
          min,
          max
        })
      }
    })

    if (goslingBreeds.length === 0 && meatBreeds.length === 0) {
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请至少录入一组价格数据'
      })
      }
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
      const message = this.getMessage()
      if (message) {
        message.success({
          offset: [20, 32],
          content: `已更新 ${manualData.date} 的价格数据`,
          duration: 2000
        })
      }
      } else {
        // 3. 不存在：新增记录
        await db.collection('goose_prices').add({
          data: {
            ...saveData,
            createTime: db.serverDate()
          }
        })

        wx.hideLoading()
        const message = this.getMessage()
        if (message) {
          message.success({
        offset: [20, 32],
          content: `已保存 ${manualData.date} 的价格数据`,
        duration: 2000
      })
        }
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
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: '保存失败：' + error.message
      })
      }
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
      sizeType: ['compressed'],  // 使用压缩图片
      success: async (res) => {
        try {
          wx.showLoading({
            title: '处理中...',
            mask: true
          })

          let tempFilePath = res.tempFiles[0].tempFilePath
          const fileSize = res.tempFiles[0].size

          // 如果图片大于2MB，进一步压缩
          if (fileSize > 2 * 1024 * 1024) {
            wx.showLoading({ title: '压缩中...', mask: true })
            try {
              const compressRes = await wx.compressImage({
                src: tempFilePath,
                quality: 60  // 压缩质量60%
              })
              tempFilePath = compressRes.tempFilePath
            } catch (compressError) {
              // 压缩失败，使用原图
            }
          }

          // 上传到云存储
          wx.showLoading({ title: '上传中...', mask: true })
          const ext = tempFilePath.substring(tempFilePath.lastIndexOf('.')) || '.jpg'
          const cloudPath = `goose-price-uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: tempFilePath
          })

          const tempUrlRes = await wx.cloud.getTempFileURL({
            fileList: [uploadRes.fileID]
          })

          const fileInfo = tempUrlRes.fileList && tempUrlRes.fileList[0]
          const tempUrl = fileInfo?.tempFileURL || ''

        this.setData({
            uploadedImageUrl: tempUrl || uploadRes.fileID,
            uploadedImageFileID: uploadRes.fileID
        })
        
        const message = this.getMessage()
        if (message) {
          message.success({
          offset: [20, 32],
          content: '图片上传成功'
        })
        }
        } catch (error: any) {
          const message = this.getMessage()
          if (message) {
            message.error({
            offset: [20, 32],
            content: '图片上传失败，请重试'
          })
          }
        } finally {
          wx.hideLoading()
        }
      },
      fail: () => {
        const message = this.getMessage()
        if (message) {
          message.error({
          offset: [20, 32],
          content: '选择图片失败'
        })
        }
      }
    })
  },

  // 清除图片
  clearImage() {
    this.setData({
      uploadedImageUrl: '',
      uploadedImageFileID: ''
    })
  },

  // 填充表单数据（AI识别成功后调用）
  fillFormData(parsedData: ParsedGoosePriceResult) {
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
      parsedData.goslingBreeds.forEach((breed: ParsedBreedItem) => {
        const { min, max } = extractMinMax(breed)
        if (min !== null && max !== null) {
          const key = breed.key || ''
          if (key === 'middle') {
            formData.gosling.middle = { min: min.toString(), max: max.toString() }
          } else if (key === 'large') {
            formData.gosling.large = { min: min.toString(), max: max.toString() }
          } else if (key === 'extraLarge') {
            formData.gosling.extraLarge = { min: min.toString(), max: max.toString() }
          }
        }
      })
    }

    // 填充肉鹅价格
    if (parsedData.meatBreeds && Array.isArray(parsedData.meatBreeds)) {
      // 遍历所有肉鹅品种
      parsedData.meatBreeds.forEach((breed: ParsedBreedItem) => {
        const { min, max } = extractMinMax(breed)
        const key = (breed.key || '').toLowerCase()
        const label = (breed.label || '').toLowerCase()
        
        if (min !== null && max !== null) {
          // 更宽松的匹配规则
          const is120 = key.includes('120') || label.includes('120') || key === 'meat120'
          const is130 = key.includes('130') || label.includes('130') || key === 'meat130'
          
          if (is120) {
            formData.meat.meat120 = { min: min.toString(), max: max.toString() }
          } else if (is130) {
            formData.meat.meat130 = { min: min.toString(), max: max.toString() }
          }
        }
      })
    }

    this.setData({ manualData: formData })
  },

  // 保存最新日期的识别结果（新增记录，不做覆盖）
  async saveLatestRecord(record: ParsedGoosePriceResult | undefined) {
    if (!record) {
      return
    }

    try {
      const db = wx.cloud.database()
      const operator = wx.getStorageSync('userInfo')?.nickName || '管理员'

      const goslingBreeds = normalizeBreedList(record.goslingBreeds) as GoslingBreed[]
      const meatBreeds = normalizeBreedList(record.meatBreeds) as MeatBreed[]

      if (goslingBreeds.length === 0 && meatBreeds.length === 0) {
        return
      }

      const date = record.date || new Date().toISOString().split('T')[0]

      await db.collection('goose_prices').add({
        data: {
          date,
          goslingBreeds,
          meatBreeds,
          rawData: { goslingBreeds, meatBreeds },
          source: 'ai_recognition',
          operator,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })

      setTimeout(() => {
        this.loadHistory()
      }, 500)
    } catch (error: any) {
      // 保存失败，静默处理
    }
  },

  // AI识别图片
  async recognizeWithAI() {
    const { uploadedImageFileID } = this.data

    if (!uploadedImageFileID) {
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请先上传截图'
      })
      }
      return
    }

    this.setData({ recognizing: true })

    try {
      // 调用多模型AI服务进行识别
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
          images: [uploadedImageFileID],
          options: {
            temperature: 0,
            maxTokens: 500  // 减少token限制，只需要输出最新一条数据
          }
        },
        timeout: 58000  // 58秒超时
      })

      if (!aiResult.result || !aiResult.result.success) {
        throw new Error(aiResult.result?.error || 'AI识别失败')
      }

      const aiContent = aiResult.result.data?.content || aiResult.result.data?.text || ''
      const parsedGoosePrice = parseGoosePriceContent(aiContent)
      
      // 现在只返回单条数据（最新日期）
      this.fillFormData(parsedGoosePrice as ParsedGoosePriceResult)
      
      // 保存最新数据
      await this.saveLatestRecord(parsedGoosePrice as ParsedGoosePriceResult)
        
      this.setData({ recognizing: false })
    } catch (error: any) {
      this.setData({ recognizing: false })

      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: error.message || 'AI识别失败，请重试或使用手动录入',
        duration: 3000
      })
      }
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
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请输入文章内容'
      })
      }
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

        const message = this.getMessage()
        if (message) {
          message.success({
          offset: [20, 32],
          content: '解析成功，请查看预览数据'
        })
        }
      } else {
        throw new Error(result.message || '解析失败')
      }
    } catch (error: any) {
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: error.message || '解析失败，请检查文本格式'
      })
      }

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
              const middleMin = parseFloat(rowMatch[3])
              const middleMax = parseFloat(rowMatch[4])
              goslingBreeds.push({
                key: 'middle',
                label: '中种鹅',
                range: `${middleMin}-${middleMax}`,
                min: middleMin,
                max: middleMax
              })
              
              // 大种鹅
              const largeMin = parseFloat(rowMatch[5])
              const largeMax = parseFloat(rowMatch[6])
              goslingBreeds.push({
                key: 'large',
                label: '大种鹅',
                range: `${largeMin}-${largeMax}`,
                min: largeMin,
                max: largeMax
              })
              
              // 特大种鹅
              const extraLargeMin = parseFloat(rowMatch[7])
              const extraLargeMax = parseFloat(rowMatch[8])
              goslingBreeds.push({
                key: 'extraLarge',
                label: '特大种鹅',
                range: `${extraLargeMin}-${extraLargeMax}`,
                min: extraLargeMin,
                max: extraLargeMax
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
            
            meatBreeds.push({
              key,
              label,
              range: price1 === price2 ? `${price1}` : `${price1}-${price2}`,
              min: price1,
              max: price2
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
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请输入文章链接'
      })
      }
      return
    }

    // 验证是否是微信公众号链接
    if (!articleUrl.includes('mp.weixin.qq.com')) {
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请输入有效的微信公众号文章链接'
      })
      }
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

        const message = this.getMessage()
        if (message) {
          message.success({
          offset: [20, 32],
          content: '解析成功，请查看预览数据'
        })
        }
      } else {
        throw new Error(res.message || '解析失败')
      }
    } catch (error: any) {
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: error.message || '解析失败，请检查链接是否正确'
      })
      }

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
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()

      // 按日期分组，每个日期只显示一条记录（最新的）
      const groupedByDate: { [key: string]: any[] } = {}
      result.data.forEach((item: any) => {
        if (!groupedByDate[item.date]) {
          groupedByDate[item.date] = []
        }
        groupedByDate[item.date].push(item)
      })

      // 转换为显示列表，每个日期取第一条（最新的）
      const historyList = Object.keys(groupedByDate)
        .sort((a, b) => b.localeCompare(a)) // 日期降序
        .map(date => {
          const records = groupedByDate[date]
          const latestRecord = records[0] // 最新的一条
          return {
            date,
            recordCount: records.length, // 该日期的记录数
            source: latestRecord.source === 'ai_recognition' ? 'AI识别' : latestRecord.source === 'manual' ? '手动录入' : '文章解析',
            updateTime: latestRecord.updateTime,
            allRecords: records.map(r => ({
              _id: r._id,
              date: r.date,
              source: r.source === 'ai_recognition' ? 'AI识别' : r.source === 'manual' ? '手动录入' : '文章解析',
              createTime: r.createTime,
              operator: r.operator || '系统',
              goslingBreeds: r.goslingBreeds || [],
              meatBreeds: r.meatBreeds || []
            }))
          }
        })

      this.setData({
        historyList
      })
    } catch (error) {
      // 加载历史记录失败，静默处理
    }
  },

  // 查看历史记录（打开弹窗显示该日期的所有记录）
  viewHistory(e: any) {
    const { item } = e.currentTarget.dataset
    
    this.setData({
      showDetailPopup: true,
      selectedDate: item.date,
      selectedDateRecords: item.allRecords || []
    })
  },

  // 关闭详情弹窗
  closeDetailPopup() {
      this.setData({
      showDetailPopup: false
    })
  },

  // 格式化时间
  formatTime(dateStr: string) {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    } catch (error) {
      return ''
    }
  }
})

