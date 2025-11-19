/**
 * 重新计算死亡记录成本（包含诊断用药成本）
 * 
 * 使用场景：
 * 1. 修复了成本计算逻辑后，批量更新所有死亡记录
 * 2. 确保治疗成本包含诊断记录中的用药成本
 * 
 * 运行方式：
 * 1. 在微信开发者工具中打开云开发控制台
 * 2. 进入云函数管理，选择任意云函数
 * 3. 在测试页面粘贴以下代码并运行
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function recalculateAllDeathCosts() {
  try {
    console.log('========================================')
    console.log('🚀 开始重新计算死亡成本（包含诊断用药）')
    console.log('========================================\n')
    
    // 调用云函数进行批量重新计算
    const result = await cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'recalculate_all_death_costs'
      }
    })
    
    if (result.result.success) {
      const { processedCount, updatedCount, errors } = result.result.data
      
      console.log('\n========================================')
      console.log('✅ 计算完成')
      console.log('========================================')
      console.log(`📊 处理记录数: ${processedCount}`)
      console.log(`✨ 更新记录数: ${updatedCount}`)
      
      if (errors && errors.length > 0) {
        console.log(`\n⚠️  错误记录数: ${errors.length}`)
        errors.forEach((err, index) => {
          console.log(`\n错误 ${index + 1}:`)
          console.log(`  记录ID: ${err.recordId}`)
          console.log(`  错误信息: ${err.error}`)
        })
      }
      
      console.log('\n========================================')
      console.log('🎉 所有死亡记录成本已更新')
      console.log('新的成本计算包含：')
      console.log('  • 鹅苗成本')
      console.log('  • 饲养成本（基于实际投喂数量）')
      console.log('  • 预防成本（基于实际预防数量）')
      console.log('  • 治疗成本（基于实际治疗数量 + 诊断用药）')
      console.log('========================================\n')
      
      return {
        success: true,
        data: result.result.data
      }
    } else {
      throw new Error(result.result.error || '计算失败')
    }
  } catch (error) {
    console.error('\n❌ 重新计算失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 单个批次重新计算
async function recalculateBatchDeathCosts(batchId) {
  try {
    console.log(`🔄 重新计算批次 ${batchId} 的死亡成本...\n`)
    
    const result = await cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'recalculate_all_death_costs',
        batchId: batchId
      }
    })
    
    if (result.result.success) {
      const { processedCount, updatedCount } = result.result.data
      console.log(`✅ 批次 ${batchId} 处理完成`)
      console.log(`   处理: ${processedCount} 条, 更新: ${updatedCount} 条\n`)
      return result.result
    } else {
      throw new Error(result.result.error)
    }
  } catch (error) {
    console.error(`❌ 批次 ${batchId} 处理失败:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// 验证成本计算结果
async function verifyDeathCosts(limit = 5) {
  try {
    console.log('\n========================================')
    console.log('🔍 验证死亡成本计算结果')
    console.log('========================================\n')
    
    const records = await db.collection('health_death_records')
      .where({
        isDeleted: db.command.neq(true)
      })
      .orderBy('deathDate', 'desc')
      .limit(limit)
      .get()
    
    if (records.data.length === 0) {
      console.log('⚠️  没有找到死亡记录')
      return
    }
    
    console.log(`📋 显示最近 ${records.data.length} 条死亡记录的成本分解：\n`)
    
    records.data.forEach((record, index) => {
      console.log(`记录 ${index + 1}:`)
      console.log(`  批次: ${record.batchId}`)
      console.log(`  日期: ${record.deathDate}`)
      console.log(`  死亡数: ${record.deathCount} 只`)
      console.log(`  死亡原因: ${record.deathCause || '未知'}`)
      
      if (record.costBreakdown) {
        const breakdown = record.costBreakdown
        console.log(`  成本分解:`)
        console.log(`    - 鹅苗: ¥${breakdown.entryUnitCost || 0}/只`)
        console.log(`    - 饲养: ¥${breakdown.breedingCost || 0}/只`)
        console.log(`    - 预防: ¥${breakdown.preventionCost || 0}/只`)
        console.log(`    - 治疗: ¥${breakdown.treatmentCost || 0}/只 (含诊断用药)`)
        
        const total = parseFloat(breakdown.entryUnitCost || 0) + 
                     parseFloat(breakdown.breedingCost || 0) + 
                     parseFloat(breakdown.preventionCost || 0) + 
                     parseFloat(breakdown.treatmentCost || 0)
        console.log(`  单只综合成本: ¥${total.toFixed(2)}`)
        console.log(`  总损失: ¥${(total * record.deathCount).toFixed(2)}`)
      } else {
        console.log(`  ⚠️  无成本分解数据`)
      }
      console.log('')
    })
    
    console.log('========================================\n')
  } catch (error) {
    console.error('❌ 验证失败:', error)
  }
}

// ============ 导出函数 ============
exports.main = async (event, context) => {
  const { action, batchId } = event
  
  switch (action) {
    case 'recalculate_all':
      return await recalculateAllDeathCosts()
    
    case 'recalculate_batch':
      if (!batchId) {
        return { success: false, error: '请提供批次ID' }
      }
      return await recalculateBatchDeathCosts(batchId)
    
    case 'verify':
      await verifyDeathCosts(event.limit || 5)
      return { success: true }
    
    default:
      // 默认执行全部重新计算
      return await recalculateAllDeathCosts()
  }
}

// ============ 使用示例 ============
/*
// 1. 重新计算所有死亡记录
wx.cloud.callFunction({
  name: '你的云函数名',
  data: {
    action: 'recalculate_all'
  }
})

// 2. 重新计算指定批次
wx.cloud.callFunction({
  name: '你的云函数名',
  data: {
    action: 'recalculate_batch',
    batchId: 'QY-20251118'
  }
})

// 3. 验证计算结果
wx.cloud.callFunction({
  name: '你的云函数名',
  data: {
    action: 'verify',
    limit: 10  // 查看最近10条记录
  }
})
*/
