// diagnosis-data-utils.ts - 诊断数据转换工具函数

/**
 * 诊断记录数据接口
 */
export interface DiagnosisRecord {
  _id: string
  diagnosis?: string
  diagnosisResult?: string
  diagnosisDate?: string
  createTime?: string
  affectedCount?: number
  dayAge?: number
  symptoms?: string
  confidence?: number
  images?: (string | null)[]
  treatmentDuration?: string
  [key: string]: any
}

/**
 * 统一诊断记录数据格式
 * 确保所有必要的字段都存在，统一字段名
 * @param record 原始诊断记录数据
 * @returns 标准化后的诊断记录数据
 */
export function normalizeDiagnosisRecord(record: any): DiagnosisRecord {
  // 统一疾病名称字段：优先使用 diagnosis，如果没有则使用 diagnosisResult
  const diagnosis = record.diagnosis || record.diagnosisResult || '未知疾病'

  // 统一诊断日期字段：优先使用 diagnosisDate，如果没有则从 createTime 格式化
  let diagnosisDate = record.diagnosisDate
  if (!diagnosisDate && record.createTime) {
    // 将 ISO 格式转换为 YYYY-MM-DD HH:mm
    const date = new Date(record.createTime)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      diagnosisDate = `${year}-${month}-${day} ${hour}:${minute}`
    }
  }

  // 过滤图片数组中的无效值
  const images = (record.images || []).filter(
    (img: any) => img !== null && img !== undefined && typeof img === 'string'
  )

  return {
    ...record,
    // 统一字段名：同时保留 diagnosis 和 diagnosisResult 以确保兼容性
    diagnosis,
    diagnosisResult: record.diagnosisResult || record.diagnosis || '未知疾病',
    diagnosisDate: diagnosisDate || '',
    // 确保 createTime 存在（原始时间戳）
    createTime: record.createTime || '',
    // 确保数值字段存在
    affectedCount: record.affectedCount ?? 0,
    dayAge: record.dayAge ?? 0,
    confidence: record.confidence ?? 0,
    // 过滤后的图片数组
    images
  }
}

/**
 * 批量标准化诊断记录数据
 * @param records 原始诊断记录数组
 * @returns 标准化后的诊断记录数组
 */
export function normalizeDiagnosisRecords(records: any[]): DiagnosisRecord[] {
  return records.map(normalizeDiagnosisRecord)
}

/**
 * 格式化诊断时间（相对时间或绝对时间）
 * @param dateString 日期字符串
 * @returns 格式化后的时间字符串
 */
export function formatDiagnosisTime(dateString: string): string {
  if (!dateString) {
    return '未知时间'
  }

  let date: Date
  try {
    date = new Date(dateString)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '时间格式错误'
    }
  } catch (e) {
    return '时间解析失败'
  }

  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟
  if (diff < 60000 && diff >= 0) {
    return '刚刚'
  }

  // 小于1小时
  if (diff < 3600000 && diff >= 0) {
    return Math.floor(diff / 60000) + '分钟前'
  }

  // 小于1天
  if (diff < 86400000 && diff >= 0) {
    return Math.floor(diff / 3600000) + '小时前'
  }

  // 小于7天
  if (diff < 604800000 && diff >= 0) {
    return Math.floor(diff / 86400000) + '天前'
  }

  // 格式化为具体时间 (YYYY-MM-DD HH:mm)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}`
}

