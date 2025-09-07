// 获取异常个体统计数据
async function getAbnormalStatistics(event, wxContext) {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // 获取所有健康记录进行统计
    const allRecords = await db.collection('health_records')
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取死亡记录
    const deathRecords = await db.collection('death_records')
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取跟进记录（治愈记录）
    const followupRecords = await db.collection('followup_records')
      .where({
        followupType: 'cure'
      })
      .orderBy('createTime', 'desc')
      .get()
    
    // 统计各种疾病
    const diseaseStats = {}
    let totalAbnormal = 0
    
    // 处理健康记录
    allRecords.data.forEach(record => {
      const disease = record.diagnosisDisease || '未确诊'
      const abnormalCount = record.abnormalCount || 0
      
      if (abnormalCount > 0) {
        totalAbnormal += abnormalCount
        
        if (!diseaseStats[disease]) {
          diseaseStats[disease] = {
            name: disease,
            count: 0,
            mortality: 0,
            recovery: 0
          }
        }
        
        diseaseStats[disease].count += abnormalCount
      }
    })
    
    // 处理死亡记录
    deathRecords.data.forEach(record => {
      const disease = record.diagnosisDisease || '未确诊'
      const deathCount = record.deathCount || 0
      
      if (diseaseStats[disease]) {
        diseaseStats[disease].mortality += deathCount
      }
    })
    
    // 处理治愈记录
    followupRecords.data.forEach(record => {
      const disease = record.diagnosisDisease || '未确诊'
      const cureCount = record.cureCount || 0
      
      if (diseaseStats[disease]) {
        diseaseStats[disease].recovery += cureCount
      }
    })
    
    // 转换为数组格式
    const diseases = Object.values(diseaseStats).sort((a, b) => b.count - a.count)
    
    // 计算时间范围统计
    const timeRangeData = [
      {
        label: '今日',
        abnormal: allRecords.data.filter(r => 
          new Date(r.createTime) >= today && (r.abnormalCount || 0) > 0
        ).reduce((sum, r) => sum + (r.abnormalCount || 0), 0),
        mortality: deathRecords.data.filter(r => 
          new Date(r.createTime) >= today
        ).reduce((sum, r) => sum + (r.deathCount || 0), 0),
        recovery: followupRecords.data.filter(r => 
          new Date(r.createTime) >= today && r.followupType === 'cure'
        ).reduce((sum, r) => sum + (r.cureCount || 0), 0)
      },
      {
        label: '本周',
        abnormal: allRecords.data.filter(r => 
          new Date(r.createTime) >= weekAgo && (r.abnormalCount || 0) > 0
        ).reduce((sum, r) => sum + (r.abnormalCount || 0), 0),
        mortality: deathRecords.data.filter(r => 
          new Date(r.createTime) >= weekAgo
        ).reduce((sum, r) => sum + (r.deathCount || 0), 0),
        recovery: followupRecords.data.filter(r => 
          new Date(r.createTime) >= weekAgo && r.followupType === 'cure'
        ).reduce((sum, r) => sum + (r.cureCount || 0), 0)
      },
      {
        label: '本月',
        abnormal: allRecords.data.filter(r => 
          new Date(r.createTime) >= monthStart && (r.abnormalCount || 0) > 0
        ).reduce((sum, r) => sum + (r.abnormalCount || 0), 0),
        mortality: deathRecords.data.filter(r => 
          new Date(r.createTime) >= monthStart
        ).reduce((sum, r) => sum + (r.deathCount || 0), 0),
        recovery: followupRecords.data.filter(r => 
          new Date(r.createTime) >= monthStart && r.followupType === 'cure'
        ).reduce((sum, r) => sum + (r.cureCount || 0), 0)
      }
    ]
    
    return {
      success: true,
      data: {
        diseases,
        totalAbnormal,
        timeRangeData,
        trendData: [] // 趋势数据可以后续扩展
      }
    }
    
  } catch (error) {
    throw error
  }
}

module.exports = {
  getAbnormalStatistics
}
