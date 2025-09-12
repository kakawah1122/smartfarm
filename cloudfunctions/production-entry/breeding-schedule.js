// breeding-schedule.js - 养殖任务配置（云函数版本）
// 从前端utils/breeding-schedule.js复制并适配

/**
 * 狮头鹅完整养殖流程任务配置
 * 从1日龄到80日龄的完整周期，前30天为关键防疫期
 */

const BREEDING_SCHEDULE = {
  // 第1日龄：入栏第一天 - 增强抵抗力
  1: [
    {
      id: 'entry_check_1',
      type: 'inspection',
      priority: 'high',
      title: '入栏健康检查',
      description: '检查雏鹅健康状况，记录入栏数量和基本信息',
      category: '健康管理',
      estimatedTime: 60,
      materials: ['体温计', '记录表'],
      notes: '入栏当天必须完成，为后续管理建立基础档案'
    },
    {
      id: 'glucose_water_1',
      type: 'nutrition',
      priority: 'critical',
      title: '3%葡萄糖或红糖水+电解多维',
      description: '饮水给药，增强抵抗力，补充水分，减少应激',
      category: '营养管理',
      estimatedTime: 30,
      materials: ['葡萄糖/红糖', '电解多维', '饮水器'],
      dosage: '3%浓度饮水',
      notes: '必须在入栏当天给予，帮助雏鹅适应新环境'
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
      estimatedTime: 120,
      materials: ['小鹅瘟高免血清', '注射器', '酒精', '棉球'],
      dosage: '每只1.2毫升',
      notes: '必须在2日龄准时接种，这是预防小鹅瘟的关键步骤'
    },
    {
      id: 'opening_medicine_start_2',
      type: 'medication',
      priority: 'high',
      title: '开口药第1天开始',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎',
      category: '用药管理',
      estimatedTime: 45,
      materials: ['开口药', '饮水器'],
      duration: 4,
      dayInSeries: 1,
      dosage: '按说明书使用',
      notes: '连续使用4天，观察弱苗挑出单独饲喂。可促进卵黄吸收，提高成活率'
    }
  ],

  // 第6日龄：重要疫苗接种日
  6: [
    {
      id: 'multiple_vaccine_6',
      type: 'vaccine',
      priority: 'critical',
      title: '第二针：痛风+呼肠孤+小鹅瘟+浆膜炎疫苗',
      description: '晚上做小鹅瘟防疫，做完防疫温度加一度',
      category: '疫苗接种',
      estimatedTime: 150,
      materials: ['四联疫苗', '注射器', '酒精', '棉球', '多维'],
      dosage: '每只1毫升',
      notes: '做完疫苗后观察棚内湿度保持60%以下，小鹅以不扎堆为准。6-8日龄白天饮多维防应激'
    }
  ],

  // 第20日龄：第三针疫苗接种
  20: [
    {
      id: 'third_vaccine_20',
      type: 'vaccine',
      priority: 'critical',
      title: '第三针：副粘+禽流感H9+安卡拉（三联苗）',
      description: '预防流感副黏病毒，当地打针',
      category: '疫苗接种',
      estimatedTime: 180,
      materials: ['三联疫苗', '注射器', '酒精', '棉球', '多维'],
      dosage: '每只1毫升',
      notes: '做完疫苗水中加多维缓解应激。这是非常重要的免疫接种'
    }
  ],

  // 第30日龄：关键防疫期结束
  30: [
    {
      id: 'phase1_summary_30',
      type: 'evaluation',
      priority: 'high',
      title: '第一阶段防疫总结（1-30日龄）',
      description: '总结前30天关键防疫期的管理效果和经验',
      category: '阶段总结',
      estimatedTime: 120,
      materials: ['所有记录表', '计算器', '电脑'],
      notes: '关键防疫期结束，全面总结经验，为后续生长期管理做准备'
    }
  ],

  // 第35日龄：生长期管理
  35: [
    {
      id: 'growth_phase_check_35',
      type: 'evaluation',
      priority: 'medium',
      title: '生长期健康检查',
      description: '进入生长期后的全面健康评估',
      category: '健康管理',
      estimatedTime: 90,
      materials: ['体重秤', '测量工具', '记录表'],
      notes: '评估生长发育状况，调整饲养方案'
    }
  ],

  // 第42日龄：六周龄管理
  42: [
    {
      id: 'six_week_evaluation_42',
      type: 'evaluation',
      priority: 'medium',
      title: '六周龄生长性能评估',
      description: '全面评估六周龄生长性能，调整后期饲养策略',
      category: '生长管理',
      estimatedTime: 90,
      materials: ['天平', '测量工具', '计算器', '记录表'],
      notes: '六周龄重要评估，影响后期饲养决策'
    },
    {
      id: 'deworming_42',
      type: 'medication',
      priority: 'high',
      title: '驱虫处理',
      description: '进行驱虫处理，预防寄生虫感染',
      category: '寄生虫防治',
      estimatedTime: 60,
      materials: ['驱虫药', '饮水器'],
      notes: '定期驱虫是健康养殖的重要环节'
    }
  ],

  // 第70日龄：出栏准备期
  70: [
    {
      id: 'pre_market_health_check_70',
      type: 'inspection',
      priority: 'critical',
      title: '出栏前健康检查',
      description: '全面健康检查，确保符合出栏标准',
      category: '健康管理',
      estimatedTime: 120,
      materials: ['体温计', '听诊器', '记录表'],
      notes: '出栏前必须通过健康检查'
    }
  ],

  // 第80日龄：出栏日
  80: [
    {
      id: 'final_inspection_80',
      type: 'inspection',
      priority: 'critical',
      title: '出栏前最终检查',
      description: '出栏前最后一次全面检查，确保符合出栏条件',
      category: '健康管理',
      estimatedTime: 60,
      materials: ['检查清单', '记录表'],
      notes: '确保每只鹅都符合出栏标准'
    },
    {
      id: 'batch_summary_80',
      type: 'evaluation',
      priority: 'high',
      title: '批次总结报告',
      description: '制作完整的批次养殖总结报告',
      category: '生产管理',
      estimatedTime: 120,
      materials: ['电脑', '所有记录资料'],
      notes: '完整的生产周期总结，为下批次提供经验'
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
