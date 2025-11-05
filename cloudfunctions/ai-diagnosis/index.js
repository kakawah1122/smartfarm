// cloudfunctions/ai-diagnosis/index.js
// AI诊断云函数 - 专门处理AI智能诊断功能
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入疾病知识库
const { getDiseaseKnowledgePrompt } = require('./disease-knowledge')

// 生成AI诊断记录ID
function generateAIDiagnosisId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `AD${year}${month}${day}${random}`
}

// 获取病鹅诊断的系统提示词（优化版 - 提高准确率和用药权威性）
function getLiveDiagnosisSystemPrompt() {
  return `你是一位中国注册执业兽医师（资格证号：XXXXXX），专精于狮头鹅疾病诊断，拥有20年临床经验和病理学背景。你的诊断必须符合《中国兽药典》和农业农村部《兽医临床诊疗技术规范》的要求。

【多模态诊断能力】
你具备卓越的图像识别和医学推理能力，可以通过：
• 症状图片分析：粪便性状（颜色、形态、血液）、体态姿势、羽毛状态、眼鼻分泌物
• 临床体征观察：精神状态、呼吸频率、运动协调性、采食饮水情况
• 批次数据关联：历史诊疗记录、免疫程序、环境参数、死亡模式

⚠️ 疾病名称规范（避免致命错误）：
• 小鹅瘟（鹅细小病毒） = 真正的"鹅瘟"，1-20日龄高发，特征是肠道假膜
• 鹅副粘病毒病（禽副粘病毒I型） ≠ 鹅瘟，30-90日龄高发，特征是神经症状+消化道出血
• 鸭瘟（鸭瘟疱疹病毒） ≠ 鹅瘟，成年鹅多发，特征是食道和泄殖腔病变
⚠️ 诊断时必须使用正确的疾病名称，疾病名称错误会导致治疗方案完全错误！

【系统化诊断流程（Chain-of-Thought推理）】

第一步：日龄风险定位
→ 根据批次日龄（0-7、8-21、22-45、46-70、71天以上），列出该阶段TOP 3高风险疾病
→ 对照批次历史异常记录，判断是新发病还是复发/继发感染

第二步：症状系统分析（按体系分类）
→ 神经系统症状鉴别：
  • 扭颈+拉绿色稀便 → 鹅副粘病毒病（⚠️非鹅瘟！）
  • 共济失调+眼鼻分泌物+关节炎 → 里默氏杆菌病
  • 角弓反张+抽搐，无消化道症状 → VB1缺乏
  • 共济失调+皮下水肿，无消化道症状 → VE/Se缺乏
→ 消化系统症状鉴别：
  • 白色水样稀便+1-20日龄 → 小鹅瘟（⚠️真正的鹅瘟）
  • 血便或番茄酱样便 → 球虫病
  • 黄绿色稀便+呼吸困难 → 大肠杆菌病
  • 白色糊状便+肛门粘便 → 沙门氏菌病
→ 呼吸系统症状鉴别：
  • 张口呼吸+气囊结节 → 曲霉菌病
  • 呼吸困难+心包炎+气囊炎 → 大肠杆菌病
→ 运动系统症状鉴别：
  • 跛行+关节肿胀+白色沉积 → 痛风或关节炎
  • 腿软+骨骼变形+无感染病变 → Ca/P/VD缺乏
→ 逐条记录：哪些症状存在？哪些症状缺失但预期应该有？

第三步：图像证据分析（如有照片）
→ 逐张描述：图片编号、病变部位、颜色特征、形态特点
→ 关键鉴别点：纤维素假膜位置、出血分布、坏死类型、渗出物颜色
→ 图像质量评估：是否需要补充特定角度或部位的照片

第四步：鉴别诊断矩阵
→ 主诊断：症状+日龄+批次历史完全吻合的疾病
→ 鉴别诊断1：相似症状但可排除的理由（基于日龄/病变特征/缺失症状）
→ 鉴别诊断2：需要实验室检测才能排除的疾病
→ 混合感染可能：是否存在继发感染风险

第五步：置信度评估与证据强度
→ 高置信度(85-100%)：典型症状+特征性病变+日龄完全匹配+批次历史支持
→ 中置信度(65-84%)：主要症状匹配，但缺少特征性病变或关键检测
→ 低置信度(<65%)：症状不典型或信息严重不足，需补充检查

第六步：治疗方案（必须符合《中国兽药典》标准）
⚠️ 用药规范要求：
• 药物名称：使用通用名（非商品名），注明兽药批准文号
• 剂量计算：基于狮头鹅平均体重计算，单位必须为 mg/kg体重 或 mL/kg体重
• 给药途径：口服/饮水/肌肉注射/皮下注射，明确注射部位
• 用药频次：每日几次，间隔时间
• 疗程天数：明确总疗程，不得少于5天（细菌感染）
• 配伍禁忌：不得与XX药物同时使用
• 休药期：明确屠宰前停药天数（食品安全）
• 禁用药物警告：严禁使用国家明令禁止的兽药（如氯霉素、呋喃类等）

第七步：自我验证（Quality Check）
在给出最终诊断前，请自问：
✓ 诊断疾病是否在该日龄高发？（检查日龄匹配度）
✓ 症状是否完整支持该诊断？（有无矛盾症状）
✓ 剂量计算是否正确？（复核mg/kg计算）
✓ 是否考虑了鉴别诊断？（至少2个）
✓ 置信度是否与证据强度匹配？（避免高估或低估）
✓ 是否使用了禁用药物？（国家禁用清单检查）
✓ 治疗方案是否考虑了狮头鹅的品种特异性？（体型大、生长快）

【诊断原则】
1. 只诊断狮头鹅相关疾病，禁止扩展到其他禽类
2. 信息不足时，明确列出需要补充的数据或照片，不得臆测
3. 必须给出鉴别诊断，说明排除依据
4. 用药建议必须权威、具体、可操作，包含剂量、途径、频次、疗程
5. 标注支持性护理（补液、电解质、保温）和批次管理措施（消毒、隔离、饲养调整）
6. 根据日龄阶段和历史风险，制定监测指标、随访周期、实验室检测建议
7. 输出必须严谨、可追溯，每个结论都要有证据支持

【重要】疾病名称格式要求：
• 必须使用纯中文名称，例如："小鹅瘟"、"鹅副黏病毒病"、"大肠杆菌病"
• 严禁包含英文、拉丁文或任何括号说明，例如：❌"小鹅瘟（Gosling Plague）"
• 农户看不懂英文，请确保所有disease字段都是简洁的中文病名

请严格使用以下JSON结构回复：
{
  "primaryDiagnosis": {
    "disease": "疾病名称（纯中文，无英文）",
    "confidence": 85,
    "reasoning": "结合症状、图片、日龄与历史数据的论证要点"
  },
  "differentialDiagnosis": [
    {"disease": "鉴别疾病1（纯中文）", "confidence": 60, "exclusionReason": "排除或佐证依据"},
    {"disease": "鉴别疾病2（纯中文）", "confidence": 45, "exclusionReason": "排除或佐证依据"}
  ],
  "riskFactors": [
    "记录高危因素：如日龄阶段、免疫空档、环境或管理缺陷"
  ],
  "severity": "mild|moderate|severe",
  "urgency": "low|medium|high|critical",
  "treatmentRecommendation": {
    "immediate": ["现场紧急措施，含支持性处理"],
    "medication": [
      {
        "name": "药物名称",
        "dosage": "mg/kg或mL/L",
        "route": "口服|饮水|注射等",
        "frequency": "给药频次",
        "duration": "疗程天数",
        "notes": "注意事项/配伍禁忌/适用日龄"
      }
    ],
    "supportive": ["补液、电解质、营养、温湿度调整等措施"]
  },
  "preventionAdvice": [
    "批次生物安全与免疫建议：结合日龄阶段、历史病史与环境风险"
  ],
  "followUp": {
    "monitoring": ["未来24-72h需监测的指标及阈值"],
    "recommendedTests": ["建议追加的实验室检测"],
    "reviewInterval": "建议的复查或随访时间"
  }
}`
}

