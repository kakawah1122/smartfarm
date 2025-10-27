// 在微信开发者工具 - 控制台中执行这段代码
// 查看最近一次失败的诊断任务详情

const db = wx.cloud.database()

db.collection('ai_diagnosis_tasks')
  .where({
    status: 'failed'
  })
  .orderBy('createdAt', 'desc')
  .limit(1)
  .get()
  .then(res => {
    console.log('========== 诊断失败详情 ==========')
    console.log('任务ID:', res.data[0]._id)
    console.log('失败时间:', res.data[0].failedAt)
    console.log('错误信息:', res.data[0].error)
    console.log('========== 完整任务数据 ==========')
    console.log(JSON.stringify(res.data[0], null, 2))
  })
  .catch(err => {
    console.error('查询失败:', err)
  })

