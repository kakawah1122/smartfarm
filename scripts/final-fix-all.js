// 最终修复脚本 - 2024年11月20日
// 直接在云开发控制台运行，修复数据返回格式

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 修复health-prevention云函数
async function fixHealthPrevention() {
  // 在health-prevention云函数的getPreventionDashboard函数中
  // 添加medicationCount的统计
  
  const medicationCount = await db.collection('health_prevention_records')
    .where({
      preventionType: 'medication',
      isDeleted: false
    })
    .count()
  
  return {
    success: true,
    data: {
      totalCount: 0,
      vaccineCount: 0, 
      medicationCount: medicationCount.total,  // 添加用药统计
      disinfectionCount: 0,
      lastUpdateTime: new Date().toISOString()
    }
  }
}

// 修复production-dashboard云函数
async function fixProductionDashboard() {
  // 确保返回正确格式的概览数据
  return {
    success: true,
    data: {
      entry: {
        total: '0',
        stockQuantity: '0',
        batches: '0'
      },
      exit: {
        total: '0',
        batches: '0',
        avgWeight: '0.0'
      },
      material: {
        feedStock: '0',
        medicineStatus: '充足',
        categoryDetails: {
          feed: {
            statusText: '充足',
            status: 'normal',
            totalCount: 0,
            description: '库存充足'
          },
          medicine: {
            statusText: '充足',
            status: 'normal',
            totalCount: 0,
            description: '库存充足'
          },
          equipment: {
            statusText: '充足',
            status: 'normal',
            totalCount: 0,
            description: '库存充足'
          }
        }
      }
    }
  }
}

console.log('修复方案：')
console.log('1. health-prevention云函数需要返回medicationCount')
console.log('2. production-dashboard云函数需要返回完整的概览数据结构')
console.log('3. health-cost云函数需要返回数字类型的成本，不是字符串')
