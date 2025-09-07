// health-record-detail.ts - 健康记录详情页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    record: {} as any,
    loading: true
  },

  onLoad(options: any) {
    // 首先尝试从云函数加载，失败后使用全局数据
    const recordId = options.recordId
    if (recordId && recordId !== 'unknown') {
      this.loadRecordDetail(recordId)
    } else {
      this.loadFromGlobalData()
    }
  },

  // 加载记录详情（云函数方案）
  async loadRecordDetail(recordId: string) {
    try {
      wx.showLoading({
        title: '加载中...'
      })

      // 调用云函数获取详情
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_health_record_detail',
          recordId: recordId
        }
      })

      if (result.result && result.result.success) {
        // 云函数成功获取到数据
        const recordData = result.result.data
        this.processRecordData(recordData)
      } else {
        // 云函数调用成功但没有获取到数据（如记录不存在）
        // 这是正常情况，降级到全局数据方案
        this.loadFromGlobalData()
      }
    } catch (error) {
      // 云函数调用失败，降级到全局数据方案
      this.loadFromGlobalData()
    } finally {
      wx.hideLoading()
    }
  },

  // 从全局数据加载（备用方案）
  loadFromGlobalData() {
    try {
      const app = getApp<any>()
      const currentRecord = app.globalData?.currentHealthRecord
      
      
      if (currentRecord) {
        // 有数据，直接处理
        this.processRecordData(currentRecord)
      } else {
        // 没有全局数据，设置加载完成并显示错误
        this.setData({
          loading: false
        })
        
        wx.showModal({
          title: '提示',
          content: '未找到记录信息，是否返回上一页？',
          confirmText: '返回',
          cancelText: '留在此页',
          success: (res) => {
            if (res.confirm) {
              wx.navigateBack()
            }
          }
        })
      }
    } catch (error) {
      console.error('从全局数据加载失败:', error)
      
      this.setData({
        loading: false
      })
      
      wx.showModal({
        title: '加载失败',
        content: '页面加载出错，是否返回上一页？',
        confirmText: '返回',
        cancelText: '重试',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack()
          } else {
            // 重试加载
            this.setData({ loading: true })
            this.loadFromGlobalData()
          }
        }
      })
    }
  },

  // 处理记录数据
  processRecordData(recordData: any) {
    console.log('=== 处理记录数据 ===', recordData)
    
    // 如果数据结构包含healthRecord字段，则提取healthRecord
    const actualRecord = recordData.healthRecord || recordData
    
    console.log('=== 实际记录数据 ===', actualRecord)
    console.log('actualRecord.diagnosisDisease:', actualRecord.diagnosisDisease)
    console.log('actualRecord.symptoms:', actualRecord.symptoms)
    console.log('actualRecord.affectedCount:', actualRecord.affectedCount)
    console.log('actualRecord.result:', actualRecord.result)
    
    const curedCount = actualRecord.curedCount || 0
    const deathCount = actualRecord.deathCount || 0
    const remainingCount = (actualRecord.currentAffectedCount !== undefined) 
      ? actualRecord.currentAffectedCount 
      : Math.max(0, (actualRecord.abnormalCount || actualRecord.affectedCount || 0) - curedCount - deathCount)

    // 判断是否可以跟进治疗
    const canFollowUp = (actualRecord.result === 'ongoing' || remainingCount > 0) 
      && (actualRecord.recordType !== 'cure' && actualRecord.recordType !== 'death')

    // 处理记录状态显示
    let status = actualRecord.result === 'ongoing' ? '治疗中' : 
                 actualRecord.result === 'cured' ? '已治愈' : 
                 actualRecord.result === 'death' ? '已死亡' : '未知状态'

    if (actualRecord.recordType === 'cure') {
      status = '治愈记录'
    } else if (actualRecord.recordType === 'death') {
      status = '死亡记录'
    }

    const processedRecord = {
      id: actualRecord._id || actualRecord.id || 'unknown',
      location: actualRecord.diagnosisDisease || actualRecord.location || '未确诊',
      symptoms: actualRecord.symptoms || '无症状描述',
      treatment: actualRecord.treatment || '暂无治疗方案',
      priorityText: this.getPriorityText(actualRecord.severity, actualRecord.recordType),
      severity: this.getSeverityTheme(actualRecord.severity, actualRecord.recordType),
      affectedCount: actualRecord.abnormalCount || actualRecord.affectedCount || actualRecord.cureCount || actualRecord.deathCount || 0,
      status: status,
      date: actualRecord.displayDate || actualRecord.recordDate || actualRecord.date || '未知时间',
      time: actualRecord.createTime ? new Date(actualRecord.createTime).toLocaleTimeString() : (actualRecord.time || ''),
      operator: actualRecord.operator || '系统用户',
      curedCount,
      deathCount, 
      remainingCount,
      hasFollowUp: curedCount > 0 || deathCount > 0 || remainingCount !== (actualRecord.abnormalCount || actualRecord.affectedCount || 0),
      canFollowUp,
      rawRecord: actualRecord
    }
    
    console.log('=== 处理后的记录数据 ===', processedRecord)

    // console.log('处理后的记录数据:', processedRecord)

    this.setData({
      loading: false,
      record: processedRecord
    })
  },

  // 获取严重程度主题
  getSeverityTheme(severity: string, recordType?: string): string {
    if (recordType === 'cure') return 'success'
    if (recordType === 'death') return 'danger'
    
    const themes = {
      'mild': 'success',
      'moderate': 'warning', 
      'severe': 'danger'
    }
    return themes[severity] || 'primary'
  },

  // 获取优先级文本
  getPriorityText(severity: string, recordType?: string): string {
    if (recordType === 'cure') return '治愈'
    if (recordType === 'death') return '死亡'
    
    const texts = {
      'mild': '轻微',
      'moderate': '中等',
      'severe': '严重'
    }
    return texts[severity] || '未知'
  },

  // 跳转到治疗跟进页面
  goToFollowUp() {
    const record = this.data.record
    const recordId = record.id
    const diagnosisDisease = record.rawRecord?.diagnosisDisease || record.location
    
    console.log('跳转到跟进治疗页面:', { recordId, diagnosisDisease, record })
    
    wx.navigateTo({
      url: `/pages/treatment-followup/treatment-followup?recordId=${recordId}&diagnosisDisease=${encodeURIComponent(diagnosisDisease || '')}`
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
