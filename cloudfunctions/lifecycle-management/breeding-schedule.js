// breeding-schedule.js - 清洁版本，只包含必要字段
const BREEDING_SCHEDULE = {
  // 第1日龄：入栏第一天
  1: [
    {
      id: 'entry_check_1',
      type: 'inspection',
      title: '入栏健康检查',
      description: '检查雏鹅健康状况，记录入栏数量和基本信息',
      category: '健康管理'
    },
    {
      id: 'glucose_water_1',
      type: 'nutrition',
      title: '3%葡萄糖或红糖水+电解多维',
      description: '饮水给药，增强抵抗力，补充水分，减少应激',
      category: '营养管理',
      dosage: '3%浓度饮水'
    },
    {
      id: 'weak_chick_care_1',
      type: 'care',
      title: '弱苗特殊护理',
      description: '识别并筛选出体质较弱的雏鹅，准备单独护理',
      category: '特殊护理'
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
      dosage: '1.2ml/只'
    },
    {
      id: 'opening_medicine_start_2',
      type: 'medication',
      title: '开口药第一天',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎。预防腺胃炎肌胃炎，促进卵黄吸收，增强食欲，提高抗病能力',
      category: '用药管理',
      duration: 4,
      dayInSeries: 1,
      dosage: '按说明书使用'
    },
    {
      id: 'weak_chick_care_2',
      type: 'care',
      title: '弱苗特殊护理',
      description: '对体质较弱的雏鹅进行单独饲喂和护理，观察开口药反应',
      category: '特殊护理'
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
      dosage: '按说明书使用'
    },
    {
      id: 'weak_chick_care_3',
      type: 'care',
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
      title: '开口药第3天',
      description: '预防雏鹅沙门氏菌、大肠杆菌等引起的雏鹅脐炎、脐孔愈合不良、心包积液、腹水、肝周炎。预防腺胃炎肌胃炎，促进卵黄吸收，增强食欲，提高抗病能力',
      category: '用药管理',
      duration: 4,
      dayInSeries: 3,
      dosage: '按说明书使用'
    },
    {
      id: 'weak_chick_care_4',
      type: 'care',
      title: '弱苗特殊护理',
      description: '继续对弱苗进行单独饲喂和护理，重点关注体重增长情况',
      category: '特殊护理'
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
      dosage: '按说明书使用'
    },
    {
      id: 'feed_control_start_5',
      type: 'feeding',
      title: '开始控料（5-15日龄）',
      description: '控料方法：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或者全喂青草或者玉米面（刚开始可以一半饲料一半玉米面，逐渐减至全是玉米面就可以）',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 1
    },
    {
      id: 'weak_chick_care_5',
      type: 'care',
      title: '弱苗特殊护理',
      description: '弱苗在控料期间需要特别关注，确保营养充足，必要时延缓控料',
      category: '特殊护理'
    }
  ],

  // 第6日龄：重要疫苗日
  6: [
    {
      id: 'goose_plague_vaccine_2_6',
      type: 'vaccine',
      title: '小鹅瘟防疫第二针',
      description: '痛风+呼肠孤+小鹅瘟疫苗+浆膜炎注射',
      category: '疫苗接种',
      dosage: '每只1毫升',
      notes: '晚上接种，做完防疫温度加一度，观察棚内湿度,保持60%以下,小鹅以不扎堆为准,湿度超过60%需要边通风边升温(通风不要直吹)'
    },
    {
      id: 'feed_control_continue_6',
      type: 'feeding',
      title: '控料管理（第2天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 2
    },
    {
      id: 'multivitamin_stress_6',
      type: 'medication',
      title: '多维防应激',
      description: '白天饮多维防止疫苗应激',
      category: '营养管理'
    },
    {
      id: 'weak_chick_care_6',
      type: 'care',
      title: '弱苗特殊护理',
      description: '弱苗在控料期间需要特别关注，确保营养充足，必要时延缓控料',
      category: '特殊护理'
    }
  ],

  // 第7日龄：保肝护肾开始
  7: [
    {
      id: 'liver_kidney_protection_7',
      type: 'medication',
      title: '保肝护肾（痛清）第1天',
      description: '开始换料，提早用青草',
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完',
      category: '用药管理',
      dosage: '痛清每天2瓶',
      duration: 2,
      dayInSeries: 1
    },
    {
      id: 'feed_control_continue_7',
      type: 'feeding',
      title: '控料管理（第3天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 3
    },
    {
      id: 'multivitamin_stress_7',
      type: 'medication',
      title: '多维防应激',
      description: '白天饮多维防止疫苗应激',
      category: '营养管理'
    },
    {
      id: 'baking_soda_night_7',
      type: 'medication',
      title: '晚上小苏打通肝肾',
      description: '晚上10点以后使用千分之三小苏打通肝肾，加低蛋白的青草或菜叶',
      category: '用药管理',
      dosage: '千分之三浓度'
    }
  ],

  // 第8日龄：保肝护肾第2天
  8: [
    {
      id: 'liver_kidney_protection_8',
      type: 'medication',
      title: '保肝护肾（痛清）第2天',
      description: '继续痛清治疗',
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完',
      category: '用药管理',
      dosage: '痛清每天2瓶',
      duration: 2,
      dayInSeries: 2
    },
    {
      id: 'feed_control_continue_8',
      type: 'feeding',
      title: '控料管理（第4天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 4
    },
    {
      id: 'multivitamin_stress_8',
      type: 'medication',
      title: '多维防应激',
      description: '白天饮多维防止疫苗应激',
      category: '营养管理'
    },
    {
      id: 'baking_soda_night_8',
      type: 'medication',
      title: '晚上小苏打通肝肾',
      description: '晚上10点以后使用千分之三小苏打通肝肾，加低蛋白的青草或菜叶',
      category: '用药管理',
      dosage: '千分之三浓度'
    }
  ],

  // 第9日龄：预防呼肠孤病毒第1天
  9: [
    {
      id: 'reovirus_prevention_9',
      type: 'medication',
      title: '预防呼肠孤病毒第1天',
      description: '上午用呼肠清预防呼肠孤病毒',
      category: '用药管理',
      dosage: '呼肠清每天1瓶',
      duration: 2,
      dayInSeries: 1,
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完'
    },
    {
      id: 'feed_control_continue_9',
      type: 'feeding',
      title: '控料管理（第5天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 5
    }
  ],

  // 第10日龄：预防呼肠孤病毒第2天
  10: [
    {
      id: 'reovirus_prevention_10',
      type: 'medication',
      title: '预防呼肠孤病毒第2天',
      description: '继续上午用呼肠清预防呼肠孤病毒',
      category: '用药管理',
      dosage: '呼肠清每天1瓶',
      duration: 2,
      dayInSeries: 2,
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完'
    },
    {
      id: 'feed_control_continue_10',
      type: 'feeding',
      title: '控料管理（第6天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 6
    }
  ],

  // 第11日龄：控料管理
  11: [
    {
      id: 'feed_control_continue_11',
      type: 'feeding',
      title: '控料管理（第7天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 7
    }
  ],

  // 第12日龄：预防浆膜炎等细菌性疾病
  12: [
    {
      id: 'bacterial_prevention_12',
      type: 'medication',
      title: '预防浆膜炎等细菌性疾病',
      description: '预防传染性浆膜炎、大肠杆菌、鸭肝等细菌性疾病，缓解疫苗应激、促进抗体形成',
      category: '用药管理',
      dosage: '亿消2号+鸭乐2号每天半袋',
      duration: 2,
      dayInSeries: 1,
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完'
    },
    {
      id: 'feed_control_continue_12',
      type: 'feeding',
      title: '控料管理（第8天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 8
    },
    {
      id: 'baking_soda_night_12',
      type: 'medication',
      title: '晚上小苏打通肝肾',
      description: '晚上12点以后使用千分之三小苏打通肝肾',
      category: '用药管理',
      dosage: '千分之三浓度'
    }
  ],

  // 第13日龄：继续细菌性疾病预防
  13: [
    {
      id: 'bacterial_prevention_13',
      type: 'medication',
      title: '预防浆膜炎等细菌性疾病第2天',
      description: '继续预防传染性浆膜炎、大肠杆菌、鸭肝等细菌性疾病',
      category: '用药管理',
      dosage: '亿消2号+鸭乐2号每天半袋',
      duration: 2,
      dayInSeries: 2,
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完'
    },
    {
      id: 'feed_control_continue_13',
      type: 'feeding',
      title: '控料管理（第9天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 9
    }
  ],

  // 第14日龄：控料管理
  14: [
    {
      id: 'feed_control_continue_14',
      type: 'feeding',
      title: '控料管理（第10天）',
      description: '继续控料：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 10
    }
  ],

  // 第15日龄：控料最后一天
  15: [
    {
      id: 'feed_control_end_15',
      type: 'feeding',
      title: '控料管理（最后一天）',
      description: '控料期最后一天：加青饲料、不用豆饼等蛋白饲料、晚上12:00以后停掉饲料或全喂青草或玉米面',
      category: '饲养管理',
      duration: 11,
      dayInSeries: 11
    }
  ],

  // 第16日龄：停止控料，预防病毒性感冒
  16: [
    {
      id: 'viral_prevention_16',
      type: 'medication',
      title: '预防病毒性感冒流感',
      description: '预防病毒性感冒流感，以防引起其他病毒性疾病',
      category: '用药管理',
      dosage: '增强素每天1包，浆速每天1包',
      duration: 2,
      dayInSeries: 1,
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完'
    },
    {
      id: 'feed_normal_start_16',
      type: 'feeding',
      title: '停止控料，恢复正常喂料',
      description: '16日龄开始无需控料，正常喂料就可以',
      category: '饲养管理',
      notes: '控料期结束，开始正常饲养管理'
    }
  ],

  // 第17日龄：病毒性感冒预防第2天
  17: [
    {
      id: 'viral_prevention_17',
      type: 'medication',
      title: '预防病毒性感冒流感第2天',
      description: '继续预防病毒性感冒流感，以防引起其他病毒性疾病',
      category: '用药管理',
      dosage: '增强素每天1包，浆速每天1包',
      duration: 2,
      dayInSeries: 2,
      notes: '喂之前大群控水半小时左右,然后准备2小时水量,集中2-3小时内饮完'
    }
  ],

  // 第18日龄：预防痛风
  18: [
    {
      id: 'gout_prevention_18',
      type: 'medication',
      title: '预防痛风',
      description: '预防痛风',
      category: '用药管理',
      dosage: '/',
      notes: '此时小鹅容易出现拉稀的情况(黄白便水便黑便等),可根据情况投喂畅清,如果粪便正常不需要喂'
    },
    {
      id: 'baking_soda_night_18',
      type: 'medication',
      title: '晚上小苏打通肝肾',
      description: '晚上使用千分之三小苏打通肝肾',
      category: '用药管理',
      dosage: '千分之三浓度'
    }
  ],

  // 第19日龄：预防痛风
  19: [
    {
      id: 'gout_prevention_19',
      type: 'medication',
      title: '预防痛风',
      description: '预防痛风',
      category: '用药管理',
      dosage: '/',
      notes: '此时小鹅容易出现拉稀的情况(黄白便水便黑便等),可根据情况投喂畅清,如果粪便正常不需要喂'
    },
    {
      id: 'baking_soda_night_19',
      type: 'medication',
      title: '晚上小苏打通肝肾',
      description: '晚上使用千分之三小苏打通肝肾',
      category: '用药管理',
      dosage: '千分之三浓度'
    }
  ],

  // 第20日龄：第三针疫苗
  20: [
    {
      id: 'third_vaccine_20',
      type: 'vaccine',
      title: '第三针疫苗',
      description: '副粘+禽流感H9+安卡拉（三联苗）注射',
      category: '疫苗接种',
      dosage: '每只1毫升',
      notes: '做完疫苗水中加多维缓解应激'
    },
    {
      id: 'multivitamin_stress_20',
      type: 'medication',
      title: '多维缓解疫苗应激',
      description: '做完疫苗水中加多维缓解应激',
      category: '营养管理',
      dosage: '按说明书使用'
    }
  ],

  // 第21日龄：预防痛风、感冒
  21: [
    {
      id: 'gout_cold_prevention_21',
      type: 'medication',
      title: '预防痛风、感冒',
      description: '预防痛风',
      category: '用药管理',
      dosage: '/',
      notes: '小鹅放牧易出现感冒情况,观察一下大群是否出现甩头流涕咳嗽的情况,如果有的话可以喂亿消2号,没有的话就不用喂,'
    },
    {
      id: 'baking_soda_night_21',
      type: 'medication',
      title: '晚上小苏打通肝肾',
      description: '晚上使用千分之三小苏打通肝肾',
      category: '用药管理',
      dosage: '千分之三浓度'
    }
  ],

  // 第22日龄：预防呼吸道疾病第1天
  22: [
    {
      id: 'respiratory_prevention_22',
      type: 'medication',
      title: '预防小鹅咳嗽呼噜感冒第1天',
      description: '此阶段主要是预防小鹅咳嗽呼噜感冒',
      category: '用药管理',
      dosage: '呼畅每天1瓶，连喂2天，下午集中3小时内饮用',
      duration: 2,
      dayInSeries: 1,
      notes: '喂之前大群控水半小时左右，然后准备2小时水量'
    }
  ],

  // 第23日龄：预防呼吸道疾病第2天
  23: [
    {
      id: 'respiratory_prevention_23',
      type: 'medication',
      title: '预防小鹅咳嗽呼噜感冒第2天',
      description: '继续预防小鹅咳嗽呼噜感冒',
      category: '用药管理',
      dosage: '呼畅每天1瓶，下午集中3小时内饮用',
      duration: 2,
      dayInSeries: 2,
      notes: '喂之前大群控水半小时左右，然后准备2小时水量'
    }
  ],

  // 第24日龄：观察期
  24: [
    {
      id: 'observation_24',
      type: 'care',
      title: '健康观察',
      description: '观察小鹅健康状况，重点关注呼吸道症状',
      category: '健康管理'
    }
  ],

  // 第25日龄：观察期
  25: [
    {
      id: 'observation_25',
      type: 'care',
      title: '健康观察',
      description: '观察小鹅健康状况，为肠炎预防做准备',
      category: '健康管理'
    }
  ],

  // 第26日龄：预防肠炎第1天
  26: [
    {
      id: 'enteritis_prevention_26',
      type: 'medication',
      title: '重点预防肠炎（大杆高峰期）第1天',
      description: '重点预防肠炎，大杆高峰期',
      category: '用药管理',
      dosage: '肠速清一天用1包',
      duration: 2,
      dayInSeries: 1,
      notes: '喂之前大群控水半小时左右，然后准备2小时水量'
    }
  ],

  // 第27日龄：预防肠炎第2天
  27: [
    {
      id: 'enteritis_prevention_27',
      type: 'medication',
      title: '重点预防肠炎（大杆高峰期）第2天',
      description: '继续重点预防肠炎，大杆高峰期',
      category: '用药管理',
      dosage: '肠速清一天用1包',
      duration: 2,
      dayInSeries: 2,
      notes: '喂之前大群控水半小时左右，然后准备2小时水量'
    }
  ],

  // 第28日龄：观察期
  28: [
    {
      id: 'observation_28',
      type: 'care',
      title: '健康观察',
      description: '观察小鹅健康状况，重点关注肠道健康',
      category: '健康管理'
    }
  ],

  // 第29日龄：抗病毒、流感感冒预防第1天
  29: [
    {
      id: 'viral_flu_prevention_29',
      type: 'medication',
      title: '抗病毒、流感感冒副黏病毒黄病毒第1天',
      description: '抗病毒，流感感冒副黏病毒黄病毒',
      category: '用药管理',
      dosage: '亿消2号每天1袋，连用2天',
      duration: 2,
      dayInSeries: 1,
      notes: '喂之前大群控水半小时左右，然后准备2小时水量，集中2-3小时内饮完'
    }
  ],

  // 第30日龄：抗病毒、流感感冒预防第2天
  30: [
    {
      id: 'viral_flu_prevention_30',
      type: 'medication',
      title: '抗病毒、流感感冒副黏病毒黄病毒第2天',
      description: '继续抗病毒，流感感冒副黏病毒黄病毒',
      category: '用药管理',
      dosage: '亿消2号每天1袋',
      duration: 2,
      dayInSeries: 2,
      notes: '喂之前大群控水半小时左右，然后准备2小时水量，集中2-3小时内饮完'
    }
  ],

  // 第31-40日龄：青年期管理
  31: [{ id: 'youth_management_31', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  32: [{ id: 'youth_management_32', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  33: [{ id: 'youth_management_33', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  34: [{ id: 'youth_management_34', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  35: [{ id: 'youth_management_35', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  36: [{ id: 'youth_management_36', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  37: [{ id: 'youth_management_37', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  38: [{ id: 'youth_management_38', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  39: [{ id: 'youth_management_39', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],
  40: [{ id: 'youth_management_40', type: 'care', title: '青年期日常管理', description: '重点观察鹅群健康状况，做好日常饲喂管理', category: '健康管理' }],

  // 第41-50日龄：中期管理
  41: [{ id: 'mid_management_41', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  42: [{ id: 'mid_management_42', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  43: [{ id: 'mid_management_43', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  44: [{ id: 'mid_management_44', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  45: [{ id: 'mid_management_45', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  46: [{ id: 'mid_management_46', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  47: [{ id: 'mid_management_47', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  48: [{ id: 'mid_management_48', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  49: [{ id: 'mid_management_49', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],
  50: [{ id: 'mid_management_50', type: 'care', title: '中期日常管理', description: '观察鹅群生长发育状况，适时调整饲料配方', category: '饲养管理' }],

  // 第51-60日龄：后期管理
  51: [{ id: 'late_management_51', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  52: [{ id: 'late_management_52', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  53: [{ id: 'late_management_53', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  54: [{ id: 'late_management_54', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  55: [{ id: 'late_management_55', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  56: [{ id: 'late_management_56', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  57: [{ id: 'late_management_57', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  58: [{ id: 'late_management_58', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  59: [{ id: 'late_management_59', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],
  60: [{ id: 'late_management_60', type: 'care', title: '后期日常管理', description: '重点关注鹅群体重增长，预防疾病发生', category: '健康管理' }],

  // 第61-70日龄：育成期管理
  61: [{ id: 'growth_management_61', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  62: [{ id: 'growth_management_62', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  63: [{ id: 'growth_management_63', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  64: [{ id: 'growth_management_64', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  65: [{ id: 'growth_management_65', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  66: [{ id: 'growth_management_66', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  67: [{ id: 'growth_management_67', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  68: [{ id: 'growth_management_68', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  69: [{ id: 'growth_management_69', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],
  70: [{ id: 'growth_management_70', type: 'care', title: '育成期日常管理', description: '关注鹅群整体发育情况，做好环境卫生管理', category: '环境管理' }],

  // 第71-80日龄：成熟期管理
  71: [{ id: 'mature_management_71', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  72: [{ id: 'mature_management_72', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  73: [{ id: 'mature_management_73', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  74: [{ id: 'mature_management_74', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  75: [{ id: 'mature_management_75', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  76: [{ id: 'mature_management_76', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  77: [{ id: 'mature_management_77', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  78: [{ id: 'mature_management_78', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  79: [{ id: 'mature_management_79', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }],
  80: [{ id: 'mature_management_80', type: 'care', title: '成熟期日常管理', description: '评估鹅群成长情况，准备出栏或转入产蛋期管理', category: '成熟期管理' }]
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
