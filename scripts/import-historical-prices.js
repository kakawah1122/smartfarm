/**
 * 批量导入历史鹅价数据
 * 
 * 用途：将图2中的历史数据批量导入到 goose_prices 集合
 * 使用：在云开发控制台 → 云函数 → 新建云函数 → 粘贴代码 → 测试运行
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 历史数据（根据图2的表格）
const historicalData = [
  {
    date: '2025-10-30',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 38, max: 41, range: '38-41', price: 39.5 },
      { key: 'large', label: '大种鹅', min: 52, max: 54, range: '52-54', price: 53.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 56, max: 60, range: '56-60', price: 58.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 18.5, max: 18.5, range: '18.5-18.5', price: 18.5 },
      { key: 'meat130', label: '肉鹅130日龄', min: 19, max: 19, range: '19-19', price: 19.0 }
    ]
  },
  {
    date: '2025-10-31',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 38, max: 41, range: '38-41', price: 39.5 },
      { key: 'large', label: '大种鹅', min: 52, max: 54, range: '52-54', price: 53.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 56, max: 60, range: '56-60', price: 58.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 18, max: 18, range: '18-18', price: 18.0 },
      { key: 'meat130', label: '肉鹅130日龄', min: 18.5, max: 18.5, range: '18.5-18.5', price: 18.5 }
    ]
  },
  {
    date: '2025-11-01',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 36, max: 39, range: '36-39', price: 37.5 },
      { key: 'large', label: '大种鹅', min: 50, max: 52, range: '50-52', price: 51.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 54, max: 58, range: '54-58', price: 56.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 18, max: 18, range: '18-18', price: 18.0 },
      { key: 'meat130', label: '肉鹅130日龄', min: 18.5, max: 18.5, range: '18.5-18.5', price: 18.5 }
    ]
  },
  {
    date: '2025-11-02',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 36, max: 39, range: '36-39', price: 37.5 },
      { key: 'large', label: '大种鹅', min: 50, max: 52, range: '50-52', price: 51.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 54, max: 58, range: '54-58', price: 56.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 17, max: 17, range: '17-17', price: 17.0 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17.5, max: 17.5, range: '17.5-17.5', price: 17.5 }
    ]
  },
  {
    date: '2025-11-03',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 36, max: 39, range: '36-39', price: 37.5 },
      { key: 'large', label: '大种鹅', min: 50, max: 52, range: '50-52', price: 51.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 54, max: 58, range: '54-58', price: 56.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 17, max: 17, range: '17-17', price: 17.0 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17.5, max: 17.5, range: '17.5-17.5', price: 17.5 }
    ]
  },
  {
    date: '2025-11-04',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 34, max: 37, range: '34-37', price: 35.5 },
      { key: 'large', label: '大种鹅', min: 48, max: 50, range: '48-50', price: 49.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 52, max: 56, range: '52-56', price: 54.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 16.5, max: 16.5, range: '16.5-16.5', price: 16.5 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17, max: 17, range: '17-17', price: 17.0 }
    ]
  },
  {
    date: '2025-11-05',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 32, max: 35, range: '32-35', price: 33.5 },
      { key: 'large', label: '大种鹅', min: 46, max: 48, range: '46-48', price: 47.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 50, max: 54, range: '50-54', price: 52.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 16.5, max: 16.5, range: '16.5-16.5', price: 16.5 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17, max: 17, range: '17-17', price: 17.0 }
    ]
  },
  {
    date: '2025-11-06',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 30, max: 33, range: '30-33', price: 31.5 },
      { key: 'large', label: '大种鹅', min: 44, max: 46, range: '44-46', price: 45.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 48, max: 52, range: '48-52', price: 50.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 16.5, max: 16.5, range: '16.5-16.5', price: 16.5 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17, max: 17, range: '17-17', price: 17.0 }
    ]
  },
  {
    date: '2025-11-07',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 28, max: 31, range: '28-31', price: 29.5 },
      { key: 'large', label: '大种鹅', min: 42, max: 44, range: '42-44', price: 43.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 46, max: 50, range: '46-50', price: 48.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 16.5, max: 16.5, range: '16.5-16.5', price: 16.5 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17, max: 17, range: '17-17', price: 17.0 }
    ]
  },
  {
    date: '2025-11-08',
    goslingBreeds: [
      { key: 'middle', label: '中种鹅', min: 26, max: 29, range: '26-29', price: 27.5 },
      { key: 'large', label: '大种鹅', min: 40, max: 42, range: '40-42', price: 41.0 },
      { key: 'extraLarge', label: '特大种鹅', min: 44, max: 48, range: '44-48', price: 46.0 }
    ],
    meatBreeds: [
      { key: 'meat120', label: '肉鹅120日龄', min: 16.5, max: 16.5, range: '16.5-16.5', price: 16.5 },
      { key: 'meat130', label: '肉鹅130日龄', min: 17, max: 17, range: '17-17', price: 17.0 }
    ]
  }
]

exports.main = async (event, context) => {
  try {
    console.log('开始导入历史鹅价数据...')
    
    let importCount = 0
    let updateCount = 0
    let skipCount = 0

    for (const record of historicalData) {
      // 检查该日期是否已存在
      const existing = await db.collection('goose_prices')
        .where({ date: record.date })
        .get()

      const saveData = {
        date: record.date,
        goslingBreeds: record.goslingBreeds,
        meatBreeds: record.meatBreeds,
        rawData: {
          goslingBreeds: record.goslingBreeds,
          meatBreeds: record.meatBreeds
        },
        source: 'manual',
        operator: '系统导入',
        updateTime: db.serverDate()
      }

      if (existing.data.length > 0) {
        // 已存在，更新
        await db.collection('goose_prices')
          .doc(existing.data[0]._id)
          .update({ data: saveData })
        
        updateCount++
        console.log(`✅ 更新: ${record.date}`)
      } else {
        // 不存在，新增
        await db.collection('goose_prices')
          .add({
            data: {
              ...saveData,
              createTime: db.serverDate()
            }
          })
        
        importCount++
        console.log(`✅ 新增: ${record.date}`)
      }
    }

    console.log('导入完成！')
    console.log(`新增: ${importCount} 条`)
    console.log(`更新: ${updateCount} 条`)
    
    return {
      success: true,
      message: '历史数据导入成功',
      stats: {
        imported: importCount,
        updated: updateCount,
        total: historicalData.length
      }
    }
  } catch (error) {
    console.error('导入失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

