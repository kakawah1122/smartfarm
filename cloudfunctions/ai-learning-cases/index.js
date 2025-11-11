// 云函数：AI学习案例管理（多特征融合版）
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  
  try {
    switch (action) {
      case 'save_case':
        return await saveCase(event)
      case 'get_similar_cases':
        return await getSimilarCases(event)
      case 'get_stats':
        return await getStats(event)
      case 'update_threshold':
        return await updateThreshold(event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (error) {
    console.error('AI学习案例云函数错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 保存学习案例（升级版：包含特征分布）
async function saveCase(event) {
  const {
    imageFileID,
    aiCount,
    correctCount,
    sceneFeatures,
    featureBreakdown,
    operator
  } = event
  
  // 验证必需参数
  if (!imageFileID || aiCount === undefined || correctCount === undefined) {
    throw new Error('缺少必需参数')
  }
  
  // 计算准确率和偏差
  const accuracy = correctCount > 0 ? aiCount / correctCount : 0
  const deviation = aiCount - correctCount
  const deviationType = deviation > 0 ? 'over_count' : (deviation < 0 ? 'under_count' : 'accurate')
  
  // 分析偏差原因（基于特征分布）
  let errorAnalysis = {}
  if (featureBreakdown && deviation !== 0) {
    const total = aiCount || 1
    errorAnalysis = {
      tier1_ratio: (featureBreakdown.tier1_complete || 0) / total,
      tier2_ratio: (featureBreakdown.tier2_partial || 0) / total,
      tier3_ratio: (featureBreakdown.tier3_inferred || 0) / total,
      possible_reason: analyzePossibleReason(featureBreakdown, deviation)
    }
  }
  
  // 保存案例
  const caseData = {
    imageFileID,
    aiCount,
    correctCount,
    accuracy,
    deviation,
    deviationType,
    
    // 场景特征（扩展）
    sceneFeatures: {
      lighting: sceneFeatures?.lighting || 'unknown',
      crowding: sceneFeatures?.crowding || 'unknown',
      occlusion_level: sceneFeatures?.occlusion_level || 'unknown',
      imageQuality: sceneFeatures?.imageQuality || 'unknown'
    },
    
    // 特征分布
    featureBreakdown: featureBreakdown || {
      tier1_complete: 0,
      tier2_partial: 0,
      tier3_inferred: 0,
      excluded_lowConfidence: 0
    },
    
    // 错误分析
    errorAnalysis,
    
    // 元数据
    operator: operator || '未知',
    createTime: db.serverDate(),
    used: false,
    useCount: 0
  }
  
  const result = await db.collection(COLLECTIONS.AI_LEARNING_CASES).add({
    data: caseData
  })
  
  return {
    success: true,
    caseId: result._id,
    message: '学习案例保存成功'
  }
}

// 分析可能的错误原因
function analyzePossibleReason(featureBreakdown, deviation) {
  const { tier1_complete, tier2_partial, tier3_inferred, excluded_lowConfidence } = featureBreakdown
  const total = tier1_complete + tier2_partial + tier3_inferred
  
  if (deviation > 0) {
    // AI识别偏高
    if (tier3_inferred / total > 0.3) {
      return 'tier3特征推断过于激进，建议提高阈值'
    } else if (tier2_partial / total > 0.4) {
      return 'tier2部分遮挡判断偏宽松，建议提高置信度要求'
    } else {
      return '可能存在重复计数或误判，检查空间关联检测'
    }
  } else if (deviation < 0) {
    // AI识别偏低
    if (excluded_lowConfidence > 3) {
      return 'tier2/tier3阈值过于严格，遗漏了遮挡个体，建议降低阈值'
    } else if (tier2_partial / total < 0.2 && tier3_inferred / total < 0.1) {
      return '遮挡识别能力不足，建议加强tier2/tier3特征检测'
    } else {
      return '可能遗漏了完整个体，建议加强tier1特征检测'
    }
  } else {
    return '识别准确'
  }
}

// 获取相似场景案例（用于Few-shot Learning）
async function getSimilarCases(event) {
  const { sceneFeatures, limit = 2 } = event
  
  // 构建查询条件（相似场景）
  const query = {
    accuracy: _.gte(0.9), // 只选择准确率>90%的案例
    used: _.neq(true),     // 避免重复使用相同案例
  }
  
  // 如果提供了场景特征，优先匹配相似场景
  if (sceneFeatures?.crowding) {
    query['sceneFeatures.crowding'] = sceneFeatures.crowding
  }
  
  if (sceneFeatures?.occlusion_level) {
    query['sceneFeatures.occlusion_level'] = sceneFeatures.occlusion_level
  }
  
  // 查询案例
  const casesResult = await db.collection(COLLECTIONS.AI_LEARNING_CASES)
    .where(query)
    .orderBy('createTime', 'desc')
    .limit(limit * 2) // 多查询一些，筛选后返回
    .get()
  
  if (casesResult.data.length === 0) {
    // 如果没有完全匹配的案例，放宽条件
    const fallbackResult = await db.collection(COLLECTIONS.AI_LEARNING_CASES)
      .where({
        accuracy: _.gte(0.85)
      })
      .orderBy('accuracy', 'desc')
      .limit(limit)
      .get()
    
    if (fallbackResult.data.length === 0) {
      return {
        success: true,
        examples: [],
        message: '暂无学习案例'
      }
    }
    
    casesResult.data = fallbackResult.data
  }
  
  // 格式化案例为Few-shot格式
  const examples = casesResult.data.slice(0, limit).map((c, index) => {
    const lesson = generateLesson(c)
    return {
      exampleId: index + 1,
      scene: formatScene(c.sceneFeatures),
      aiRecognized: c.aiCount,
      actualCount: c.correctCount,
      featureBreakdown: c.featureBreakdown,
      lesson: lesson,
      thresholdAdjustment: c.errorAnalysis?.possible_reason || ''
    }
  })
  
  // 标记案例已使用
  const caseIds = casesResult.data.slice(0, limit).map(c => c._id)
  if (caseIds.length > 0) {
    await db.collection(COLLECTIONS.AI_LEARNING_CASES)
      .where({
        _id: _.in(caseIds)
      })
      .update({
        data: {
          used: true,
          useCount: _.inc(1)
        }
      })
  }
  
  return {
    success: true,
    examples,
    count: examples.length
  }
}

// 生成教训说明
function generateLesson(caseData) {
  const { deviation, featureBreakdown, errorAnalysis } = caseData
  
  if (deviation === 0) {
    return '识别准确，保持当前策略'
  }
  
  const { tier1_complete, tier2_partial, tier3_inferred } = featureBreakdown
  const total = tier1_complete + tier2_partial + tier3_inferred
  
  if (deviation > 0) {
    // AI偏高
    if (tier3_inferred > 0 && tier3_inferred / total > 0.25) {
      return `识别偏高${Math.abs(deviation)}只，tier3特征推断可能过于激进（${tier3_inferred}/${total}）`
    } else {
      return `识别偏高${Math.abs(deviation)}只，可能误判或重复计数，需要更严格的验证`
    }
  } else {
    // AI偏低
    if (featureBreakdown.excluded_lowConfidence > 2) {
      return `识别偏低${Math.abs(deviation)}只，排除了${featureBreakdown.excluded_lowConfidence}个低置信度个体，可能阈值过严`
    } else {
      return `识别偏低${Math.abs(deviation)}只，遗漏了部分遮挡个体，tier2/tier3识别不足`
    }
  }
}

// 格式化场景描述
function formatScene(sceneFeatures) {
  const { crowding, occlusion_level, lighting } = sceneFeatures
  return `${crowding || '未知'}密度，${occlusion_level || '未知'}遮挡，${lighting || '未知'}光线`
}

// 获取学习统计
async function getStats(event) {
  const stats = await db.collection(COLLECTIONS.AI_LEARNING_CASES)
    .aggregate()
    .group({
      _id: null,
      totalCases: _.$.sum(1),
      averageAccuracy: _.$.avg('$accuracy'),
      accurateCases: _.$.sum(
        _.$.cond({
          if: _.$.eq(['$deviation', 0]),
          then: 1,
          else: 0
        })
      )
    })
    .end()
  
  return {
    success: true,
    stats: stats.list[0] || {
      totalCases: 0,
      averageAccuracy: 0,
      accurateCases: 0
    }
  }
}

// 动态阈值更新（根据历史案例）
async function updateThreshold(event) {
  // 分析最近的案例
  const recentCases = await db.collection(COLLECTIONS.AI_LEARNING_CASES)
    .orderBy('createTime', 'desc')
    .limit(20)
    .get()
  
  if (recentCases.data.length === 0) {
    return {
      success: true,
      message: '案例不足，使用默认阈值',
      thresholds: {
        tier2: 0.70,
        tier3: 0.70
      }
    }
  }
  
  // 统计偏差类型
  let overCount = 0
  let underCount = 0
  let tier2Issues = 0
  let tier3Issues = 0
  
  recentCases.data.forEach(c => {
    if (c.deviation > 0) {
      overCount++
      if (c.errorAnalysis?.tier3_ratio > 0.3) {
        tier3Issues++
      }
    } else if (c.deviation < 0) {
      underCount++
      if (c.featureBreakdown.excluded_lowConfidence > 2) {
        tier2Issues++
      }
    }
  })
  
  // 动态调整阈值
  const tier2Threshold = 0.70 - (underCount > overCount ? 0.05 : 0) + (tier2Issues > 5 ? 0.03 : 0)
  const tier3Threshold = 0.70 + (tier3Issues > 5 ? 0.05 : 0) - (underCount > 10 ? 0.03 : 0)
  
  return {
    success: true,
    message: '阈值计算完成',
    thresholds: {
      tier2: Math.max(0.60, Math.min(0.80, tier2Threshold)),
      tier3: Math.max(0.65, Math.min(0.80, tier3Threshold))
    },
    analysis: {
      overCount,
      underCount,
      tier2Issues,
      tier3Issues,
      recommendation: overCount > underCount * 2 
        ? '识别偏高，建议提高阈值' 
        : underCount > overCount * 2 
          ? '识别偏低，建议降低阈值'
          : '识别平衡，保持当前阈值'
    }
  }
}
