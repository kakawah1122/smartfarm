// sync-correction-to-diagnosis-history.js
// 同步异常记录的修正信息到AI诊断历史记录
// 使用方法：在项目根目录运行 node scripts/sync-correction-to-diagnosis-history.js

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'your-env-id' // 请替换为实际的云环境ID
})

const db = cloud.database()
const _ = db.command

const COLLECTIONS = {
  HEALTH_RECORDS: 'health_records',
  HEALTH_AI_DIAGNOSIS: 'health_ai_diagnosis'
}

async function syncCorrections() {
  console.log('开始同步修正信息...\n')
  
  try {
    // 1. 查询所有已修正的异常记录
    const correctedRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        recordType: 'ai_diagnosis',
        status: _.in(['abnormal', 'treating', 'recovered', 'dead']),
        isCorrected: true,
        isDeleted: _.neq(true)
      })
      .get()
    
    console.log(`找到 ${correctedRecords.data.length} 条已修正的异常记录`)
    
    if (correctedRecords.data.length === 0) {
      console.log('没有需要同步的记录')
      return
    }
    
    let successCount = 0
    let failCount = 0
    let notFoundCount = 0
    
    // 2. 逐条同步修正信息到 AI 诊断记录
    for (const record of correctedRecords.data) {
      const diagnosisId = record.diagnosisId || record.relatedDiagnosisId
      
      if (!diagnosisId) {
        console.log(`⚠️  记录 ${record._id} 没有关联的诊断ID，跳过`)
        notFoundCount++
        continue
      }
      
      try {
        // 检查诊断记录是否存在
        const diagnosisRecord = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .get()
        
        if (!diagnosisRecord.data) {
          console.log(`⚠️  诊断记录 ${diagnosisId} 不存在，跳过`)
          notFoundCount++
          continue
        }
        
        // 更新诊断记录
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .update({
            data: {
              isCorrected: true,
              correctedDiagnosis: record.correctedDiagnosis || '',
              correctionReason: record.correctionReason || record.veterinarianDiagnosis || '',
              veterinarianDiagnosis: record.veterinarianDiagnosis || record.correctionReason || '',
              veterinarianTreatmentPlan: record.veterinarianTreatmentPlan || '',
              aiAccuracyRating: record.aiAccuracyRating || 0,
              correctedBy: record.correctedBy || '',
              correctedByName: record.correctedByName || '',
              correctedAt: record.correctedAt || new Date().toISOString(),
              updatedAt: new Date()
            }
          })
        
        console.log(`✅ 已同步记录: ${record._id} -> ${diagnosisId}`)
        console.log(`   修正诊断: ${record.diagnosis} -> ${record.correctedDiagnosis}`)
        console.log(`   评分: ${record.aiAccuracyRating}星\n`)
        successCount++
        
      } catch (error) {
        console.error(`❌ 同步失败: ${record._id} -> ${diagnosisId}`)
        console.error(`   错误: ${error.message}\n`)
        failCount++
      }
    }
    
    // 3. 输出统计结果
    console.log('\n='.repeat(50))
    console.log('同步完成！统计信息：')
    console.log(`总记录数: ${correctedRecords.data.length}`)
    console.log(`成功同步: ${successCount}`)
    console.log(`失败: ${failCount}`)
    console.log(`未找到关联: ${notFoundCount}`)
    console.log('='.repeat(50))
    
  } catch (error) {
    console.error('同步过程出错:', error)
    throw error
  }
}

// 执行同步
syncCorrections()
  .then(() => {
    console.log('\n✅ 脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error)
    process.exit(1)
  })
