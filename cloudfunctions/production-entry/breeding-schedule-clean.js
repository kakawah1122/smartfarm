// breeding-schedule.js - 清洁版本，只包含必要字段
const BREEDING_SCHEDULE = {
  // 第1日龄：入栏第一天
  1: [
    {
      id: 'entry_check_1',
      type: 'inspection',
      priority: 'high',
      title: '入栏健康检查',
      description: '检查雏鹅健康状况，记录入栏数量和基本信息',
      category: '健康管理'
    },
    {
      id: 'glucose_water_1',
      type: 'nutrition',
      priority: 'critical',
      title: '3%葡萄糖或红糖水+电解多维',
      description: '饮水给药，增强抵抗力，补充水分，减少应激',
      category: '营养管理',
      dosage: '3%浓度饮水'
    }
  ],

  // 第2日龄：重要的免疫开始日
  2: [
    {
      id: 'goose_plague_vaccine_1_2',
      type: 'vaccine',
      priority: 'critical',
      title: '小鹅瘟高免血清第一针',
      description: '小鹅瘟高免血清或高免蛋黄抗体注射',
      category: '疫苗接种',
      dosage: '每只1.2毫升'
    },
    {
      id: 'opening_medicine_start_2',
      type: 'medication',
      priority: 'high',
      title: '开口药第1天开始',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎',
      category: '用药管理',
      duration: 4,
      dayInSeries: 1,
      dosage: '按说明书使用'
    }
  ],

  // 第3日龄：继续开口药
  3: [
    {
      id: 'opening_medicine_day2_3',
      type: 'medication',
      priority: 'high',
      title: '开口药第2天',
      description: '继续预防细菌性疾病，促进卵黄吸收，增强抗病能力',
      category: '用药管理',
      duration: 4,
      dayInSeries: 2,
      dosage: '按说明书使用'
    },
    {
      id: 'weak_chick_care_3',
      type: 'care',
      priority: 'medium',
      title: '弱苗特殊护理',
      description: '对筛选出的弱苗进行单独饲喂和护理',
      category: '特殊护理'
    }
  ],

  // 第4日龄：开口药第3天
  4: [
    {
      id: 'opening_medicine_day3_4',
      type: 'medication',
      priority: 'high',
      title: '开口药第3天',
      description: '继续开口药治疗，预防腺胃炎肌胃炎，增强食欲',
      category: '用药管理',
      duration: 4,
      dayInSeries: 3,
      dosage: '按说明书使用'
    }
  ],

  // 第5日龄：开口药最后一天，开始控料
  5: [
    {
      id: 'opening_medicine_day4_5',
      type: 'medication',
      priority: 'high',
      title: '开口药第4天（最后一天）',
      description: '完成4天开口药疗程',
      category: '用药管理',
      duration: 4,
      dayInSeries: 4,
      dosage: '按说明书使用'
    },
    {
      id: 'feed_control_start_5',
      type: 'feeding',
      priority: 'critical',
      title: '开始控料（5-15日龄）',
      description: '控料方法：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 1
    }
  ]
}

// 获取指定日龄的任务
function getTasksByAge(dayAge) {
  return BREEDING_SCHEDULE[dayAge] || []
}

// 获取所有任务日龄
function getAllTaskDays() {
  return Object.keys(BREEDING_SCHEDULE).map(day => parseInt(day)).sort((a, b) => a - b)
}

module.exports = {
  BREEDING_SCHEDULE,
  getTasksByAge,
  getAllTaskDays
}
