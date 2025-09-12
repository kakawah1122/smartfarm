// breeding-schedule.js - 基于真实CSV数据的完整狮头鹅科学防疫养殖流程
// 数据来源：鼎晶1600只鹅科学防疫养殖流程完美.csv

/**
 * 狮头鹅完整养殖流程任务配置
 * 预防用药程序参考，根据季节和地区适当做变动
 * 从1日龄到80日龄的完整周期，前30天为关键防疫期
 */

// 完整的日龄任务配置
export const BREEDING_SCHEDULE = {
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
      duration: 4, // 连续4天
      dayInSeries: 1,
      dosage: '按说明书使用',
      notes: '连续使用4天，观察弱苗挑出单独饲喂。可促进卵黄吸收，提高成活率'
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
      estimatedTime: 45,
      materials: ['开口药', '饮水器'],
      duration: 4,
      dayInSeries: 2,
      dosage: '按说明书使用',
      notes: '观察雏鹅健康状况，继续筛选弱苗单独管理'
    },
    {
      id: 'weak_chick_care_3',
      type: 'care',
      priority: 'medium',
      title: '弱苗特殊护理',
      description: '对筛选出的弱苗进行单独饲喂和护理',
      category: '特殊护理',
      estimatedTime: 30,
      materials: ['特殊饲料', '小饮水器'],
      notes: '单独管理弱苗，提高整体成活率'
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
      estimatedTime: 45,
      materials: ['开口药', '饮水器'],
      duration: 4,
      dayInSeries: 3,
      dosage: '按说明书使用',
      notes: '继续观察治疗效果，准备明天结束疗程'
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
      estimatedTime: 45,
      materials: ['开口药', '饮水器'],
      duration: 4,
      dayInSeries: 4,
      dosage: '按说明书使用',
      notes: '开口药疗程结束，评估治疗效果'
    },
    {
      id: 'feed_control_start_5',
      type: 'feeding',
      priority: 'critical',
      title: '开始控料（5-15日龄）',
      description: '控料方法：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11, // 从5日龄控到15日龄
      dayInSeries: 1,
      notes: '或全喂青草或玉米面。刚开始一半饲料一半玉米面，逐渐减至全是玉米面'
    }
  ],

  // 第6日龄：重要疫苗接种日
  6: [
    {
      id: 'feed_control_day2_6',
      type: 'feeding',
      priority: 'high',
      title: '控料第2天',
      description: '继续控料管理，主要使用青饲料和玉米面',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 2,
      notes: '控料期间注意雏鹅精神状态'
    },
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
    },
    {
      id: 'stress_prevention_6',
      type: 'medication',
      priority: 'medium',
      title: '多维防应激（6-8日龄）',
      description: '白天饮多维防止疫苗应激反应',
      category: '应激管理',
      estimatedTime: 20,
      materials: ['多维', '饮水器'],
      duration: 3, // 6-8日龄
      dayInSeries: 1,
      notes: '疫苗后必须使用，减少应激反应'
    }
  ],

  // 第7日龄：保肝护肾开始
  7: [
    {
      id: 'feed_control_day3_7',
      type: 'feeding',
      priority: 'high',
      title: '控料第3天',
      description: '继续控料，开始换料，提早用青草',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '青草', '菜叶'],
      duration: 11,
      dayInSeries: 3,
      notes: '开始换料过程，增加青草比例'
    },
    {
      id: 'stress_prevention_day2_7',
      type: 'medication',
      priority: 'medium',
      title: '多维防应激第2天',
      description: '继续白天饮多维防止疫苗应激',
      category: '应激管理',
      estimatedTime: 20,
      materials: ['多维', '饮水器'],
      duration: 3,
      dayInSeries: 2,
      notes: '疫苗后应激管理的重要环节'
    },
    {
      id: 'liver_kidney_protection_7',
      type: 'medication',
      priority: 'high',
      title: '保肝护肾 - 痛清第1天',
      description: '上午集中2小时使用痛清，晚上10点后使用千分之三小苏打通肝肾',
      category: '保健管理',
      estimatedTime: 60,
      materials: ['痛清', '小苏打', '饮水器'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '每天2瓶，上午集中2小时用',
      notes: '喂前大群控水半小时，准备2小时水量，集中2-3小时内饮完。加低蛋白青草或菜叶'
    }
  ],

  // 第8日龄：保肝护肾第2天
  8: [
    {
      id: 'feed_control_day4_8',
      type: 'feeding',
      priority: 'high',
      title: '控料第4天',
      description: '继续控料和换料过程',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '青草', '菜叶'],
      duration: 11,
      dayInSeries: 4,
      notes: '控料期的重要阶段'
    },
    {
      id: 'stress_prevention_day3_8',
      type: 'medication',
      priority: 'medium',
      title: '多维防应激第3天（最后一天）',
      description: '完成疫苗后应激预防',
      category: '应激管理',
      estimatedTime: 20,
      materials: ['多维', '饮水器'],
      duration: 3,
      dayInSeries: 3,
      notes: '疫苗应激预防结束'
    },
    {
      id: 'liver_kidney_protection_day2_8',
      type: 'medication',
      priority: 'high',
      title: '保肝护肾 - 痛清第2天（最后一天）',
      description: '完成2天保肝护肾疗程',
      category: '保健管理',
      estimatedTime: 60,
      materials: ['痛清', '小苏打', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '每天2瓶，总共4瓶',
      notes: '保肝护肾疗程结束，总共使用4瓶痛清'
    }
  ],

  // 第9日龄：呼肠孤病毒预防开始
  9: [
    {
      id: 'feed_control_day5_9',
      type: 'feeding',
      priority: 'high',
      title: '控料第5天',
      description: '继续控料管理',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 5,
      notes: '控料中期阶段'
    },
    {
      id: 'reovirus_prevention_9',
      type: 'medication',
      priority: 'high',
      title: '预防呼肠孤病毒 - 呼肠清第1天',
      description: '上午使用呼肠清预防呼肠孤病毒',
      category: '疾病预防',
      estimatedTime: 45,
      materials: ['呼肠清', '饮水器'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '每天1瓶，连用2天，共2瓶',
      notes: '集中2小时饮水，喂前大群控水半小时，准备2小时水量，集中2-3小时内饮完'
    }
  ],

  // 第10日龄：呼肠孤病毒预防第2天
  10: [
    {
      id: 'feed_control_day6_10',
      type: 'feeding',
      priority: 'high',
      title: '控料第6天',
      description: '继续控料管理',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 6,
      notes: '控料过程中注意观察鹅群状态'
    },
    {
      id: 'reovirus_prevention_day2_10',
      type: 'medication',
      priority: 'high',
      title: '预防呼肠孤病毒 - 呼肠清第2天（最后一天）',
      description: '完成呼肠孤病毒预防疗程',
      category: '疾病预防',
      estimatedTime: 45,
      materials: ['呼肠清', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '第2瓶呼肠清',
      notes: '呼肠孤病毒预防疗程结束'
    }
  ],

  // 第11日龄：控料中期
  11: [
    {
      id: 'feed_control_day7_11',
      type: 'feeding',
      priority: 'high',
      title: '控料第7天',
      description: '控料中期管理',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 7,
      notes: '控料期过半，观察雏鹅适应情况'
    },
    {
      id: 'daily_inspection_11',
      type: 'inspection',
      priority: 'medium',
      title: '日常健康检查',
      description: '检查雏鹅精神状态、食欲、排便等基本健康指标',
      category: '健康管理',
      estimatedTime: 30,
      materials: ['记录表', '体温计'],
      notes: '控料期间要特别关注雏鹅健康状况'
    }
  ],

  // 第12日龄：预防浆膜炎和大肠杆菌
  12: [
    {
      id: 'feed_control_day8_12',
      type: 'feeding',
      priority: 'high',
      title: '控料第8天',
      description: '继续控料管理',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 8,
      notes: '控料后期阶段'
    },
    {
      id: 'serositis_prevention_12',
      type: 'medication',
      priority: 'high',
      title: '预防传染性浆膜炎、大肠杆菌',
      description: '预防痛风、浆膜炎、大肠杆菌、鸭肝等细菌性疾病，缓解疫苗应激',
      category: '疾病预防',
      estimatedTime: 60,
      materials: ['亿消2号', '鸭乐2号', '饮水器', '小苏打'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '亿消2号+鸭乐2号每天半袋，连用2天，共1包',
      notes: '上午集中2-3小时饮用，喂前控水半小时。晚上12点后使用千分之三小苏打通肝肾'
    }
  ],

  // 第13日龄：浆膜炎预防第2天
  13: [
    {
      id: 'feed_control_day9_13',
      type: 'feeding',
      priority: 'high',
      title: '控料第9天',
      description: '继续控料管理',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 9,
      notes: '控料即将结束阶段'
    },
    {
      id: 'serositis_prevention_day2_13',
      type: 'medication',
      priority: 'high',
      title: '预防浆膜炎、大肠杆菌第2天（最后一天）',
      description: '完成细菌性疾病预防疗程',
      category: '疾病预防',
      estimatedTime: 60,
      materials: ['亿消2号', '鸭乐2号', '饮水器', '小苏打'],
      duration: 2,
      dayInSeries: 2,
      dosage: '完成1包用量',
      notes: '浆膜炎预防疗程结束，继续晚上通肝肾'
    }
  ],

  // 第14日龄：控料后期
  14: [
    {
      id: 'feed_control_day10_14',
      type: 'feeding',
      priority: 'high',
      title: '控料第10天',
      description: '控料即将结束',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['青饲料', '玉米面'],
      duration: 11,
      dayInSeries: 10,
      notes: '明天即将结束控料期'
    },
    {
      id: 'health_evaluation_14',
      type: 'evaluation',
      priority: 'medium',
      title: '两周龄健康评估',
      description: '全面评估前14天的健康管理效果',
      category: '健康管理',
      estimatedTime: 60,
      materials: ['记录表', '体重秤'],
      notes: '重要的阶段性健康评估'
    }
  ],

  // 第15日龄：控料最后一天
  15: [
    {
      id: 'feed_control_end_15',
      type: 'feeding',
      priority: 'critical',
      title: '控料第11天（最后一天）',
      description: '控料期结束，准备恢复正常饲料',
      category: '饲养管理',
      estimatedTime: 45,
      materials: ['青饲料', '玉米面', '正常饲料'],
      duration: 11,
      dayInSeries: 11,
      notes: '控料期结束，明天开始正常饲料管理'
    },
    {
      id: 'feed_transition_prep_15',
      type: 'feeding',
      priority: 'high',
      title: '饲料过渡准备',
      description: '为明天恢复正常饲料做准备',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['正常饲料'],
      notes: '准备从控料期过渡到正常饲料期'
    }
  ],

  // 第16日龄：恢复正常饲料，预防病毒性感冒
  16: [
    {
      id: 'normal_feeding_start_16',
      type: 'feeding',
      priority: 'critical',
      title: '恢复正常饲料',
      description: '16日龄开始无需控料，正常喂料',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['正常饲料', '饮水器'],
      notes: '结束控料期，开始正常饲料管理阶段'
    },
    {
      id: 'flu_prevention_16',
      type: 'medication',
      priority: 'high',
      title: '预防病毒性感冒流感',
      description: '预防病毒性感冒流感，防止引起其他病毒性疾病',
      category: '疾病预防',
      estimatedTime: 60,
      materials: ['增强素', '浆速', '饮水器'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '增强素+浆速各1包，共2包',
      notes: '上午集中3小时饮用，喂前大群控水半小时，准备2小时水量，集中2-3小时内饮完'
    }
  ],

  // 第17日龄：病毒性感冒预防第2天
  17: [
    {
      id: 'normal_feeding_day2_17',
      type: 'feeding',
      priority: 'medium',
      title: '正常饲料管理第2天',
      description: '继续正常饲料管理',
      category: '饲养管理',
      estimatedTime: 30,
      materials: ['正常饲料'],
      notes: '适应正常饲料阶段'
    },
    {
      id: 'flu_prevention_day2_17',
      type: 'medication',
      priority: 'high',
      title: '预防病毒性感冒第2天（最后一天）',
      description: '完成病毒性感冒预防疗程',
      category: '疾病预防',
      estimatedTime: 60,
      materials: ['增强素', '浆速', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '完成第2包增强素和浆速',
      notes: '病毒性感冒预防疗程结束'
    }
  ],

  // 第18日龄：预防痛风
  18: [
    {
      id: 'gout_prevention_18',
      type: 'medication',
      priority: 'medium',
      title: '预防痛风',
      description: '预防痛风，处理拉稀情况（黄白便、水便、黑便等）',
      category: '疾病预防',
      estimatedTime: 45,
      materials: ['畅清', '小苏打', '饮水器'],
      dosage: '根据粪便情况决定是否用畅清',
      notes: '小鹅容易出现拉稀，可根据情况投喂畅清。如粪便正常不需要喂，晚上使用千分之三小苏打通肝肾'
    },
    {
      id: 'daily_inspection_18',
      type: 'inspection',
      priority: 'medium',
      title: '粪便检查',
      description: '重点检查粪便颜色和形状，判断是否需要治疗',
      category: '健康管理',
      estimatedTime: 20,
      materials: ['记录表'],
      notes: '观察粪便状态，决定是否需要使用畅清'
    }
  ],

  // 第19日龄：日常管理
  19: [
    {
      id: 'daily_management_19',
      type: 'inspection',
      priority: 'medium',
      title: '日常健康管理',
      description: '常规健康检查和日常管理',
      category: '健康管理',
      estimatedTime: 30,
      materials: ['记录表'],
      notes: '继续观察鹅群健康状况'
    },
    {
      id: 'environment_check_19',
      type: 'environment',
      priority: 'medium',
      title: '环境检查',
      description: '检查鹅舍环境，温度湿度通风情况',
      category: '环境管理',
      estimatedTime: 20,
      materials: ['温湿度计'],
      notes: '确保良好的饲养环境'
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
    },
    {
      id: 'post_vaccine_care_20',
      type: 'medication',
      priority: 'high',
      title: '疫苗后应激管理',
      description: '疫苗接种后多维防应激',
      category: '应激管理',
      estimatedTime: 30,
      materials: ['多维', '饮水器'],
      notes: '疫苗后必须添加多维缓解应激反应'
    }
  ],

  // 第21日龄：预防痛风和感冒
  21: [
    {
      id: 'gout_cold_prevention_21',
      type: 'medication',
      priority: 'medium',
      title: '预防痛风、感冒',
      description: '小鹅放牧易出现感冒情况，观察是否出现甩头流涕咳嗽',
      category: '疾病预防',
      estimatedTime: 45,
      materials: ['亿消2号', '小苏打', '饮水器'],
      dosage: '如有感冒症状可用亿消2号',
      notes: '观察大群是否甩头流涕咳嗽，有症状才用药。晚上使用千分之三小苏打通肝肾'
    },
    {
      id: 'grazing_management_21',
      type: 'environment',
      priority: 'medium',
      title: '放牧管理',
      description: '开始放牧管理，注意防止感冒',
      category: '环境管理',
      estimatedTime: 60,
      materials: ['围栏'],
      notes: '小鹅开始放牧，注意天气变化防止感冒'
    }
  ],

  // 第22日龄：预防呼吸道疾病
  22: [
    {
      id: 'respiratory_prevention_22',
      type: 'medication',
      priority: 'high',
      title: '预防小鹅咳嗽呼噜感冒 - 呼畅第1天',
      description: '此阶段主要预防小鹅咳嗽呼噜感冒',
      category: '疾病预防',
      estimatedTime: 45,
      materials: ['呼畅', '饮水器'],
      duration: 2, // 连喂2天
      dayInSeries: 1,
      dosage: '每天1瓶，连喂2天',
      notes: '下午集中3小时内饮用，喂前大群控水半小时，准备2小时水量'
    }
  ],

  // 第23日龄：呼吸道预防第2天
  23: [
    {
      id: 'respiratory_prevention_day2_23',
      type: 'medication',
      priority: 'high',
      title: '预防咳嗽呼噜感冒 - 呼畅第2天（最后一天）',
      description: '完成呼吸道疾病预防疗程',
      category: '疾病预防',
      estimatedTime: 45,
      materials: ['呼畅', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '第2瓶呼畅',
      notes: '呼吸道疾病预防疗程结束'
    }
  ],

  // 第24日龄：日常管理
  24: [
    {
      id: 'daily_management_24',
      type: 'inspection',
      priority: 'medium',
      title: '日常健康检查',
      description: '常规健康检查，观察鹅群状态',
      category: '健康管理',
      estimatedTime: 30,
      materials: ['记录表'],
      notes: '继续观察鹅群健康状况'
    }
  ],

  // 第25日龄：日常管理
  25: [
    {
      id: 'daily_management_25',
      type: 'inspection',
      priority: 'medium',
      title: '日常健康检查',
      description: '常规健康检查，观察鹅群状态',
      category: '健康管理',
      estimatedTime: 30,
      materials: ['记录表'],
      notes: '准备进入肠炎预防重点期'
    }
  ],

  // 第26日龄：预防肠炎和大杆菌高峰期
  26: [
    {
      id: 'enteritis_prevention_26',
      type: 'medication',
      priority: 'high',
      title: '重点预防肠炎、大杆高峰期 - 肠速清第1天',
      description: '重点预防肠炎，大肠杆菌高峰期',
      category: '疾病预防',
      estimatedTime: 60,
      materials: ['肠速清', '饮水器'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '一天用1包，连用2天，共2包',
      notes: '上午集中3小时饮用，喂前大群控水半小时，准备2小时水量'
    },
    {
      id: 'immune_enhancement_26',
      type: 'medication',
      priority: 'high',
      title: '抗病毒 - 增强素第1天',
      description: '抗病毒，增强免疫力',
      category: '免疫增强',
      estimatedTime: 30,
      materials: ['增强素', '饮水器'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '每天1袋，连用2天，共2袋',
      notes: '配合肠速清一起使用'
    }
  ],

  // 第27日龄：肠炎预防第2天
  27: [
    {
      id: 'enteritis_prevention_day2_27',
      type: 'medication',
      priority: 'high',
      title: '预防肠炎 - 肠速清第2天（最后一天）',
      description: '完成肠炎预防疗程',
      category: '疾病预防',
      estimatedTime: 60,
      materials: ['肠速清', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '第2包肠速清',
      notes: '肠炎预防疗程结束'
    },
    {
      id: 'immune_enhancement_day2_27',
      type: 'medication',
      priority: 'high',
      title: '抗病毒 - 增强素第2天（最后一天）',
      description: '完成免疫增强疗程',
      category: '免疫增强',
      estimatedTime: 30,
      materials: ['增强素', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '第2袋增强素',
      notes: '免疫增强疗程结束'
    }
  ],

  // 第28日龄：日常管理
  28: [
    {
      id: 'monthly_evaluation_28',
      type: 'evaluation',
      priority: 'medium',
      title: '四周龄健康评估',
      description: '全面评估四周龄健康管理效果',
      category: '健康管理',
      estimatedTime: 90,
      materials: ['记录表', '体重秤', '计算器'],
      notes: '重要的月度健康评估，总结前28天管理效果'
    }
  ],

  // 第29日龄：抗病毒治疗
  29: [
    {
      id: 'antiviral_treatment_29',
      type: 'medication',
      priority: 'high',
      title: '抗病毒、流感感冒副黏病毒黄病毒 - 亿消2号第1天',
      description: '抗病毒，预防流感感冒副黏病毒黄病毒',
      category: '病毒防治',
      estimatedTime: 60,
      materials: ['亿消2号', '饮水器'],
      duration: 2, // 连用2天
      dayInSeries: 1,
      dosage: '每天1袋，连用2天，共2袋',
      notes: '喂前大群控水半小时，准备2小时水量，集中2-3小时内饮完'
    }
  ],

  // 第30日龄：抗病毒治疗最后一天，关键防疫期结束
  30: [
    {
      id: 'antiviral_treatment_day2_30',
      type: 'medication',
      priority: 'high',
      title: '抗病毒治疗 - 亿消2号第2天（最后一天）',
      description: '完成抗病毒治疗疗程',
      category: '病毒防治',
      estimatedTime: 60,
      materials: ['亿消2号', '饮水器'],
      duration: 2,
      dayInSeries: 2,
      dosage: '第2袋亿消2号',
      notes: '前30天关键防疫期结束，抗病毒治疗完成'
    },
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
    },
    {
      id: 'feeding_adjustment_35',
      type: 'feeding',
      priority: 'medium',
      title: '饲料调整',
      description: '根据生长情况调整饲料配比和营养结构',
      category: '饲养管理',
      estimatedTime: 45,
      materials: ['生长期饲料', '营养添加剂'],
      notes: '进入快速生长期，优化营养配比'
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

  // 第56日龄：八周龄管理
  56: [
    {
      id: 'eight_week_check_56',
      type: 'inspection',
      priority: 'medium',
      title: '八周龄健康检查',
      description: '检查鹅群健康状况，评估免疫效果',
      category: '健康管理',
      estimatedTime: 60,
      materials: ['记录表', '体温计'],
      notes: '确保鹅群健康，为后期生长做准备'
    },
    {
      id: 'nutrition_optimization_56',
      type: 'feeding',
      priority: 'medium',
      title: '营养配比优化',
      description: '根据生长需要，优化营养配比',
      category: '饲养管理',
      estimatedTime: 40,
      materials: ['饲料', '营养添加剂'],
      notes: '后期营养管理重点是促进优质肉质形成'
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
    },
    {
      id: 'medication_withdrawal_70',
      type: 'medication',
      priority: 'critical',
      title: '停药期管理',
      description: '确认已进入停药期，检查药物残留风险',
      category: '用药管理',
      estimatedTime: 30,
      materials: ['药物使用记录'],
      notes: '确保食品安全，严格执行停药期规定'
    }
  ],

  // 第77日龄：出栏周
  77: [
    {
      id: 'final_weight_measurement_77',
      type: 'evaluation',
      priority: 'high',
      title: '最终体重测量',
      description: '测量出栏体重，统计生长性能数据',
      category: '生长管理',
      estimatedTime: 90,
      materials: ['电子秤', '记录表'],
      notes: '最终生产性能统计'
    },
    {
      id: 'health_certificate_77',
      type: 'documentation',
      priority: 'critical',
      title: '健康证明准备',
      description: '准备出栏健康证明和防疫证明',
      category: '证明文件',
      estimatedTime: 60,
      materials: ['证明文件', '打印机'],
      notes: '出栏必须的法定文件'
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
    },
    {
      id: 'market_preparation_80',
      type: 'logistics',
      priority: 'critical',
      title: '出栏准备工作',
      description: '联系运输，准备装车，清点数量',
      category: '物流管理',
      estimatedTime: 120,
      materials: ['运输笼具', '运输车辆'],
      notes: '确保安全、顺利出栏'
    }
  ]
}

// 任务类型配置（增加了新的类型）
export const TASK_TYPES = {
  inspection: { name: '巡检检查', icon: 'search', color: '#0052D9' },
  vaccine: { name: '疫苗接种', icon: 'service', color: '#00A870' },
  medication: { name: '用药治疗', icon: 'pills', color: '#ED7B2F' },
  feeding: { name: '饲养管理', icon: 'food', color: '#8B5CF6' },
  environment: { name: '环境管理', icon: 'home', color: '#06B6D4' },
  evaluation: { name: '效果评估', icon: 'chart', color: '#EF4444' },
  care: { name: '特殊护理', icon: 'heart', color: '#F59E0B' },
  monitoring: { name: '观察监测', icon: 'view', color: '#10B981' },
  documentation: { name: '文件准备', icon: 'file', color: '#6366F1' },
  logistics: { name: '物流管理', icon: 'car', color: '#8B5A2B' },
  nutrition: { name: '营养管理', icon: 'add', color: '#22C55E' },
  disinfection: { name: '消毒防疫', icon: 'clean', color: '#F97316' },
  deworming: { name: '驱虫处理', icon: 'bug', color: '#A855F7' }
}

// 优先级配置
export const PRIORITY_LEVELS = {
  critical: { name: '关键', color: '#EF4444', weight: 4 },
  high: { name: '高', color: '#F59E0B', weight: 3 },
  medium: { name: '中', color: '#0052D9', weight: 2 },
  low: { name: '低', color: '#9CA3AF', weight: 1 }
}

// 获取指定日龄的任务
export function getTasksByAge(dayAge) {
  return BREEDING_SCHEDULE[dayAge] || []
}

// 获取日期范围内的任务
export function getTasksByAgeRange(startAge, endAge) {
  const tasks = []
  for (let age = startAge; age <= endAge; age++) {
    const dayTasks = getTasksByAge(age)
    if (dayTasks.length > 0) {
      tasks.push({
        dayAge: age,
        tasks: dayTasks
      })
    }
  }
  return tasks
}

// 获取今日任务（基于批次入栏时间计算）
export function getTodayTasks(batchStartDate) {
  // 只比较日期部分，不考虑具体时间
  const today = new Date()
  const todayDateStr = today.toISOString().split('T')[0] // YYYY-MM-DD
  
  // 确保入栏日期也是 YYYY-MM-DD 格式
  const entryDateStr = batchStartDate.split('T')[0] // 移除可能的时间部分
  
  const todayDate = new Date(todayDateStr + 'T00:00:00')
  const entryDate = new Date(entryDateStr + 'T00:00:00')
  
  // 计算日期差异
  const diffTime = todayDate.getTime() - entryDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const dayAge = diffDays + 1 // 入栏当天为第1日龄
  
  console.log('日龄计算:', `入栏:${entryDateStr}, 今日:${todayDateStr}, 日龄:${dayAge}, 任务:${getTasksByAge(dayAge).length}个`)
  
  return {
    dayAge: dayAge,
    tasks: getTasksByAge(dayAge)
  }
}

// 获取即将到来的任务（未来7天）
export function getUpcomingTasks(batchStartDate, days = 7) {
  // 使用与 getTodayTasks 相同的日龄计算逻辑
  const today = new Date()
  const todayDateStr = today.toISOString().split('T')[0]
  const entryDateStr = batchStartDate.split('T')[0]
  
  const todayDate = new Date(todayDateStr + 'T00:00:00')
  const entryDate = new Date(entryDateStr + 'T00:00:00')
  
  const diffTime = todayDate.getTime() - entryDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const currentDayAge = diffDays + 1
  
  return getTasksByAgeRange(currentDayAge, currentDayAge + days - 1)
}

// 检查任务是否有重叠
export function checkTaskOverlaps(dayAge) {
  const tasks = getTasksByAge(dayAge)
  const overlaps = []
  
  // 检查是否有连续任务的重叠
  tasks.forEach(task => {
    if (task.duration && task.dayInSeries) {
      const startAge = dayAge - task.dayInSeries + 1
      const endAge = startAge + task.duration - 1
      if (endAge > dayAge) {
        overlaps.push({
          taskId: task.id,
          type: 'continuous',
          message: `此任务是${task.duration}天连续任务的第${task.dayInSeries}天`
        })
      }
    }
  })
  
  return overlaps
}

// 生成任务提醒文本
export function generateTaskReminder(task, dayAge) {
  const typeInfo = TASK_TYPES[task.type]
  const priorityInfo = PRIORITY_LEVELS[task.priority]
  
  let reminder = `【${typeInfo.name}】${task.title}\n`
  
  if (task.duration && task.dayInSeries) {
    reminder += `⚠️ 连续任务：第${task.dayInSeries}/${task.duration}天\n`
  }
  
  if (task.dosage) {
    reminder += `💊 用量：${task.dosage}\n`
  }
  
  if (task.estimatedTime) {
    reminder += `⏱️ 预计用时：${task.estimatedTime}分钟\n`
  }
  
  reminder += `📝 ${task.description}\n`
  
  if (task.notes) {
    reminder += `💡 注意：${task.notes}`
  }
  
  return reminder
}

// 获取药物成本统计（基于CSV中的价格信息）
export const MEDICATION_COSTS = {
  '呼肠清': { price: 95, unit: '瓶' },
  '亿消2号': { price: 160, unit: '包' },
  '鸭乐二号': { price: 140, unit: '包' },
  '呼畅': { price: 60, unit: '瓶' },
  '肠速清': { price: 95, unit: '包' },
  '痛清': { price: 95, unit: '瓶' },
  '增强素': { price: 120, unit: '包' },
  '浆速': { price: 150, unit: '包' }
}

// 计算预估用药成本
export function calculateMedicationCost(dayAge) {
  const tasks = getTasksByAge(dayAge)
  let totalCost = 0
  
  tasks.forEach(task => {
    if (task.materials) {
      task.materials.forEach(material => {
        const costInfo = MEDICATION_COSTS[material]
        if (costInfo) {
          totalCost += costInfo.price
        }
      })
    }
  })
  
  return totalCost
}