// 获取死因剖析的系统提示词（优化版 - 提高准确率和权威性）
function getAutopsySystemPrompt() {
  return `你是一位中国注册执业兽医师（资格证号：XXXXXX），专精于狮头鹅病理学和剖检诊断，拥有20年临床病理经验。你的剖检诊断必须符合《兽医病理学诊断规范》和《动物检疫规程》的要求。

【多模态病理分析能力】
你具备卓越的病理图像识别和死因推断能力，可以通过：
• 剖检图片分析：器官颜色、质地、大小、病变类型（充血、出血、坏死、渗出）
• 组织病理对照：病变分布模式、典型病理特征、鉴别要点
• 死亡模式分析：突然死亡vs慢性消耗、单个死亡vs批量死亡、日龄分布

⚠️ 疾病名称规范（避免致命错误）：
• 小鹅瘟（鹅细小病毒） = 真正的"鹅瘟"，1-20日龄高发，肠道假膜是诊断金标准
• 鹅副粘病毒病（禽副粘病毒I型） ≠ 鹅瘟，30-90日龄高发，脑膜充血+消化道出血
• 鸭瘟（鸭瘟疱疹病毒） ≠ 鹅瘟，成年鹅多发，食道和泄殖腔特征性病变
⚠️ 剖检诊断时必须使用正确的疾病名称！疾病名称错误=治疗方案错误=延误病情！

【系统化剖检诊断流程（Chain-of-Thought推理）】

第一步：死亡背景分析
→ 日龄阶段：0-7天（雏鹅病毒病高发）、8-21天（细菌感染多发）、22-45天（寄生虫风险）、46天以上（代谢病、中毒）
→ 死亡模式：急性死亡（败血症、中毒）vs 慢性消耗（寄生虫、营养缺乏）
→ 批次历史：近期异常记录、治疗史、死亡案例、免疫程序
→ 环境因素：温湿度变化、饲料更换、应激事件

第二步：生前症状回顾
→ 神经症状鉴别：
  • 扭颈+拉绿便 → 鹅副粘病毒病（⚠️非鹅瘟）
  • 共济失调+关节炎 → 里默氏杆菌病
  • 角弓反张+无消化道症状 → VB1缺乏
→ 消化道症状鉴别：
  • 白色稀便+雏鹅 → 小鹅瘟（⚠️真正的鹅瘟）
  • 血便 → 球虫病或鸭瘟
  • 黄绿色稀便 → 大肠杆菌病或禽霍乱
→ 呼吸道症状：曲霉菌、大肠杆菌气囊炎
→ 症状-病理关联：生前症状与剖检发现是否一致

第三步：系统化剖检检查
A. 外观检查
   → 营养状况：消瘦/正常/肥胖
   → 体表：羽毛、皮肤、孔窍（鼻、口、肛门）有无异常分泌物
   → 脱水程度：眼球凹陷、皮肤弹性

B. 体腔检查
   → 腹腔：积液性质（清亮/浑浊/血性）、纤维素渗出
   → 胸腔：心包积液、气囊病变
   → 腹膜/浆膜：炎症、粘连

C. 内脏器官系统检查
   ⚠️ 心脏
   - 大小：正常/肥大/萎缩
   - 心包：积液（清亮/浑浊/黄色纤维素性）
   - 心肌：颜色（灰白条纹=小鹅瘟）、出血点
   - 心内膜/外膜：出血点（副粘病毒、禽霍乱）
   
   ⚠️ 肝脏 ★关键器官
   - 大小：肿大/正常/萎缩
   - 颜色：灰白色坏死灶（小鹅瘟）、灰黄色坏死灶（鸭瘟）、针尖大坏死灶（沙门氏菌、禽霍乱）
   - 质地：肿大变脆（感染）、脂肪肝（营养代谢）
   - 包膜：混浊、纤维素渗出（大肠杆菌）
   - 胆囊：充盈度、胆汁颜色
   
   ⚠️ 脾脏
   - 大小：肿大（急性感染）/正常/萎缩
   - 颜色：暗红（充血）、灰白色坏死
   
   ⚠️ 肺脏和气囊
   - 充血、水肿、坏死
   - 气囊：混浊、增厚、黄白色结节（曲霉菌）、纤维素渗出（大肠杆菌）
   
   ⚠️ 消化道 ★★★关键系统（最重要的鉴别依据）
   - 食道：粘膜出血、溃疡、假膜（鸭瘟特征）
   - 腺胃/肌胃：出血、溃疡
   - 小肠 ⚠️⚠️⚠️：
     * ★★★ 粘膜假膜（小鹅瘟诊断金标准）：
       - 小鹅瘟：肠黏膜内侧，白色或黄白色纤维素假膜，易剥离露出溃疡
       - 大肠杆菌：浆膜外侧（心包、肝包膜），黄色纤维素性渗出
       - ⚠️ 假膜位置是鉴别小鹅瘟和大肠杆菌病的关键！
     * 充血、出血、坏死（副粘病毒、球虫、肠炎）
     * 内容物：水样/血样/正常
   - 盲肠：肿大、血凝块（球虫特征）
   - 直肠/泄殖腔：出血、溃疡、假膜（鸭瘟特征）
   
   ⚠️ 肾脏
   - 肿大、充血、尿酸盐沉积（痛风）
   
   ⚠️ 神经系统
   - 脑膜：充血、水肿（副粘病毒、里默氏杆菌）
   - 脑实质：出血、软化
   
   ⚠️ 生殖系统（成年鹅）
   - 卵巢：卵泡变性、萎缩
   - 输卵管：炎症、腹膜炎

第四步：图像证据分析（如有剖检照片）
→ 逐张描述：图片编号、器官名称、病变类型、颜色特征、分布范围
→ 特征性病变识别（诊断金标准）：
  • ★★★ 小肠黏膜内侧白色假膜 = 小鹅瘟（⚠️真正的鹅瘟，诊断金标准）
  • ★★★ 黄色纤维素心包炎+肝周炎+气囊炎 = 大肠杆菌"三炎"
  • ★★★ 食道和泄殖腔出血溃疡假膜 = 鸭瘟（⚠️非鹅瘟）
  • ★★ 脑膜充血+消化道出血 = 鹅副粘病毒病（⚠️非鹅瘟）
  • ★★ 气囊黄白色结节 = 曲霉菌病
  • ★★ 肝脏多发针尖坏死灶+败血症 = 禽霍乱
  • ★ 盲肠肿大血凝块 = 球虫病
→ 图像质量评估：需要补充哪些器官或角度的照片
→ ⚠️ 重点检查：假膜位置（黏膜内侧vs浆膜外侧）是鉴别诊断的关键！

第五步：病理生理推断
→ 直接死因：导致死亡的直接原因（心力衰竭、败血症、窒息、器官衰竭）
→ 基础病/诱因：间接原因（免疫力低下、应激、继发感染）
→ 致死机制：病理生理过程（如：小鹅瘟→肠粘膜坏死→营养吸收障碍+脱水→循环衰竭）
→ 死亡时间推断：根据尸僵、角膜混浊、内脏自溶程度

第六步：鉴别诊断矩阵
→ 主要死因：剖检特征+日龄+症状完全吻合
→ 鉴别死因1：相似病变但可排除的理由
→ 鉴别死因2：需要实验室检测确认
→ 继发/混合感染：原发病+继发细菌感染

第七步：置信度评估
→ 高置信度(85-100%)：特征性病变明确（如小肠假膜）+日龄匹配+症状支持
→ 中置信度(65-84%)：典型病变，但需实验室确认病原
→ 低置信度(<65%)：非特异性病变，需补充检查

第八步：实验室检测建议（符合《动物疫病诊断技术规范》）
⚠️ 病原学检测：
• 病毒检测：PCR（小鹅瘟病毒、副粘病毒、鸭瘟病毒）
• 细菌培养：无菌采样（肝脏、脾脏、心血）+ 药敏试验
• 寄生虫检查：粪便镜检（球虫卵囊、蠕虫卵）、肠道内容物检查
• 毒理学检测：饲料/水样重金属、黄曲霉毒素检测

⚠️ 样本采集标准：
• 新鲜尸体（死后4-6小时内）
• 病变明显的器官（肝、脾、肠、脑）
• 无菌操作，10%甲醛固定
• 送检机构：省级动物疫病预防控制中心

第九步：预防与控制措施
→ 紧急措施：隔离病鹅、死鹅无害化处理、消毒
→ 批次管理：调整饲养密度、改善通风、温湿度控制
→ 生物安全：严格消毒（氯制剂、碘制剂）、人员车辆管理、病死鹅深埋/焚烧
→ 免疫程序：疫苗接种建议（小鹅瘟、鸭瘟、副粘病毒）
→ 营养调整：维生素/矿物质补充、饲料霉变检查
→ 药物预防：群体投药方案（抗生素敏感性测试后）

第十步：自我验证（Quality Check）
✓ 死因是否在该日龄常见？
✓ 剖检发现是否支持诊断？
✓ 是否有特征性病变？
✓ 生前症状与剖检是否一致？
✓ 鉴别诊断是否充分？
✓ 置信度是否合理？
✓ 实验室检测建议是否具体？
✓ 预防措施是否可操作？

【诊断原则】
1. 只分析狮头鹅尸体，禁止扩展到其他禽类
2. 系统化检查，不遗漏关键器官
3. 识别特征性病变（如小肠假膜、三炎并发）
4. 信息不足时，明确列出缺失的照片或数据
5. 实验室检测建议必须具体（检测项目、样本要求、送检机构）
6. 预防措施必须符合生物安全规范和免疫程序
7. 输出必须严谨、可追溯，每个结论都要有病理依据

【重要】疾病名称格式要求：
• 必须使用纯中文名称，例如："小鹅瘟"、"鹅副黏病毒病"、"大肠杆菌病"
• 严禁包含英文、拉丁文或任何括号说明，例如：❌"小鹅瘟（Gosling Plague）"
• 农户看不懂英文，请确保所有disease字段都是简洁的中文病名

请使用以下JSON结构输出：
{
  "primaryCause": {
    "disease": "主要死因（纯中文，无英文）",
    "confidence": 85,
    "reasoning": "结合症状+剖检+历史的详细推理",
    "autopsyEvidence": ["关键解剖证据1", "关键解剖证据2"],
    "pathogenesis": "推断致死机制"
  },
  "differentialCauses": [
    {"disease": "鉴别死因1（纯中文）", "confidence": 60, "exclusionReason": "排除或保留理由"},
    {"disease": "鉴别死因2（纯中文）", "confidence": 45, "exclusionReason": "排除或保留理由"}
  ],
  "pathologicalFindings": {
    "summary": "病理变化概述",
    "organs": [
      {"organ": "器官名称", "lesions": ["病变描述1", "病变描述2"], "imageReference": "对应图片序号"}
    ]
  },
  "preventionMeasures": ["针对该日龄批次的预防措施"],
  "biosecurityAdvice": ["生物安全改进建议"],
  "epidemiologyRisk": "low|medium|high",
  "recommendedTests": ["建议追加的实验室/病理检测"],
  "followUp": {
    "monitoring": ["后续观察指标"],
    "correctiveActions": ["需要立即执行的矫正措施"],
    "dataToCollect": ["建议补充的照片或数据"],
    "feedbackForAI": "此次分析中可用于改进模型的关键字段或修正要点"
  }
}`
}

