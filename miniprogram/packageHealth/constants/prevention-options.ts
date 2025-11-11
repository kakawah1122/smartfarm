/**
 * 预防管理模块常量配置
 */

import { OptionItem, CommonSupplements } from '../types/prevention'

// 保健类型选项
export const CARE_TYPE_OPTIONS: OptionItem[] = [
  { label: '营养补充', value: 'nutrition', icon: 'food', desc: '维生素、矿物质等营养补充' },
  { label: '环境改善', value: 'environment', icon: 'home', desc: '温度、湿度、通风等环境优化' },
  { label: '免疫增强', value: 'immunity', icon: 'secured', desc: '提高免疫力的保健措施' },
  { label: '生长促进', value: 'growth', icon: 'arrow-up', desc: '促进生长发育的保健方案' }
]

// 给药方式选项
export const METHOD_OPTIONS: OptionItem[] = [
  { label: '饲料添加', value: 'feed' },
  { label: '饮水添加', value: 'water' },
  { label: '喷雾给药', value: 'spray' },
  { label: '环境调节', value: 'environment' }
]

// 效果评估选项
export const EFFECTIVENESS_OPTIONS: OptionItem[] = [
  { label: '优秀', value: 'excellent' },
  { label: '良好', value: 'good' },
  { label: '一般', value: 'fair' },
  { label: '较差', value: 'poor' }
]

// 消毒方法选项
export const DISINFECTION_METHOD_OPTIONS: OptionItem[] = [
  { label: '喷雾消毒', value: 'spray' },
  { label: '熏蒸消毒', value: 'fumigation' },
  { label: '冲洗消毒', value: 'washing' },
  { label: '擦拭消毒', value: 'wiping' }
]

// 天气条件选项
export const WEATHER_OPTIONS: OptionItem[] = [
  { label: '晴天', value: 'sunny' },
  { label: '阴天', value: 'cloudy' },
  { label: '雨天', value: 'rainy' },
  { label: '风天', value: 'windy' }
]

// 给药途径选项
export const ROUTE_OPTIONS: OptionItem[] = [
  { label: '肌肉注射', value: 'muscle' },
  { label: '皮下注射', value: 'subcutaneous' },
  { label: '口服', value: 'oral' },
  { label: '滴鼻', value: 'nasal' }
]

// 常用保健品库
export const COMMON_SUPPLEMENTS: CommonSupplements = {
  nutrition: [
    { name: '维生素C', dosage: '2g/100只', purpose: '增强免疫力' },
    { name: '维生素E', dosage: '1g/100只', purpose: '抗氧化' },
    { name: '复合维生素', dosage: '5g/100只', purpose: '全面营养补充' },
    { name: '电解质', dosage: '10g/100只', purpose: '维持电解质平衡' }
  ],
  environment: [
    { name: '益生菌', dosage: '按说明使用', purpose: '改善肠道环境' },
    { name: '除臭剂', dosage: '适量喷洒', purpose: '改善空气质量' },
    { name: '消毒液', dosage: '1:200稀释', purpose: '环境净化' }
  ],
  immunity: [
    { name: '免疫增强剂', dosage: '3g/100只', purpose: '提高免疫力' },
    { name: '中草药添加剂', dosage: '按配方使用', purpose: '天然免疫调节' },
    { name: '蜂胶', dosage: '0.5g/只', purpose: '抗菌免疫' }
  ],
  growth: [
    { name: '氨基酸', dosage: '5g/100只', purpose: '促进蛋白质合成' },
    { name: '钙磷补充剂', dosage: '3g/100只', purpose: '骨骼发育' },
    { name: '生长因子', dosage: '按说明使用', purpose: '促进生长' }
  ]
}

// 批次数据缓存时长（毫秒）
export const BATCHES_CACHE_DURATION = 5 * 60 * 1000  // 5分钟

// 表单验证防抖延迟（毫秒）
export const VALIDATE_DEBOUNCE_DELAY = 300

