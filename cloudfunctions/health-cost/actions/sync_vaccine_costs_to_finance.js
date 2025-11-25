/**
 * 同步历史疫苗成本到财务系统
 * 从 health-management 迁移
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const { COLLECTIONS } = require('../collections.js')

/**
 * 同步历史疫苗成本到财务系统
 */
async function syncVaccineCostsToFinance(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    const { startDate, endDate, dryRun = false } = event
    
    // 1. 查询预防记录中有成本但未同步到财务的疫苗记录
    let query = db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS).where({
      preventionType: 'vaccine',
      'costInfo.totalCost': _.gt(0)
    })
    
    // 如果指定了日期范围
    if (startDate && endDate) {
      query = query.where({
        preventionDate: _.gte(startDate).and(_.lte(endDate))
      })
    }
    
    const preventionResult = await query.limit(100).get()
    const preventionRecords = preventionResult.data

    // 2. 查询已存在的财务记录，避免重复创建
    const preventionIds = preventionRecords.map(r => r._id)
    const existingFinanceResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).where({
      sourceType: _.in(['vaccine_task', 'prevention_record']),
      sourceRecordId: _.in(preventionIds)
    }).get()
    
    const existingFinanceMap = new Map(
      existingFinanceResult.data.map(r => [r.sourceRecordId, r])
    )
    
    // 3. 过滤出需要同步的记录
    const recordsToSync = preventionRecords.filter(r => !existingFinanceMap.has(r._id))

    if (dryRun) {
      return {
        success: true,
        message: '试运行完成（未实际创建记录）',
        data: {
          totalRecords: preventionRecords.length,
          existingRecords: existingFinanceResult.data.length,
          recordsToSync: recordsToSync.length,
          records: recordsToSync.map(r => ({
            id: r._id,
            date: r.preventionDate,
            vaccine: r.vaccineInfo?.name || '未知疫苗',
            cost: r.costInfo?.totalCost || 0
          }))
        }
      }
    }
    
    // 4. 批量创建财务记录
    let successCount = 0
    let failedCount = 0
    const failedRecords = []
    
    for (const record of recordsToSync) {
      try {
        const financeRecordData = {
          recordId: 'SYNC' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
          costType: 'health',
          costCategory: 'vaccine',
          sourceType: 'prevention_record',
          sourceRecordId: record._id,
          batchId: record.batchId,
          amount: record.costInfo.totalCost,
          description: `疫苗接种 - ${record.vaccineInfo?.name || ''}`,
          details: {
            preventionType: 'vaccine',
            preventionRecordId: record._id,
            vaccineName: record.vaccineInfo?.name || '',
            laborCost: record.costInfo?.laborCost || 0,
            materialCost: record.costInfo?.vaccineCost || record.costInfo?.materialCost || 0,
            otherCost: record.costInfo?.otherCost || 0,
            veterinarian: record.veterinarianInfo?.name || '',
            syncedFrom: 'historical_data',
            syncDate: new Date().toISOString()
          },
          date: record.preventionDate,
          status: 'confirmed',
          createTime: record.createTime || record.createdAt || new Date().toISOString(),
          updateTime: new Date().toISOString(),
          isDeleted: false,
          _openid: record._openid || record.operator || openid
        }
        
        await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({ data: financeRecordData })
        successCount++
      } catch (error) {
        console.error(`[疫苗成本同步] 创建财务记录失败:`, error)
        failedCount++
        failedRecords.push({
          id: record._id,
          error: error.message
        })
      }
    }
    
    return {
      success: true,
      message: `同步完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
      data: {
        totalRecords: preventionRecords.length,
        existingRecords: existingFinanceResult.data.length,
        recordsToSync: recordsToSync.length,
        successCount,
        failedCount,
        failedRecords
      }
    }
  } catch (error) {
    console.error('[疫苗成本同步] 错误:', error)
    return {
      success: false,
      error: error.message || '同步疫苗成本失败'
    }
  }
}

module.exports = {
  main: syncVaccineCostsToFinance
}