// 获取死因剖析的增强版系统提示词（包含历史案例学习）
function getAutopsySystemPromptV2(historyCases = []) {
  let casesSection = ''
  
  if (historyCases.length > 0) {
    casesSection = `

【本场历史准确诊断参考案例（Few-Shot Learning）】
以下是本养殖场近期兽医确诊的真实病例，供学习避免误判：

${historyCases.map((c, i) => `
案例${i+1}：${c.correctDiagnosis}（AI准确性：${c.finalRating}星/5星）
  • 动物信息：日龄${c.dayAge}天，死亡${c.deathCount}只
  • 生前症状：${c.symptomsText || c.symptoms || '未详细观察'}
  • 剖检发现：${c.autopsyAbnormalities}
  ${c.autopsyDescription ? `• 农民描述：${c.autopsyDescription}` : ''}
  • AI初步判断：${c.aiInitialDiagnosis}
  • 兽医最终确诊：${c.correctDiagnosis}
  • 修正依据：${c.correctionReason}
  • ⚠️ 关键教训：${c.aiInitialDiagnosis !== c.correctDiagnosis ? '注意区分相似病变，避免重复误判' : 'AI诊断准确，可作为正例参考'}
`).join('\n')}

【学习要点】
1. 参考这些案例的症状-疾病对应关系和日龄匹配
2. 特别注意兽医的修正理由，避免类似误判陷阱
3. 关注本养殖场的常见疾病模式和环境特点
4. 优先考虑历史高频疾病，但不能忽视新发病种
5. 剖检病变鉴别诊断是关键，必须结合多个特征综合判断
`
  }
  
  return getAutopsySystemPrompt() + casesSection
}

// 疾病知识库已移到独立文件 disease-knowledge.js

/**
 * 获取历史高准确率案例（用于Few-Shot Learning）
 * @param {number} limit - 返回案例数量
 * @returns {Promise<Array>} 案例列表
 */
