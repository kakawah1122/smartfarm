// 知识库数据迁移脚本
// 将硬编码的文章数据迁移到数据库
// 使用方法：在云开发控制台执行此脚本，或通过云函数调用

const { hotArticle, articles } = require('../miniprogram/utils/knowledge-data')

async function migrateKnowledgeData() {
  const db = wx.cloud.database()
  const _ = db.command
  
  const allArticles = [hotArticle, ...articles]
  let successCount = 0
  let errorCount = 0
  
  for (const article of allArticles) {
    try {
      // 检查是否已存在（根据标题）
      const existing = await db.collection('knowledge_articles')
        .where({
          title: article.title
        })
        .get()
      
      if (existing.data.length === 0) {
        // 创建新文章
        await db.collection('knowledge_articles').add({
          data: {
            title: article.title,
            description: article.description,
            category: article.category,
            categoryName: article.categoryName,
            categoryTheme: article.categoryTheme || 'default',
            content: article.content,
            views: article.views || '0',
            readTime: article.readTime || '5',
            date: article.date || new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
            operator: '系统迁移',
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
            status: 'published'
          }
        })
        successCount++
      } else {
        // 已存在，跳过
      }
    } catch (error) {
      errorCount++
    }
  }
  
  return {
    success: true,
    message: `迁移完成：成功 ${successCount} 条，失败 ${errorCount} 条`
  }
}

// 如果作为云函数调用
if (typeof cloud !== 'undefined') {
  exports.main = async (event, context) => {
    return await migrateKnowledgeData()
  }
}

// 如果直接执行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { migrateKnowledgeData }
}










