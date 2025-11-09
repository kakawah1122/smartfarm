// knowledge-management/index.js - 知识库文章管理云函数
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 验证用户是否为管理员
async function validateAdminPermission(openid) {
  try {
    const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
    if (user.data.length === 0) return false
    
    const userRole = user.data[0].role || 'employee'
    return ['super_admin', 'manager'].includes(userRole)
  } catch (error) {
    return false
  }
}

// 获取文章列表
async function listArticles(event, wxContext) {
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    return {
      success: false,
      error: '权限不足',
      message: '仅管理员可访问'
    }
  }

  try {
    const { category, page = 1, pageSize = 20, keyword } = event
    
    let query = db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
    
    // 分类筛选
    if (category && category !== 'all') {
      query = query.where({ category })
    }
    
    // 关键词搜索
    if (keyword) {
      query = query.where({
        $or: [
          { title: db.RegExp({ regexp: keyword, options: 'i' }) },
          { description: db.RegExp({ regexp: keyword, options: 'i' }) }
        ]
      })
    }
    
    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取总数
    const countResult = await query.count()
    const total = countResult.total
    
    return {
      success: true,
      data: {
        list: result.data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取文章列表失败'
    }
  }
}

// 获取单篇文章
async function getArticle(event, wxContext) {
  try {
    const { id } = event
    
    if (!id) {
      return {
        success: false,
        error: '缺少文章ID',
        message: '请提供文章ID'
      }
    }
    
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .doc(id)
      .get()
    
    if (result.data) {
      return {
        success: true,
        data: result.data
      }
    } else {
      return {
        success: false,
        error: '文章不存在',
        message: '未找到该文章'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取文章失败'
    }
  }
}

// 创建文章
async function createArticle(event, wxContext) {
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    return {
      success: false,
      error: '权限不足',
      message: '仅管理员可创建文章'
    }
  }

  try {
    const { title, description, category, categoryName, categoryTheme, content, views, readTime, date } = event
    
    if (!title || !content) {
      return {
        success: false,
        error: '缺少必填字段',
        message: '标题和内容为必填项'
      }
    }
    
    // 获取用户信息
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .get()
    const operator = userResult.data[0]?.nickName || '管理员'
    
    const articleData = {
      title,
      description: description || '',
      category: category || 'all',
      categoryName: categoryName || '全部',
      categoryTheme: categoryTheme || 'default',
      content,
      views: views || '0',
      readTime: readTime || '5',
      date: date || new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      operator,
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      status: 'published' // published, draft
    }
    
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES).add({
      data: articleData
    })
    
    return {
      success: true,
      data: {
        _id: result._id,
        ...articleData
      },
      message: '文章创建成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建文章失败'
    }
  }
}

// 更新文章
async function updateArticle(event, wxContext) {
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    return {
      success: false,
      error: '权限不足',
      message: '仅管理员可更新文章'
    }
  }

  try {
    const { id, title, description, category, categoryName, categoryTheme, content, views, readTime, date } = event
    
    if (!id) {
      return {
        success: false,
        error: '缺少文章ID',
        message: '请提供文章ID'
      }
    }
    
    // 获取用户信息
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .get()
    const operator = userResult.data[0]?.nickName || '管理员'
    
    const updateData = {
      updateTime: db.serverDate(),
      operator
    }
    
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category
    if (categoryName !== undefined) updateData.categoryName = categoryName
    if (categoryTheme !== undefined) updateData.categoryTheme = categoryTheme
    if (content !== undefined) updateData.content = content
    if (views !== undefined) updateData.views = views
    if (readTime !== undefined) updateData.readTime = readTime
    if (date !== undefined) updateData.date = date
    
    await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .doc(id)
      .update({
        data: updateData
      })
    
    return {
      success: true,
      message: '文章更新成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '更新文章失败'
    }
  }
}

// 删除文章
async function deleteArticle(event, wxContext) {
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    return {
      success: false,
      error: '权限不足',
      message: '仅管理员可删除文章'
    }
  }

  try {
    const { id } = event
    
    if (!id) {
      return {
        success: false,
        error: '缺少文章ID',
        message: '请提供文章ID'
      }
    }
    
    await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .doc(id)
      .remove()
    
    return {
      success: true,
      message: '文章删除成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '删除文章失败'
    }
  }
}

// 批量删除文章
async function deleteArticles(event, wxContext) {
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    return {
      success: false,
      error: '权限不足',
      message: '仅管理员可删除文章'
    }
  }

  try {
    const { ids } = event
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: '缺少文章ID列表',
        message: '请提供要删除的文章ID列表'
      }
    }
    
    // 批量删除
    const _ = db.command
    await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where({
        _id: _.in(ids)
      })
      .remove()
    
    return {
      success: true,
      message: `成功删除 ${ids.length} 篇文章`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '批量删除失败'
    }
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'list':
        return await listArticles(event, wxContext)
      case 'get':
        return await getArticle(event, wxContext)
      case 'create':
        return await createArticle(event, wxContext)
      case 'update':
        return await updateArticle(event, wxContext)
      case 'delete':
        return await deleteArticle(event, wxContext)
      case 'delete_batch':
        return await deleteArticles(event, wxContext)
      default:
        return {
          success: false,
          error: '无效的操作类型',
          message: '不支持的操作'
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}