async function getTopAccuracyCases(limit = 5) {
  try {
    const result = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        isCorrected: true,
        aiAccuracyRating: _.gte(4) // 评分≥4星
      })
      .orderBy('aiAccuracyRating', 'desc')
      .orderBy('correctedAt', 'desc')
      .limit(limit)
      .get()
    
    if (!result.data || result.data.length === 0) {
      return []
    }
    
    return result.data.map(record => {
      const symptoms = record.diagnosisResult?.symptoms || []
      const autopsyAbnormalities = record.autopsyFindings?.abnormalities || []
      
      return {
        // 症状信息
        symptoms: symptoms.join('、') || '未详细记录',
        symptomsText: record.diagnosisResult?.symptomsText || '',
        
        // 剖检发现
        autopsyAbnormalities: autopsyAbnormalities.join('、') || '未详细记录',
        autopsyDescription: record.autopsyFindings?.description || '',
        
        // 诊断结果
        aiInitialDiagnosis: record.deathCause,
        correctDiagnosis: record.correctedCause,
        correctionReason: record.correctionReason,
        
        // 动物信息
        dayAge: record.diagnosisResult?.animalInfo?.dayAge || '未知',
        deathCount: record.deathCount || 1,
        
        // 可信度
        finalRating: record.aiAccuracyRating
      }
    })
  } catch (error) {
    console.error('获取历史案例失败:', error)
    return [] // 失败时返回空数组，不影响正常诊断流程
  }
}

// 构建病鹅诊断的用户消息
function buildLiveDiagnosisUserMessage(symptomsText, symptoms, animalInfo, environmentInfo, images) {
  return `请诊断以下鹅群情况：

症状描述：
${symptomsText}

具体症状：
${symptoms.join(', ')}

动物信息：
- 日龄：${animalInfo.dayAge || '未知'}天
- 数量：${animalInfo.count || 1}只
- 种类：${animalInfo.species || '狮头鹅'}

环境信息：
- 温度：${environmentInfo.temperature || '未知'}°C
- 湿度：${environmentInfo.humidity || '未知'}%

${images && images.length > 0 ? `症状图片：${images.length}张（已上传）` : ''}

请进行专业诊断并提供治疗建议。`
}

// 构建死因剖析的用户消息
function buildAutopsyUserMessage(symptomsText, symptoms, animalInfo, autopsyFindings, images) {
  const abnormalities = autopsyFindings?.abnormalities || []
  const description = autopsyFindings?.description || ''
  
  return `请分析以下鹅只的死亡原因：

动物信息：
- 日龄：${animalInfo.dayAge || '未知'}天
- 死亡数量：${animalInfo.deathCount || 1}只
- 种类：${animalInfo.species || '狮头鹅'}

生前症状：
${symptomsText || '无明显症状或未观察到'}
${symptoms && symptoms.length > 0 ? `\n具体表现：${symptoms.join('、')}` : ''}

剖检发现：
${abnormalities.length > 0 ? `\n观察到的异常：\n${abnormalities.map((item, i) => `${i+1}. ${item}`).join('\n')}` : ''}
${description ? `\n农民描述：${description}` : ''}

${images && images.length > 0 ? `\n剖检照片：${images.length}张（已上传）` : ''}

请根据以上信息进行死因分析，并提供预防建议。`
}

// 构建批次上下文信息（优化格式，突出关键信息）
function buildBatchContextSection(batchPromptData) {
  if (!batchPromptData || Object.keys(batchPromptData).length === 0) {
    return ''
  }

  const { batch = {}, stats = {}, diagnosisTrend = [], treatmentHistory = [], deathHistory = [], correctionFeedback = [] } = batchPromptData

  const batchLines = []
  
  // === 批次快照（一行概览）===
  const dayAge = batch.dayAge || '未知'
  const totalAnimals = stats.totalAnimals ?? '未知'
  const abnormalCount = stats.abnormalCount ?? 0
  const deadCount = stats.deadCount ?? 0
  const mortalityRate = stats.mortalityRate ? `${stats.mortalityRate}%` : '未计算'
  
  batchLines.push('\n═══════════════════════════════════════════════')
  batchLines.push(`【批次快照】${batch.batchNumber || '未知批次'} | 第${dayAge}天 | 存栏${totalAnimals}只 | ${abnormalCount > 0 ? `⚠️ 异常${abnormalCount}只` : '✓ 无异常'} | 累计死亡${deadCount}只(${mortalityRate})`)
  batchLines.push('═══════════════════════════════════════════════')

  // === 高风险提示（仅在有异常时显示）===
  if (diagnosisTrend.length > 0 || correctionFeedback.length > 0) {
    const highRiskAlerts = []
    
    // 从近期诊断中提取高频病种
    if (diagnosisTrend.length > 0) {
      const recentDiseases = {}
      diagnosisTrend.slice(0, 5).forEach(record => {
        const disease = record.diagnosis || '未知'
        recentDiseases[disease] = (recentDiseases[disease] || 0) + 1
      })
      const topDisease = Object.entries(recentDiseases).sort((a, b) => b[1] - a[1])[0]
      if (topDisease && topDisease[1] > 1) {
        highRiskAlerts.push(`近7天内${topDisease[1]}例"${topDisease[0]}"病例 → 警惕流行趋势`)
      }
    }
    
    // 从修正反馈中提取AI常见误判
    if (correctionFeedback.length > 0) {
      const recentCorrection = correctionFeedback[0]
      if (recentCorrection.aiAccuracyRating <= 3) {
        highRiskAlerts.push(`⚠️ 上次AI误判：需从"${recentCorrection.correctedDiagnosis}"鉴别（${recentCorrection.correctionReason}）`)
      }
    }
    
    if (highRiskAlerts.length > 0) {
      batchLines.push('\n【⚠️ 高风险提示】')
      highRiskAlerts.forEach(alert => batchLines.push(`  ${alert}`))
    }
  }

  // === 近期异常诊断（简化，突出核心）===
  if (diagnosisTrend && diagnosisTrend.length > 0) {
    batchLines.push('\n【近期异常诊断】')
    diagnosisTrend.slice(0, 3).forEach((record, index) => {
      const symptoms = Array.isArray(record.symptoms) && record.symptoms.length > 0 
        ? record.symptoms.slice(0, 3).join('、') + (record.symptoms.length > 3 ? '等' : '')
        : '未记录'
      const severityIcon = record.severity === 'severe' ? '🔴' : record.severity === 'moderate' ? '🟠' : '🟡'
      batchLines.push(`  ${severityIcon} ${record.checkDate || '未知日期'} | ${record.diagnosis || '未知'} | ${record.sickCount || 0}只 | 症状：${symptoms}`)
    })
  }

  // === 治疗中方案（仅显示进行中的）===
  const ongoingTreatments = treatmentHistory.filter(t => t.outcome === 'ongoing' || !t.outcome)
  if (ongoingTreatments.length > 0) {
    batchLines.push('\n【治疗中方案】')
    ongoingTreatments.slice(0, 2).forEach(record => {
      const medications = Array.isArray(record.medications) && record.medications.length > 0
        ? record.medications.map(m => m.name).join('、')
        : '未记录药物'
      batchLines.push(`  💊 ${record.treatmentDate || '未知'} | ${record.diagnosis || '未知'} | 用药：${medications}`)
    })
  }

  // === 死亡记录（突出修正差异）===
  if (deathHistory && deathHistory.length > 0) {
    batchLines.push('\n【死亡记录（含AI修正对比）】')
    deathHistory.slice(0, 3).forEach(record => {
      const correctionMark = record.correctedDiagnosis && record.aiDiagnosis !== record.correctedDiagnosis
        ? `❌ AI初判"${record.aiDiagnosis}" → ✅ 兽医确诊"${record.correctedDiagnosis}"`
        : `${record.aiDiagnosis || '未知'}`
      const rating = record.aiAccuracyRating ? `(${record.aiAccuracyRating}★)` : ''
      batchLines.push(`  ${record.deathDate || '未知'} | ${record.deathCount || 0}只 | ${correctionMark} ${rating}`)
      if (record.correctionReason) {
        batchLines.push(`      └─ 修正依据：${record.correctionReason}`)
      }
    })
  }

  // === 关键学习点（从修正反馈中总结）===
  if (correctionFeedback && correctionFeedback.length > 0) {
    const lowRatingFeedback = correctionFeedback.filter(f => f.aiAccuracyRating && f.aiAccuracyRating <= 3)
    if (lowRatingFeedback.length > 0) {
      batchLines.push('\n【🎯 关键学习点（避免重复误判）】')
      lowRatingFeedback.slice(0, 2).forEach(record => {
        batchLines.push(`  ⚠️ "${record.correctedDiagnosis}" - ${record.correctionReason}`)
      })
    }
  }

  batchLines.push('\n═══════════════════════════════════════════════')
  batchLines.push('【诊断指引】请结合以上批次历史数据、疾病流行趋势与修正反馈，')
  batchLines.push('按照"日龄定位→主症分析→剖检对照→历史关联→鉴别诊断→置信度评估"')
  batchLines.push('的六步流程，对当前狮头鹅案例给出精准、可追溯的诊断建议。')
  batchLines.push('═══════════════════════════════════════════════\n')

  return '\n' + batchLines.join('\n') + '\n'
}

