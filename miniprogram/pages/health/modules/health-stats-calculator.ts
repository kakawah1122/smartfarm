// health-stats-calculator.ts - 健康统计计算模块

interface PreventionRecord {
  _id: string
  preventionType: string
  vaccineInfo?: any
  costInfo?: any
}

interface PreventionStats {
  totalPreventions: number
  vaccineCount: number
  medicationCount: number  // 添加用药统计字段
  vaccineCoverage: number
  vaccineStats: { [key: string]: number }
  disinfectionCount: number
  totalCost: number
}

/**
 * 计算预防统计数据
 */
export function calculatePreventionStats(records: PreventionRecord[]): PreventionStats {
  const totalPreventions = records.length
  
  // 按疫苗名称分类统计
  const vaccineStats: { [key: string]: number } = {}
  let totalVaccinatedCount = 0
  
  records.forEach(r => {
    if (r.preventionType === 'vaccine' && r.vaccineInfo) {
      const vaccineName = r.vaccineInfo.name || '未知疫苗'
      const count = r.vaccineInfo.count || 0
      
      if (!vaccineStats[vaccineName]) {
        vaccineStats[vaccineName] = 0
      }
      vaccineStats[vaccineName] += count
      
      // 累加总接种数（用于统计）
      totalVaccinatedCount += count
    }
  })
  
  // 计算接种覆盖数（使用第一针的接种数作为基数）
  const firstVaccineNames = ['小鹅瘟疫苗第一针', '小鹅瘟高免血清', '小鹅瘟高免血清或高免蛋黄抗体注射', '第一针']
  let vaccineCoverage = 0
  for (const name of firstVaccineNames) {
    if (vaccineStats[name]) {
      vaccineCoverage = Math.max(vaccineCoverage, vaccineStats[name])
    }
  }
  // 如果没有找到第一针，使用所有疫苗中的最大值作为覆盖基数
  if (vaccineCoverage === 0 && Object.keys(vaccineStats).length > 0) {
    vaccineCoverage = Math.max(...Object.values(vaccineStats))
  }
  
  const disinfectionCount = records.filter(r => r.preventionType === 'disinfection').length
  const medicationCount = records.filter(r => r.preventionType === 'medication' || r.preventionType === 'medicine').length
  const totalCost = records.reduce((sum, r) => sum + (r.costInfo?.totalCost || 0), 0)

  return {
    totalPreventions,
    vaccineCount: totalVaccinatedCount,
    medicationCount,  // 添加用药统计
    vaccineCoverage,
    vaccineStats,
    disinfectionCount,
    totalCost
  }
}

/**
 * 格式化预防记录，映射数据库字段到显示字段
 */
export function formatPreventionRecord(record: any) {
  // 预防类型中文名称映射
  const preventionTypeNames: { [key: string]: string } = {
    'vaccine': '疫苗接种',
    'disinfection': '消毒防疫',
    'deworming': '驱虫',
    'quarantine': '隔离检疫'
  }
  
  // 提取疫苗信息
  const vaccineInfo = record.vaccineInfo || {}
  const costInfo = record.costInfo || {}
  
  // 构建显示标题
  let title = preventionTypeNames[record.preventionType] || record.preventionType
  if (vaccineInfo.name) {
    title = `${title} - ${vaccineInfo.name}`
  }
  
  // 构建描述信息
  let desc = ''
  if (vaccineInfo.route) {
    desc += vaccineInfo.route
  }
  if (vaccineInfo.count) {
    desc += ` · ${vaccineInfo.count}只`
  }
  
  // 格式化日期时间
  let createTime = record.preventionDate || ''
  if (record.createdAt) {
    const date = new Date(record.createdAt)
    createTime = `${date.getMonth() + 1}月${date.getDate()}日`
  }
  
  return {
    ...record,
    // 显示字段
    preventionType: title,
    location: vaccineInfo.route || '-',
    targetAnimals: vaccineInfo.count || 0,
    createTime: createTime,
    // 关联任务标识
    hasRelatedTask: !!record.relatedTaskId,
    isFromTask: record.creationSource === 'task',
    // 成本信息
    cost: costInfo.totalCost || 0
  }
}

