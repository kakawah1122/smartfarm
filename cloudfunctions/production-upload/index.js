// cloudfunctions/production-upload/index.js
// 生产管理文件上传云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'get_upload_url':
        return await getUploadUrl(event, wxContext)
      case 'save_file_info':
        return await saveFileInfo(event, wxContext)
      case 'delete_file':
        return await deleteFile(event, wxContext)
      case 'get_file_list':
        return await getFileList(event, wxContext)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '文件操作失败，请重试'
    }
  }
}

// 获取上传URL（用于前端直接上传到云存储）
async function getUploadUrl(event, wxContext) {
  const { fileType, fileName, category } = event
  
  if (!fileType || !fileName) {
    throw new Error('缺少文件类型或文件名')
  }
  
  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  
  if (!allowedTypes.includes(fileType)) {
    throw new Error('不支持的文件类型')
  }
  
  // 生成文件路径
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  
  const fileExtension = fileName.split('.').pop()
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  
  const cloudPath = `production/${category || 'general'}/${year}/${month}/${day}/${timestamp}_${randomStr}.${fileExtension}`
  
  return {
    success: true,
    data: {
      cloudPath,
      uploadUrl: null, // 小程序使用wx.cloud.uploadFile，不需要预签名URL
      fileId: cloudPath,
      maxSize: 10 * 1024 * 1024 // 10MB限制
    }
  }
}

// 保存文件信息到数据库
async function saveFileInfo(event, wxContext) {
  const { fileInfo } = event
  
  if (!fileInfo || !fileInfo.fileID || !fileInfo.originalName) {
    throw new Error('缺少文件信息')
  }
  
  const now = new Date()
  const fileRecord = {
    userId: wxContext.OPENID,
    fileID: fileInfo.fileID,
    originalName: fileInfo.originalName,
    cloudPath: fileInfo.cloudPath || fileInfo.fileID,
    fileType: fileInfo.fileType || '',
    fileSize: fileInfo.fileSize || 0,
    category: fileInfo.category || 'general',
    relatedType: fileInfo.relatedType || '', // entry/exit/material
    relatedId: fileInfo.relatedId || '',     // 关联记录ID
    description: fileInfo.description || '',
    isActive: true,
    createTime: now,
    updateTime: now
  }
  
  const result = await db.collection('file_static_records').add({
    data: fileRecord
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      ...fileRecord
    },
    message: '文件信息保存成功'
  }
}

// 删除文件
async function deleteFile(event, wxContext) {
  const { fileId } = event
  
  if (!fileId) {
    throw new Error('缺少文件ID')
  }
  
  // 获取文件记录
  const fileRecord = await db.collection('file_static_records').doc(fileId).get()
  
  if (!fileRecord.data.length) {
    throw new Error('文件记录不存在')
  }
  
  const file = fileRecord.data[0]
  
  try {
    // 删除云存储文件
    await cloud.deleteFile({
      fileList: [file.fileID]
    })
    
    // 删除数据库记录
    await db.collection('file_static_records').doc(fileId).remove()
    
    return {
      success: true,
      message: '文件删除成功'
    }
  } catch (error) {
    // 如果云存储删除失败，至少要软删除数据库记录
    await db.collection('file_static_records').doc(fileId).update({
      data: {
        isActive: false,
        updateTime: new Date()
      }
    })
    
    return {
      success: true,
      message: '文件标记删除成功'
    }
  }
}

// 获取文件列表
async function getFileList(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 20, 
    category = null,
    relatedType = null,
    relatedId = null,
    keyword = null 
  } = event
  
  let query = db.collection('file_static_records').where({ isActive: true })
  
  // 构建查询条件
  const where = { isActive: true }
  
  if (category) {
    where.category = category
  }
  
  if (relatedType) {
    where.relatedType = relatedType
  }
  
  if (relatedId) {
    where.relatedId = relatedId
  }
  
  if (keyword) {
    where.originalName = db.RegExp({
      regexp: keyword,
      options: 'i'
    })
  }
  
  if (Object.keys(where).length > 1) {  // 除了isActive之外还有其他条件
    query = query.where(where)
  }
  
  // 分页查询
  const countResult = await query.count()
  const total = countResult.total
  
  const files = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  // 生成临时访问链接
  const filesWithUrls = await Promise.all(
    files.data.map(async (file) => {
      try {
        const result = await cloud.getTempFileURL({
          fileList: [file.fileID],
          maxAge: 7200 // 2小时有效期
        })
        
        return {
          ...file,
          tempFileURL: result.fileList[0]?.tempFileURL || ''
        }
      } catch (error) {
        return {
          ...file,
          tempFileURL: ''
        }
      }
    })
  )
  
  return {
    success: true,
    data: {
      files: filesWithUrls,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}