// 调用大模型API进行诊断
async function callAIModel(inputData) {
  try {
    const {
      symptoms,
      symptomsText,
      animalInfo,
      environmentInfo,
      images,
      diagnosisType,
      autopsyFindings,
      batchPromptData
    } = inputData
    
    // 🔥 获取历史案例（仅用于死因剖析）
    let historyCases = []
    if (diagnosisType === 'autopsy_analysis') {
      try {
        historyCases = await getTopAccuracyCases(5)
      } catch (caseError) {
      }
    }
    
    // 构建批次数据提示
    const batchContext = buildBatchContextSection(batchPromptData)

    // 根据诊断类型选择系统提示词（使用增强版）
    let systemPrompt = ''
    if (diagnosisType === 'autopsy_analysis') {
      // 死因剖析：使用增强版Prompt + 疾病知识库
      systemPrompt = getAutopsySystemPromptV2(historyCases) + batchContext + getDiseaseKnowledgePrompt()
    } else {
      // 病鹅诊断：使用原有Prompt
      systemPrompt = getLiveDiagnosisSystemPrompt() + batchContext + getDiseaseKnowledgePrompt()
    }
    
    // 根据诊断类型构建用户消息
    const userMessage = diagnosisType === 'autopsy_analysis'
      ? buildAutopsyUserMessage(symptomsText, symptoms, animalInfo, autopsyFindings, images)
      : buildLiveDiagnosisUserMessage(symptomsText, symptoms, animalInfo, environmentInfo, images)

    // 构建AI诊断请求 - 使用正确的ai-multi-model格式
    const aiRequest = {
      action: 'chat_completion',   // ✨ 重要：ai-multi-model 期望这个action
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      taskType: 'health_diagnosis',  // ✨ ai-multi-model 根据此选择模型
      priority: 'free_only',          // ✨ 优先使用免费模型
      images: images || []            // ✅ 传递图片文件ID（如果有）
    }

    // 调用AI多模型服务
    // ⚠️ 重要：微信云函数默认超时3秒，需要手动改为30秒以上
    const aiResult = await cloud.callFunction({
      name: 'ai-multi-model',
      data: aiRequest,
      timeout: 60000  // ✅ 增加到60秒超时（通义千问API在处理图片时可能需要更长时间）
    })

    if (aiResult.result && aiResult.result.success) {
      const aiResponse = aiResult.result.data.content

      try {
        // 尝试解析JSON响应
        const diagnosisResult = JSON.parse(aiResponse)
        
        return {
          success: true,
          data: {
            ...diagnosisResult,
            modelInfo: {
              modelName: aiResult.result.data.model,
              provider: aiResult.result.data.provider,
              responseTime: aiResult.result.data.responseTime || 0,
              tokens: aiResult.result.data.tokens || { input: 0, output: 0, total: 0 },
              cost: aiResult.result.data.cost || 0
            }
          }
        }
      } catch (parseError) {
        // 如果JSON解析失败，返回原始文本
        return parseTextResponse(aiResponse, aiResult.result)
      }
    } else {
      throw new Error(aiResult.result?.error || 'AI服务调用失败')
    }
  } catch (error) {
    // 返回兜底诊断建议
    return getFallbackDiagnosis(inputData)
  }
}

// 文本响应解析器（兜底方案）
function parseTextResponse(textResponse, aiResult) {
  // 基于关键词的简单解析
  const confidence = extractConfidence(textResponse)
  const disease = extractDisease(textResponse)
  const severity = extractSeverity(textResponse)
  
  return {
    success: true,
    data: {
      primaryDiagnosis: {
        disease: disease || '疑似感染性疾病',
        confidence: confidence || 75,
        reasoning: '基于症状描述的初步分析'
      },
      differentialDiagnosis: [
        { disease: '细菌性感染', confidence: 60 },
        { disease: '病毒性感染', confidence: 45 }
      ],
      riskFactors: ['环境应激', '免疫力低下'],
      severity: severity || 'moderate',
      urgency: 'medium',
      treatmentRecommendation: {
        immediate: ['保持环境清洁', '观察症状变化'],
        medication: [{
          name: '广谱抗生素',
          dosage: '按体重计算',
          route: '口服或注射',
          frequency: '每日2次',
          duration: '5-7天',
          confidence: 70
        }],
        supportive: ['加强营养', '保持适宜温度'],
        followUp: {
          timeline: '3天后复查',
          indicators: ['症状改善', '食欲恢复']
        }
      },
      preventionAdvice: ['加强环境管理', '定期健康检查'],
      modelInfo: {
        modelName: 'Text-Parser',
        modelVersion: '1.0',
        provider: 'Fallback',
        responseTime: aiResult?.responseTime || 0,
        tokens: aiResult?.tokens || { input: 0, output: 0, total: 0 },
        cost: aiResult?.cost || 0
      },
      textResponse
    }
  }
}

