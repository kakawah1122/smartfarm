// 养殖周期标准任务数据
// 从云函数的breeding-schedule.js复制的数据，用于前端展示

export const BREEDING_SCHEDULE_DATA = {
  // 第1日龄：入栏第一天
  1: [
    {
      id: 'entry_check_1',
      type: 'inspection',
      title: '入栏健康检查',
      description: '检查雏鹅健康状况，记录入栏数量和基本信息',
      category: '健康管理',
      priority: 'high'
    },
    {
      id: 'glucose_water_1',
      type: 'nutrition',
      title: '3%葡萄糖或红糖水+电解多维',
      description: '饮水给药，增强抵抗力，补充水分，减少应激',
      category: '营养管理',
      dosage: '3%浓度饮水',
      priority: 'medium'
    },
    {
      id: 'weak_chick_care_1',
      type: 'care',
      title: '弱苗特殊护理',
      description: '识别并筛选出体质较弱的雏鹅，准备单独护理',
      category: '特殊护理',
      priority: 'medium'
    }
  ],

  // 第2日龄：重要的免疫开始日
  2: [
    {
      id: 'goose_plague_vaccine_1_2',
      type: 'vaccine',
      title: '小鹅瘟疫苗第一针',
      description: '小鹅瘟高免血清或高免蛋黄抗体注射',
      category: '疫苗接种',
      dosage: '1.2ml/只',
      priority: 'high'
    },
    {
      id: 'opening_medicine_start_2',
      type: 'medication',
      title: '开口药第一天',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎。预防腺胃炎肌胃炎，促进卵黄吸收，增强食欲，提高抗病能力',
      category: '用药管理',
      duration: 4,
      dayInSeries: 1,
      dosage: '按说明书使用',
      priority: 'high'
    },
    {
      id: 'weak_chick_care_2',
      type: 'care',
      title: '弱苗特殊护理',
      description: '对体质较弱的雏鹅进行单独饲喂和护理，观察开口药反应',
      category: '特殊护理',
      priority: 'medium'
    }
  ],

  // 第3日龄：继续开口药
  3: [
    {
      id: 'opening_medicine_day2_3',
      type: 'medication',
      title: '开口药第2天',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎。预防腺胃炎肌胃炎，促进卵黄吸收，增强食欲，提高抗病能力',
      category: '用药管理',
      duration: 4,
      dayInSeries: 2,
      dosage: '按说明书使用',
      priority: 'high'
    },
    {
      id: 'weak_chick_care_3',
      type: 'care',
      title: '弱苗特殊护理',
      description: '对筛选出的弱苗进行单独饲喂和护理',
      category: '特殊护理',
      priority: 'medium'
    }
  ],

  // 第4日龄：开口药第3天
  4: [
    {
      id: 'opening_medicine_day3_4',
      type: 'medication',
      title: '开口药第3天',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎。预防腺胃炎肌胃炎，促进卵黄吸收，增强食欲，提高抗病能力',
      category: '用药管理',
      duration: 4,
      dayInSeries: 3,
      dosage: '按说明书使用',
      priority: 'high'
    },
    {
      id: 'weak_chick_care_4',
      type: 'care',
      title: '弱苗特殊护理',
      description: '继续对弱苗进行单独饲喂和护理，重点关注体重增长情况',
      category: '特殊护理',
      priority: 'medium'
    }
  ],

  // 第5日龄：开口药最后一天，开始控料
  5: [
    {
      id: 'opening_medicine_day4_5',
      type: 'medication',
      title: '开口药第4天（最后一天）',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎。预防腺胃炎肌胃炎，促进卵黄吸收，增强食欲，提高抗病能力（完成4天疗程）',
      category: '用药管理',
      duration: 4,
      dayInSeries: 4,
      dosage: '按说明书使用',
      priority: 'high'
    },
    {
      id: 'feed_control_start_5',
      type: 'feeding',
      title: '开始控料（5-15日龄）',
      description: '控料方法：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或者全喂青草或者玉米面（刚开始可以一半饲料一半玉米面，逐渐减至全是玉米面就可以）',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 1,
      priority: 'high'
    },
    {
      id: 'weak_chick_care_5',
      type: 'care',
      title: '弱苗特殊护理',
      description: '弱苗在控料期间需要特别关注，确保营养充足，必要时延缓控料',
      category: '特殊护理',
      priority: 'medium'
    }
  ],

  // 第7日龄
  7: [
    {
      id: 'weight_check_7',
      type: 'inspection',
      title: '第一次称重记录',
      description: '记录雏鹅体重，评估生长情况，判断饲养管理是否得当',
      category: '健康管理',
      priority: 'high'
    },
    {
      id: 'feed_control_day3_7',
      type: 'feeding',
      title: '控料第3天',
      description: '继续控料，观察雏鹅适应情况',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 3,
      priority: 'medium'
    }
  ],

  // 第10日龄
  10: [
    {
      id: 'disease_prevention_10',
      type: 'medication',
      title: '疾病预防用药',
      description: '根据当地疫情情况，预防性投药，防止细菌性疾病',
      category: '用药管理',
      dosage: '按兽医指导',
      priority: 'medium'
    },
    {
      id: 'feed_control_day6_10',
      type: 'feeding',
      title: '控料第6天',
      description: '评估控料效果，适当调整饲料配比',
      category: '饲养管理',
      priority: 'medium'
    }
  ],

  // 第14日龄
  14: [
    {
      id: 'vaccine_2_14',
      type: 'vaccine',
      title: '禽流感疫苗',
      description: '预防禽流感，提高鹅群免疫力',
      category: '疫苗接种',
      dosage: '0.5ml/只',
      priority: 'high'
    },
    {
      id: 'weight_check_14',
      type: 'inspection',
      title: '第二次称重记录',
      description: '记录两周龄体重，与标准对比，评估生长发育',
      category: '健康管理',
      priority: 'medium'
    }
  ],

  // 第15日龄
  15: [
    {
      id: 'feed_control_end_15',
      type: 'feeding',
      title: '控料结束',
      description: '控料期结束，逐步恢复正常饲喂，注意过渡期管理',
      category: '饲养管理',
      priority: 'high'
    }
  ],

  // 第21日龄
  21: [
    {
      id: 'vaccine_booster_21',
      type: 'vaccine',
      title: '小鹅瘟疫苗加强免疫',
      description: '加强免疫，确保抗体水平',
      category: '疫苗接种',
      dosage: '1.5ml/只',
      priority: 'high'
    },
    {
      id: 'weight_check_21',
      type: 'inspection',
      title: '第三次称重记录',
      description: '三周龄体重记录，评估育雏期管理效果',
      category: '健康管理',
      priority: 'medium'
    }
  ],

  // 第28日龄
  28: [
    {
      id: 'transition_feeding_28',
      type: 'feeding',
      title: '育雏期转育成期',
      description: '调整饲料配方，从育雏料过渡到育成料，注意过渡期管理',
      category: '饲养管理',
      priority: 'high'
    },
    {
      id: 'health_inspection_28',
      type: 'inspection',
      title: '月龄健康检查',
      description: '全面健康检查，记录生长数据，淘汰病弱个体',
      category: '健康管理',
      priority: 'high'
    }
  ],

  // 第35日龄
  35: [
    {
      id: 'deworming_35',
      type: 'medication',
      title: '驱虫处理',
      description: '进行体内外驱虫，预防寄生虫病',
      category: '用药管理',
      dosage: '按体重计算用量',
      priority: 'medium'
    }
  ],

  // 第42日龄
  42: [
    {
      id: 'vaccine_3_42',
      type: 'vaccine',
      title: '鹅副黏病毒疫苗',
      description: '预防鹅副黏病毒病',
      category: '疫苗接种',
      dosage: '1ml/只',
      priority: 'high'
    },
    {
      id: 'weight_check_42',
      type: 'inspection',
      title: '六周龄体重记录',
      description: '评估育成期生长情况',
      category: '健康管理',
      priority: 'medium'
    }
  ],

  // 第56日龄
  56: [
    {
      id: 'health_inspection_56',
      type: 'inspection',
      title: '八周龄综合检查',
      description: '全面健康状况评估，准备进入快速生长期',
      category: '健康管理',
      priority: 'high'
    },
    {
      id: 'feed_adjustment_56',
      type: 'feeding',
      title: '饲料配方调整',
      description: '根据生长阶段调整营养配比，提高饲料转化率',
      category: '饲养管理',
      priority: 'medium'
    }
  ],

  // 第70日龄
  70: [
    {
      id: 'pre_market_check_70',
      type: 'inspection',
      title: '出栏前检查',
      description: '评估是否达到出栏标准，制定出栏计划',
      category: '健康管理',
      priority: 'high'
    },
    {
      id: 'weight_check_70',
      type: 'inspection',
      title: '出栏前称重',
      description: '记录出栏体重，计算料肉比',
      category: '健康管理',
      priority: 'high'
    }
  ]
}

// 获取所有任务的辅助函数
export function getAllTasks() {
  const tasks: any[] = []
  
  Object.keys(BREEDING_SCHEDULE_DATA).forEach(dayAge => {
    const dayTasks = (BREEDING_SCHEDULE_DATA as any)[dayAge]
    dayTasks.forEach((task: any) => {
      tasks.push({
        ...task,
        dayAge: parseInt(dayAge)
      })
    })
  })
  
  return tasks
}

// 按日龄分组任务
export function getTasksByDayAge() {
  const groups: any[] = []
  
  Object.keys(BREEDING_SCHEDULE_DATA)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(dayAge => {
      groups.push({
        dayAge: parseInt(dayAge),
        tasks: (BREEDING_SCHEDULE_DATA as any)[dayAge]
      })
    })
  
  return groups
}
