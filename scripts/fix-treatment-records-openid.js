#!/usr/bin/env node

/**
 * 修复治疗记录缺少 _openid 字段的问题
 * 
 * 问题背景：
 * 云函数创建的治疗记录没有 _openid 字段，导致查询不到数据，卡片显示为0
 * 
 * 解决方案：
 * 为所有没有 _openid 字段但有 createdBy 字段的记录添加 _openid 字段
 */

const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init({
  env: 'your-env-id'  // 替换为您的环境ID
})

const db = cloud.database()
const _ = db.command

async function fixTreatmentRecords() {
  console.log('🔧 开始修复治疗记录的 _openid 字段...\n')
  
  try {
    // 1. 查询所有没有 _openid 但有 createdBy 的治疗记录
    console.log('📋 查询需要修复的记录...')
    
    const result = await db.collection('health_treatment_records')
      .where({
        _openid: _.exists(false),  // 没有 _openid 字段
        createdBy: _.exists(true)  // 但有 createdBy 字段
      })
      .limit(1000)  // 批量处理
      .get()
    
    if (result.data.length === 0) {
      console.log('✅ 没有需要修复的记录')
      return
    }
    
    console.log(`⚠️  发现 ${result.data.length} 条需要修复的记录\n`)
    
    // 2. 批量更新记录
    let successCount = 0
    let failCount = 0
    
    for (const record of result.data) {
      try {
        // 使用 createdBy 的值作为 _openid
        await db.collection('health_treatment_records')
          .doc(record._id)
          .update({
            data: {
              _openid: record.createdBy
            }
          })
        
        successCount++
        console.log(`✅ 修复记录 ${record._id} (编号: ${record.treatmentNumber || 'N/A'})`)
      } catch (error) {
        failCount++
        console.error(`❌ 修复记录 ${record._id} 失败:`, error.message)
      }
    }
    
    // 3. 汇总结果
    console.log('\n📊 修复结果：')
    console.log(`✅ 成功修复: ${successCount} 条`)
    console.log(`❌ 修复失败: ${failCount} 条`)
    
    // 4. 验证修复效果
    console.log('\n🔍 验证修复效果...')
    
    const verifyResult = await db.collection('health_treatment_records')
      .where({
        _openid: _.exists(false),
        createdBy: _.exists(true)
      })
      .count()
    
    if (verifyResult.total === 0) {
      console.log('✅ 所有记录已成功修复！')
    } else {
      console.log(`⚠️  还有 ${verifyResult.total} 条记录需要修复`)
    }
    
  } catch (error) {
    console.error('❌ 修复过程出错:', error)
  }
}

// 执行修复
exports.main = async (event, context) => {
  return await fixTreatmentRecords()
}

// 如果直接运行脚本
if (require.main === module) {
  fixTreatmentRecords()
    .then(() => {
      console.log('\n✨ 修复完成')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ 修复失败:', error)
      process.exit(1)
    })
}