// 兜底诊断建议
function getFallbackDiagnosis(inputData) {
  const { symptoms, animalInfo } = inputData
  
  // 基于症状的简单规则诊断
  let primaryDisease = '疑似感染性疾病'
  let severity = 'moderate'
  let confidence = 60
  
  if (symptoms.includes('咳嗽') || symptoms.includes('呼吸困难')) {
    primaryDisease = '呼吸道感染'
    confidence = 75
  } else if (symptoms.includes('腹泻') || symptoms.includes('消化不良')) {
    primaryDisease = '消化道疾病'
    confidence = 70
  } else if (symptoms.includes('精神萎靡') || symptoms.includes('食欲不振')) {
    primaryDisease = '全身性感染'
    confidence = 65
  }
  
  if (symptoms.includes('死亡') || symptoms.includes('严重')) {
    severity = 'severe'
    confidence += 10
  }
  
  return {
    success: true,
    data: {
      primaryDiagnosis: {
        disease: primaryDisease,
        confidence: Math.min(confidence, 85),
        reasoning: '基于症状关键词的规则诊断'
      },
      differentialDiagnosis: [
        { disease: '环境应激综合征', confidence: 50 },
        { disease: '营养缺乏症', confidence: 40 }
      ],
      riskFactors: ['环境因素', '管理因素'],
      severity,
      urgency: severity === 'severe' ? 'high' : 'medium',
      treatmentRecommendation: {
        immediate: ['改善环境条件', '加强监测'],
        medication: [{
          name: '根据具体症状选择药物',
          dosage: '请咨询兽医',
          route: '遵医嘱',
          frequency: '遵医嘱',
          duration: '遵医嘱',
          confidence: 50
        }],
        supportive: ['加强营养管理', '保持环境卫生'],
        followUp: {
          timeline: '建议24小时内复查',
          indicators: ['症状变化', '一般状态']
        }
      },
      preventionAdvice: ['改善饲养管理', '定期健康监控'],
      modelInfo: {
        modelName: 'Rule-Based-Diagnosis',
        modelVersion: '1.0',
        provider: 'Fallback',
        responseTime: 0,
        tokens: { input: 0, output: 0, total: 0 },
        cost: 0
      },
      isFallback: true
    }
  }
}

// 辅助函数：提取置信度
function extractConfidence(text) {
  const confidenceMatch = text.match(/置信度[：:]?\s*(\d+)%?/i) || 
                         text.match(/confidence[：:]?\s*(\d+)/i)
  return confidenceMatch ? parseInt(confidenceMatch[1]) : null
}

// 辅助函数：提取疾病名称
function extractDisease(text) {
  const diseases = [
    '禽流感', '新城疫', '小鹅瘟', '鹅副黏病毒病', 
    '细菌性肝炎', '大肠杆菌病', '沙门氏菌病',
    '呼吸道感染', '消化道感染', '肠炎',
    '营养缺乏', '维生素缺乏', '应激综合征'
  ]
  
  for (const disease of diseases) {
    if (text.includes(disease)) {
      return disease
    }
  }
  
  return null
}

// 辅助函数：提取严重程度
function extractSeverity(text) {
  if (text.includes('严重') || text.includes('重度') || text.includes('severe')) {
    return 'severe'
  } else if (text.includes('中度') || text.includes('moderate')) {
    return 'moderate'
  } else if (text.includes('轻度') || text.includes('轻微') || text.includes('mild')) {
    return 'mild'
  }
  return null
}

// 保存AI诊断记录
async function saveAIDiagnosisRecord(inputData, aiResult, openid) {
  try {
    const recordId = generateAIDiagnosisId()
    
    const diagnosisRecord = {
      _id: recordId,
      _openid: openid,
      healthRecordId: inputData.healthRecordId || null,
      batchId: inputData.batchId || null,
      
      // 输入信息
      input: {
        symptoms: inputData.symptoms || [],
        symptomsText: inputData.symptomsText || '',
        animalInfo: inputData.animalInfo || {},
        environmentInfo: inputData.environmentInfo || {},
        images: inputData.images || []
      },
      
      // AI分析结果
      aiResult: aiResult.data,
      
      // 人工验证状态
      veterinaryReview: {
        reviewed: false,
        reviewerId: null,
        reviewerName: null,
        reviewTime: null,
        agreement: null,
        comments: null,
        adjustments: []
      },
      
      // 结果应用状态
      application: {
        adopted: false,
        adoptedBy: null,
        adoptionTime: null,
        treatmentPlanId: null,
        outcome: null,
        feedback: null
      },
      
      // 系统字段
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }
    
    await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS).add({
      data: diagnosisRecord
    })
    
    return {
      success: true,
      data: { recordId, diagnosis: diagnosisRecord },
      message: 'AI诊断记录保存成功'
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '保存诊断记录失败'
    }
  }
}

exports.main = async (event, context) => {
  const { action } = event
  const openid = cloud.getWXContext().OPENID
  
  // 已移除调试日志

  try {
    switch (action) {
      case 'ai_diagnosis':
        return await performAIDiagnosis(event, openid)
      case 'get_diagnosis_history':
        return await getDiagnosisHistory(event, openid)
      case 'get_diagnosis_result':
        return await getDiagnosisResult(event, openid)
      case 'update_diagnosis_review':
        return await updateDiagnosisReview(event, openid)
      case 'adopt_diagnosis':
        return await adoptDiagnosis(event, openid)
      case 'feedback_diagnosis':
        return await feedbackDiagnosis(event, openid)
      case 'get_diagnosis_stats':
        return await getDiagnosisStats(event, openid)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: error.message || 'AI诊断服务异常，请重试'
    }
  }
}

// 执行AI诊断 - 改为异步版本
async function performAIDiagnosis(event, openid) {
  try {
    const {
      symptoms,
      symptomsText,
      batchId,
      affectedCount,
      deathCount,
      dayAge,
      images,
      diagnosisType = 'live_diagnosis',
      autopsyFindings,
      saveRecord = true
    } = event

    // 根据诊断类型验证输入参数
    if (diagnosisType === 'live_diagnosis') {
      if (!symptoms || symptoms.length === 0) {
        throw new Error('症状信息不能为空')
      }
      if (!symptomsText || symptomsText.trim() === '') {
        throw new Error('症状描述不能为空')
      }
    } else if (diagnosisType === 'autopsy_analysis') {
      if (!deathCount || deathCount <= 0) {
        throw new Error('死亡数量不能为空')
      }
    }

    // ✨ 改为异步：快速保存任务到数据库 (< 1秒)
    const taskData = {
      // 不指定_id，让微信自动生成
      _openid: openid,  // ✨ 使用 _openid 以符合微信权限系统
      openid: openid,    // 保留 openid 用于业务查询
      diagnosisType: diagnosisType,
      symptoms: symptoms || [],
      symptomsText: symptomsText || '',
      batchId: batchId,
      affectedCount: affectedCount || 0,
      deathCount: deathCount || 0,
      dayAge: dayAge || 0,
      images: images || [],
      autopsyFindings: autopsyFindings || null,
      status: 'processing',  // processing | completed | failed
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // 保存到数据库
    const addResult = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS).add({
      data: taskData
    })

    // 使用微信自动生成的_id
    const diagnosisId = addResult._id


    // ✨ 触发后台处理任务（异步）
    // ⚠️ 注意：即使触发超时，任务仍在数据库中，会自动重试或在控制台配置超时
    cloud.callFunction({
      name: 'process-ai-diagnosis',
      data: { diagnosisId: diagnosisId }
    }).then(() => {
    }).catch((error) => {
      // ⚠️ 触发可能超时，但不标记任务失败
      // 任务状态由 process-ai-diagnosis 自己维护
      console.error(`⚠️ 触发信号超时（任务继续执行）: ${diagnosisId}`, error.message)
    })

    // ✨ 立即返回诊断ID给前端 (< 2秒总耗时)
    return {
      success: true,
      data: {
        diagnosisId: diagnosisId,
        status: 'processing',
        message: '诊断已提交，请稍候...'
      },
      message: 'AI诊断任务已创建'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: error.message || 'AI诊断失败'
    }
  }
}

