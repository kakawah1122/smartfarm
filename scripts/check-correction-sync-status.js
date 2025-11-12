// check-correction-sync-status.js
// 检查异常记录修正信息与诊断历史的同步状态
// 使用方法：在项目根目录运行 node scripts/check-correction-sync-status.js

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

async function checkSyncStatus() {
  console.log('开始检查修正信息同步状态...\n')
  
  try {
    // 1. 查询所有已修正的异常记录
    const correctedAbnormalRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        recordType: 'ai_diagnosis',
        isCorrected: true,
        isDeleted: _.neq(true)
      })
      .get()
    
    console.log(`异常记录中已修正记录数: ${correctedAbnormalRecords.data.length}`)
    
    // 2. 查询所有已修正的诊断历史记录
    const correctedDiagnosisRecords = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .where({
        isCorrected: true,
        isDeleted: _.neq(true)
      })
      .get()
    
    console.log(`诊断历史中已修正记录数: ${correctedDiagnosisRecords.data.length}\n`)
    
    // 3. 检查每条异常记录的同步状态
    const issues = []
    const synced = []
    const noLink = []
    
    for (const abnormalRecord of correctedAbnormalRecords.data) {
      const diagnosisId = abnormalRecord.diagnosisId || abnormalRecord.relatedDiagnosisId
      
      if (!diagnosisId) {
        noLink.push({
          recordId: abnormalRecord._id,
          diagnosis: abnormalRecord.diagnosis,
          correctedDiagnosis: abnormalRecord.correctedDiagnosis,
          checkDate: abnormalRecord.checkDate
        })
        continue
      }
      
      // 查找对应的诊断记录
      const diagnosisRecord = correctedDiagnosisRecords.data.find(d => d._id === diagnosisId)
      
      if (!diagnosisRecord) {
        issues.push({
          type: '诊断记录不存在',
          abnormalRecordId: abnormalRecord._id,
          diagnosisId: diagnosisId,
          diagnosis: abnormalRecord.diagnosis,
          correctedDiagnosis: abnormalRecord.correctedDiagnosis,
          checkDate: abnormalRecord.checkDate
        })
      } else if (!diagnosisRecord.isCorrected) {
        issues.push({
          type: '诊断记录未标记为已修正',
          abnormalRecordId: abnormalRecord._id,
          diagnosisId: diagnosisId,
          diagnosis: abnormalRecord.diagnosis,
          correctedDiagnosis: abnormalRecord.correctedDiagnosis,
          checkDate: abnormalRecord.checkDate
        })
      } else if (diagnosisRecord.correctedDiagnosis !== abnormalRecord.correctedDiagnosis) {
        issues.push({
          type: '修正诊断不一致',
          abnormalRecordId: abnormalRecord._id,
          diagnosisId: diagnosisId,
          abnormalCorrected: abnormalRecord.correctedDiagnosis,
          diagnosisCorrected: diagnosisRecord.correctedDiagnosis,
          checkDate: abnormalRecord.checkDate
        })
      } else {
        synced.push({
          abnormalRecordId: abnormalRecord._id,
          diagnosisId: diagnosisId,
          correctedDiagnosis: abnormalRecord.correctedDiagnosis,
          rating: abnormalRecord.aiAccuracyRating
        })
      }
    }
    
    // 4. 输出检查结果
    console.log('='.repeat(60))
    console.log('检查结果汇总：')
    console.log('='.repeat(60))
    console.log(`✅ 已正确同步: ${synced.length}`)
    console.log(`⚠️  缺少诊断ID: ${noLink.length}`)
    console.log(`❌ 发现问题: ${issues.length}`)
    console.log('='.repeat(60))
    
    if (noLink.length > 0) {
      console.log('\n⚠️  以下记录缺少关联的诊断ID：')
      noLink.forEach((item, index) => {
        console.log(`\n${index + 1}. 记录ID: ${item.recordId}`)
        console.log(`   日期: ${item.checkDate}`)
        console.log(`   原诊断: ${item.diagnosis}`)
        console.log(`   修正为: ${item.correctedDiagnosis}`)
      })
    }
    
    if (issues.length > 0) {
      console.log('\n❌ 发现以下同步问题：')
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.type}`)
        console.log(`   异常记录ID: ${issue.abnormalRecordId}`)
        console.log(`   诊断记录ID: ${issue.diagnosisId}`)
        console.log(`   日期: ${issue.checkDate}`)
        if (issue.type === '修正诊断不一致') {
          console.log(`   异常记录修正: ${issue.abnormalCorrected}`)
          console.log(`   诊断记录修正: ${issue.diagnosisCorrected}`)
        } else {
          console.log(`   原诊断: ${issue.diagnosis}`)
          console.log(`   修正为: ${issue.correctedDiagnosis}`)
        }
      })
      
      console.log('\n' + '='.repeat(60))
      console.log('💡 建议：')
      console.log('1. 运行同步脚本修复这些问题：')
      console.log('   node scripts/sync-correction-to-diagnosis-history.js')
      console.log('2. 确保云函数 health-management 已更新到最新版本')
      console.log('3. 重新部署云函数后，新的修正操作将自动同步')
      console.log('='.repeat(60))
    } else if (noLink.length === 0) {
      console.log('\n✅ 所有修正记录都已正确同步！')
    }
    
  } catch (error) {
    console.error('检查过程出错:', error)
    throw error
  }
}

// 执行检查
checkSyncStatus()
  .then(() => {
    console.log('\n✅ 检查完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 检查失败:', error)
    process.exit(1)
  })
