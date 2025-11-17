/**
 * 测试疫苗成本同步到财务管理功能
 * 用于验证预防管理中的疫苗任务成本是否正确计入财务交易记录
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: 'smartfarm-8gv9x5zu2f903fa6'  // 请替换为您的环境ID
})

const db = cloud.database()
const _ = db.command

async function testVaccineFinanceSync() {
  console.log('========================================')
  console.log('疫苗成本财务同步测试')
  console.log('========================================\n')
  
  try {
    // 1. 先试运行，查看需要同步的记录
    console.log('1. 试运行模式，查看需要同步的记录...')
    const dryRunResult = await cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'sync_vaccine_costs_to_finance',
        dryRun: true
      }
    })
    
    if (dryRunResult.result.success) {
      console.log('✅ 试运行成功')
      console.log(`   - 找到疫苗记录: ${dryRunResult.result.data.totalRecords} 条`)
      console.log(`   - 已存在财务记录: ${dryRunResult.result.data.existingRecords} 条`)
      console.log(`   - 需要同步: ${dryRunResult.result.data.recordsToSync} 条`)
      
      if (dryRunResult.result.data.records && dryRunResult.result.data.records.length > 0) {
        console.log('\n   需要同步的记录详情:')
        dryRunResult.result.data.records.forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.date} - ${record.vaccine} - ¥${record.cost}`)
        })
      }
    } else {
      console.log('❌ 试运行失败:', dryRunResult.result.message)
    }
    
    // 2. 查询现有的疫苗相关财务记录（同步前）
    console.log('\n2. 查询现有的疫苗相关财务记录（同步前）...')
    const beforeSyncResult = await db.collection('finance_cost_records').where({
      costCategory: 'vaccine'
    }).limit(5).get()
    
    console.log(`   找到 ${beforeSyncResult.data.length} 条疫苗财务记录`)
    
    // 3. 执行实际同步（如果有需要同步的记录）
    if (dryRunResult.result.data && dryRunResult.result.data.recordsToSync > 0) {
      console.log('\n3. 执行实际同步...')
      const syncResult = await cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'sync_vaccine_costs_to_finance',
          dryRun: false
        }
      })
      
      if (syncResult.result.success) {
        console.log('✅ 同步成功')
        console.log(`   ${syncResult.result.message}`)
        
        if (syncResult.result.data.failedRecords && syncResult.result.data.failedRecords.length > 0) {
          console.log('\n   失败记录:')
          syncResult.result.data.failedRecords.forEach((failed, index) => {
            console.log(`   ${index + 1}. ID: ${failed.id}, 错误: ${failed.error}`)
          })
        }
      } else {
        console.log('❌ 同步失败:', syncResult.result.message)
      }
    }
    
    // 4. 查询同步后的疫苗财务记录
    console.log('\n4. 查询同步后的疫苗财务记录...')
    const afterSyncResult = await db.collection('finance_cost_records').where({
      costCategory: 'vaccine'
    }).orderBy('createTime', 'desc').limit(10).get()
    
    console.log(`   找到 ${afterSyncResult.data.length} 条疫苗财务记录`)
    if (afterSyncResult.data.length > 0) {
      console.log('\n   最新的疫苗财务记录:')
      afterSyncResult.data.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.createTime.split('T')[0]} - ${record.description} - ¥${record.amount}`)
        if (record.details && record.details.syncedFrom === 'historical_data') {
          console.log(`      (历史数据同步)`)
        }
      })
    }
    
    // 5. 测试新的疫苗任务完成流程
    console.log('\n5. 模拟新的疫苗任务完成流程（创建测试数据）...')
    console.log('   提示：当用户完成疫苗任务时，系统将自动：')
    console.log('   - 在 health_prevention_records 集合创建预防记录')
    console.log('   - 在 finance_cost_records 集合创建财务记录')
    console.log('   - 财务记录的 costCategory 为 "vaccine"')
    console.log('   - 财务记录的 sourceType 为 "vaccine_task" 或 "prevention_record"')
    
    // 6. 验证财务管理查询
    console.log('\n6. 验证财务管理getAllFinanceRecords是否能获取疫苗成本...')
    const financeResult = await cloud.callFunction({
      name: 'finance-management',
      data: {
        action: 'getAllFinanceRecords',
        pageSize: 100
      }
    })
    
    if (financeResult.result.success) {
      const vaccineRecords = financeResult.result.data.records.filter(r => 
        r.costType === 'health' && 
        (r.rawRecord?.costCategory === 'vaccine' || 
         r.rawRecord?.details?.preventionType === 'vaccine' ||
         r.description?.includes('疫苗'))
      )
      console.log(`✅ 财务管理中找到 ${vaccineRecords.length} 条疫苗相关记录`)
      
      if (vaccineRecords.length > 0) {
        console.log('\n   疫苗成本记录示例:')
        vaccineRecords.slice(0, 3).forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.date} - ${record.description} - ¥${record.amount}`)
        })
      }
    } else {
      console.log('❌ 获取财务记录失败:', financeResult.result.message)
    }
    
    console.log('\n========================================')
    console.log('测试完成')
    console.log('========================================')
    
  } catch (error) {
    console.error('测试过程中发生错误:', error)
  }
}

// 执行测试
testVaccineFinanceSync()