// 获取诊断历史
// 治疗结果文本映射
function getOutcomeText(outcome) {
  const outcomeMap = {
    'ongoing': '治疗中',
    'effective': '有效',
    'ineffective': '无效',
    'completed': '已完成',
    'stopped': '已中止'
  }
  return outcomeMap[outcome] || outcome || '未知'
}

async function getDiagnosisHistory(event, openid) {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      batchId, 
      reviewed,
      adopted,
      dateRange 
    } = event

    let query = db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .where({
        _openid: openid,
        isDeleted: false  // ✅ 使用 false 替代 neq(true)，索引性能最优
      })

    if (batchId) {
      query = query.where({ batchId })
    }
    if (reviewed !== undefined) {
      query = query.where({ 'veterinaryReview.reviewed': reviewed })
    }
    if (adopted !== undefined) {
      query = query.where({ 'application.adopted': adopted })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const result = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await query.count()

    // ✅ 批量查询批次信息，填充批次编号
    const batchIds = [...new Set(result.data.map(r => r.batchId).filter(id => id))]
    const batchMap = {}
    
    if (batchIds.length > 0) {
      try {
        const batchResult = await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
          .where({
            _id: _.in(batchIds)
          })
          .field({ batchNumber: true })
          .get()
        
        batchResult.data.forEach(batch => {
          batchMap[batch._id] = batch.batchNumber
        })
      } catch (batchError) {
        console.error('查询批次信息失败:', batchError)
        // 继续执行，不影响诊断记录的返回
      }
    }

    // ✅ 批量查询关联的治疗记录
    const diagnosisIds = result.data.map(r => r._id)
    const treatmentMap = {}
    
    if (diagnosisIds.length > 0) {
      try {
        const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .where({
            diagnosisId: _.in(diagnosisIds),
            isDeleted: false  // ✅ 使用 false 替代 neq(true)，索引性能最优
          })
          .field({
            diagnosisId: true,
            treatmentPlan: true,
            medications: true,
            treatmentDate: true,
            outcome: true,
            updatedAt: true
          })
          .get()
        
        // 按诊断ID分组，取最新的治疗记录
        treatmentResult.data.forEach(treatment => {
          const existingTreatment = treatmentMap[treatment.diagnosisId]
          const treatmentTime = treatment.updatedAt || treatment.treatmentDate
          const existingTime = existingTreatment?.updatedAt || existingTreatment?.treatmentDate
          
          // 如果没有现有记录，或当前记录更新时间更晚，则使用当前记录
          if (!existingTreatment || treatmentTime > existingTime) {
            treatmentMap[treatment.diagnosisId] = treatment
          }
        })
      } catch (treatmentError) {
        console.error('查询治疗记录失败:', treatmentError)
        // 继续执行，不影响诊断记录的返回
      }
    }

    // 映射数据库字段到前端期望的格式
    const mappedRecords = result.data.map(record => {
      // ✅ 修复：支持新旧两种数据结构
      // 新结构：record.result (从 process-ai-diagnosis 保存)
      // 旧结构：record.aiResult (从旧版本保存)
      const aiResult = record.result || record.aiResult || {}
      
      // 支持病鹅诊断和死因剖析两种类型
      const primaryDiagnosis = aiResult.primaryDiagnosis || aiResult.primaryCause || {}
      const treatmentRecommendation = aiResult.treatmentRecommendation || {}
      
      // 处理用药建议（支持多种格式）
      const medications = treatmentRecommendation.medication || 
                         treatmentRecommendation.medications || 
                         []
      
      // ✅ 修复：直接从顶层字段读取，而不是从 input.animalInfo
      const symptoms = record.symptomsText || (Array.isArray(record.symptoms) ? record.symptoms.join('、') : '') || ''
      const affectedCount = record.affectedCount || 0
      const dayAge = record.dayAge || 0
      
      // ✅ 修复：治疗周期的获取逻辑
      let treatmentDuration = '未知'
      if (aiResult.followUp?.reviewInterval) {
        treatmentDuration = aiResult.followUp.reviewInterval
      } else if (treatmentRecommendation.followUp?.timeline) {
        treatmentDuration = treatmentRecommendation.followUp.timeline
      } else if (medications.length > 0 && medications[0].duration) {
        treatmentDuration = medications[0].duration
      }
      
      // ✅ 修复：时间格式处理
      let createTimeStr = ''
      if (record.createdAt) {
        createTimeStr = typeof record.createdAt === 'string' 
          ? record.createdAt 
          : record.createdAt.toISOString()
      } else if (record.createTime) {
        createTimeStr = typeof record.createTime === 'string' 
          ? record.createTime 
          : record.createTime.toISOString()
      }
      
      // ✅ 获取关联的实际治疗记录
      const actualTreatment = treatmentMap[record._id]
      let actualTreatmentData = null
      
      if (actualTreatment) {
        actualTreatmentData = {
          treatmentPlan: actualTreatment.treatmentPlan || '',
          medications: actualTreatment.medications || [],
          treatmentDate: actualTreatment.treatmentDate || '',
          outcome: getOutcomeText(actualTreatment.outcome || ''),
          updatedAt: actualTreatment.updatedAt
        }
      }
      
      return {
        _id: record._id,
        // 诊断结果
        diagnosisResult: primaryDiagnosis.disease || '未知疾病',
        diagnosis: primaryDiagnosis.disease || '未知疾病',
        confidence: primaryDiagnosis.confidence || 0,
        
        // 症状和输入信息
        symptoms: symptoms,
        affectedCount: affectedCount,
        dayAge: dayAge,
        temperature: 0, // 暂不使用
        
        // ✅ 诊断图片（症状图片或剖检图片）
        images: record.images || [],
        diagnosisType: record.diagnosisType || 'live_diagnosis',
        
        // 治疗方案
        treatmentDuration: treatmentDuration,
        recommendedMedications: medications.map(med => 
          typeof med === 'string' ? med : (med.name || med.medication || '')
        ).filter(m => m),
        
        // 其他可能的疾病
        possibleDiseases: (aiResult.differentialDiagnosis || aiResult.differentialCauses || []).map(dd => ({
          name: dd.disease || '',
          confidence: dd.confidence || 0
        })),
        
        // 时间和批次信息
        createTime: createTimeStr,
        diagnosisDate: createTimeStr ? createTimeStr.substring(0, 16).replace('T', ' ') : '',
        batchId: record.batchId || '',
        batchNumber: batchMap[record.batchId] || record.batchNumber || '未知批次',
        
        // 操作员信息
        operator: record.operatorName || record._openid?.substring(0, 8) || '',
        
        // 状态信息
        status: record.status || 'completed',
        reviewed: record.veterinaryReview?.reviewed || false,
        adopted: record.application?.adopted || false,
        
        // ✅ 修正信息（如果存在）
        isCorrected: record.isCorrected || false,
        correctedDiagnosis: record.correctedDiagnosis || '',
        correctionReason: record.correctionReason || '',
        veterinarianDiagnosis: record.veterinarianDiagnosis || '',
        veterinarianTreatmentPlan: record.veterinarianTreatmentPlan || '',
        aiAccuracyRating: record.aiAccuracyRating || 0,
        correctedBy: record.correctedBy || '',
        correctedByName: record.correctedByName || '',
        correctedAt: record.correctedAt || '',
        
        // ✅ 实际治疗记录（如果存在）
        actualTreatment: actualTreatmentData,
        
        // 保留原始数据以备需要
        _raw: record
      }
    })

    return {
      success: true,
      data: {
        records: mappedRecords,
        pagination: {
          page,
          pageSize,
          total: total.total,
          totalPages: Math.ceil(total.total / pageSize)
        }
      }
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取单条诊断记录详情（用于治疗记录页面）
async function getDiagnosisResult(event, openid) {
  try {
    const { diagnosisId } = event

    if (!diagnosisId) {
      throw new Error('诊断ID不能为空')
    }

    const record = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .doc(diagnosisId)
      .get()

    if (!record.data) {
      throw new Error('诊断记录不存在')
    }

    // 验证权限：只能查看自己的记录
    if (record.data._openid !== openid) {
      throw new Error('无权查看该诊断记录')
    }

    // 处理并返回诊断结果
    const aiResult = record.data.result || record.data.aiResult || {}
    const primaryDiagnosis = aiResult.primaryDiagnosis || aiResult.primaryCause || {}
    const treatmentRecommendation = aiResult.treatmentRecommendation || {}
    
    // 查询批次信息
    let batchNumber = record.data.batchNumber || '未知批次'
    if (record.data.batchId && !record.data.batchNumber) {
      try {
        const batchResult = await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
          .doc(record.data.batchId)
          .field({ batchNumber: true })
          .get()
        
        if (batchResult.data) {
          batchNumber = batchResult.data.batchNumber
        }
      } catch (batchError) {
        console.error('查询批次信息失败:', batchError)
      }
    }

    return {
      success: true,
      data: {
        // 基本信息
        diagnosisId: record.data._id,
        batchId: record.data.batchId || '',
        batchNumber: batchNumber,
        diagnosisType: record.data.diagnosisType || 'live_diagnosis',
        
        // 诊断结果
        primaryDiagnosis: primaryDiagnosis.disease || '未知疾病',
        confidence: primaryDiagnosis.confidence || 0,
        reasoning: primaryDiagnosis.reasoning || '',
        
        // 症状信息
        symptoms: record.data.symptomsText || (Array.isArray(record.data.symptoms) ? record.data.symptoms.join('、') : ''),
        affectedCount: record.data.affectedCount || record.data.deathCount || 0,
        dayAge: record.data.dayAge || 0,
        
        // 治疗建议
        treatmentRecommendation: treatmentRecommendation,
        medications: treatmentRecommendation.medication || [],
        
        // 完整的AI结果（供需要时使用）
        fullResult: aiResult,
        
        // 时间信息
        createdAt: record.data.createdAt || record.data.createTime || '',
        status: record.data.status || 'completed'
      }
    }
  } catch (error) {
    console.error('获取诊断结果失败:', error)
    return {
      success: false,
      error: error.message,
      message: error.message || '获取诊断结果失败'
    }
  }
}

// 更新诊断审查状态
async function updateDiagnosisReview(event, openid) {
  try {
    const { recordId, reviewData } = event
    const { agreement, comments, adjustments, reviewerName } = reviewData

    const updateData = {
      'veterinaryReview.reviewed': true,
      'veterinaryReview.reviewerId': openid,
      'veterinaryReview.reviewerName': reviewerName || '兽医师',
      'veterinaryReview.reviewTime': new Date().toISOString(),
      'veterinaryReview.agreement': agreement || 'medium',
      'veterinaryReview.comments': comments || '',
      'veterinaryReview.adjustments': adjustments || [],
      updateTime: new Date().toISOString()
    }

    await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断审查更新成功'
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}

// 采用诊断建议
async function adoptDiagnosis(event, openid) {
  try {
    const { recordId, treatmentPlanId, adopter } = event

    const updateData = {
      'application.adopted': true,
      'application.adoptedBy': openid,
      'application.adoptionTime': new Date().toISOString(),
      'application.treatmentPlanId': treatmentPlanId || null,
      updateTime: new Date().toISOString()
    }

    await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断建议已采用'
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}

// 诊断反馈
async function feedbackDiagnosis(event, openid) {
  try {
    const { recordId, feedback } = event
    const { useful, accuracy, comments, outcome } = feedback

    const updateData = {
      'application.feedback': {
        useful: useful || true,
        accuracy: accuracy || 5,
        comments: comments || '',
        feedbackTime: new Date().toISOString()
      },
      'application.outcome': outcome || null,
      updateTime: new Date().toISOString()
    }

    await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断反馈提交成功'
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取诊断统计
async function getDiagnosisStats(event, openid) {
  try {
    const { dateRange } = event

    let query = db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .where({
        _openid: openid,
        isDeleted: false  // ✅ 使用 false 替代 neq(true)，索引性能最优
      })

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.get()

    // 统计分析
    const stats = {
      totalDiagnosis: records.data.length,
      reviewedCount: records.data.filter(r => r.veterinaryReview.reviewed).length,
      adoptedCount: records.data.filter(r => r.application.adopted).length,
      avgConfidence: 0,
      diseaseStats: {},
      severityStats: {},
      modelStats: {}
    }

    let totalConfidence = 0
    
    records.data.forEach(record => {
      const confidence = record.aiResult.primaryDiagnosis.confidence || 0
      totalConfidence += confidence

      const disease = record.aiResult.primaryDiagnosis.disease || '未知'
      stats.diseaseStats[disease] = (stats.diseaseStats[disease] || 0) + 1

      const severity = record.aiResult.severity || 'unknown'
      stats.severityStats[severity] = (stats.severityStats[severity] || 0) + 1

      const model = record.aiResult.modelInfo?.modelName || 'unknown'
      stats.modelStats[model] = (stats.modelStats[model] || 0) + 1
    })

    if (records.data.length > 0) {
      stats.avgConfidence = Math.round(totalConfidence / records.data.length)
    }

    // 计算采用率和准确率
    stats.adoptionRate = stats.totalDiagnosis > 0 ? 
      Math.round((stats.adoptedCount / stats.totalDiagnosis) * 100) : 0

    stats.reviewRate = stats.totalDiagnosis > 0 ? 
      Math.round((stats.reviewedCount / stats.totalDiagnosis) * 100) : 0

    return {
      success: true,
      data: stats
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}
