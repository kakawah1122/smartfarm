/**
 * 生成物资单据号辅助函数
 * 从health-management迁移
 */

/**
 * 生成物资单据号 YP-YYYYMMDD-001（药品）或 SL-YYYYMMDD-001（饲料）
 */
function generateRecordNumber(category) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  
  // 根据分类设置前缀
  let prefix = 'WZ'  // 默认物资
  if (category === 'medicine' || category === '药品') {
    prefix = 'YP'  // 药品
  } else if (category === 'feed' || category === '饲料') {
    prefix = 'SL'  // 饲料
  } else if (category === 'vaccine' || category === '疫苗') {
    prefix = 'YM'  // 疫苗
  }
  
  // 生成随机序列号（3位）
  const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  
  return `${prefix}-${dateStr}-${sequence}`
}

/**
 * 生成治疗记录编号 ZL-YYYYMMDD-001
 */
async function generateTreatmentNumber(db, COLLECTIONS) {
  const cloud = require('wx-server-sdk')
  const _ = db.command
  
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    const prefix = `ZL-${dateStr}-`
    
    // 查询今天已有的治疗记录数量
    const todayStart = `${year}-${month}-${day}T00:00:00.000Z`
    const todayEnd = `${year}-${month}-${day}T23:59:59.999Z`
    
    const countResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        createdAt: _.gte(new Date(todayStart)).and(_.lte(new Date(todayEnd)))
      })
      .count()
    
    const todayCount = countResult.total || 0
    const sequenceNumber = String(todayCount + 1).padStart(3, '0')
    
    return `${prefix}${sequenceNumber}`
  } catch (error) {
    console.error('生成治疗记录编号失败:', error)
    // 如果生成失败，使用时间戳作为备选方案
    const timestamp = Date.now().toString().slice(-6)
    return `ZL-${timestamp}`
  }
}

module.exports = {
  generateRecordNumber,
  generateTreatmentNumber
}
