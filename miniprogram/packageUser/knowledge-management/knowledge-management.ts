// knowledge-management.ts - 知识库文章管理页面
import { createPageWithNavbar } from '../../utils/navigation'
import { logger } from '../../utils/logger'

interface Article {
  _id?: string
  title: string
  description: string
  category: string
  categoryName: string
  categoryTheme: string
  content: string
  views: string
  readTime: string
  averageReadDuration?: number // 平均阅读时长（分钟）
  date: string
  operator?: string
  createTime?: Date
  updateTime?: Date
  updateTimeFormatted?: string // 格式化的更新时间
}

interface FormData {
  title: string
  description: string
  category: string
  categoryName: string
  categoryTheme: string
  content: string
  date: string
}

const pageConfig = {
  // 获取 message 组件实例的辅助方法
  getMessage() {
    return this.selectComponent('#t-message')
  },

  data: {
    // 文章列表
    articleList: [] as Article[],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    
    // 搜索和筛选
    searchKeyword: '',
    activeCategory: 'all',
    categories: [
      { id: 'all', name: '全部' },
      { id: 'breeding', name: '饲养技术', theme: 'success' },
      { id: 'disease', name: '疾病防治', theme: 'danger' },
      { id: 'breed', name: '品种介绍', theme: 'primary' },
      { id: 'market', name: '市场分析', theme: 'warning' }
    ],
    
    // 表单相关
    showForm: false,
    editingArticle: null as Article | null,
    formData: {
      title: '',
      description: '',
      category: 'all',
      categoryName: '全部',
      categoryTheme: 'default',
      content: '',
      date: ''
    } as FormData,
    parseText: '',
    categoryIndex: 0,
    
    // 滑动相关
    swipedId: '',
    swipeDistance: 0,
    touchStartX: 0,
    touchStartY: 0,
    isSwiping: false
  },

  onLoad() {
    this.loadArticles()
    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0]
    this.setData({
      'formData.date': today
    })
  },

  onShow() {
    // 每次显示时刷新列表
    this.loadArticles()
  },

  // 加载文章列表
  async loadArticles(reset = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const page = reset ? 1 : this.data.page
      const result = await wx.cloud.callFunction({
        name: 'knowledge-management',
        data: {
          action: 'list',
          category: this.data.activeCategory === 'all' ? undefined : this.data.activeCategory,
          keyword: this.data.searchKeyword || undefined,
          page,
          pageSize: this.data.pageSize
        }
      })

      if (result.result && result.result.success) {
        const newList = result.result.data.list || []
        
        // 格式化文章数据，添加格式化的更新时间（年月日格式）
        const formattedList = newList.map((article: Article) => {
          let updateTimeFormatted = ''
          if (article.updateTime) {
            const updateTime = article.updateTime instanceof Date 
              ? article.updateTime 
              : new Date(article.updateTime)
            const year = updateTime.getFullYear()
            const month = String(updateTime.getMonth() + 1).padStart(2, '0')
            const day = String(updateTime.getDate()).padStart(2, '0')
            updateTimeFormatted = `${year}-${month}-${day}`
          } else if (article.date) {
            // 如果没有updateTime，使用date字段
            updateTimeFormatted = article.date
          }
          
          return {
            ...article,
            updateTimeFormatted
          }
        })
        
        this.setData({
          articleList: reset ? formattedList : [...this.data.articleList, ...formattedList],
          page: page + 1,
          hasMore: newList.length >= this.data.pageSize,
          loading: false
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error: any) {
      this.setData({ loading: false })
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: error.message || '加载文章列表失败'
      })
      }
    }
  },

  // 搜索输入
  onSearchInput(e: any) {
    this.setData({
      searchKeyword: e.detail.value
    })
    // 防抖搜索
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.setData({ page: 1 })
      this.loadArticles(true)
    }, 500)
  },

  // 选择分类
  selectCategory(e: any) {
    const category = e.currentTarget.dataset.category
    this.setData({
      activeCategory: category,
      page: 1
    })
    this.loadArticles(true)
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadArticles()
    }
  },

  // 显示创建表单
  showCreateForm() {
    const today = new Date().toISOString().split('T')[0]
    // 默认选择第一个非"全部"的分类
    const defaultCategory = this.data.categories.find(cat => cat.id !== 'all') || this.data.categories[1]
    const defaultCategoryIndex = this.data.categories.findIndex(cat => cat.id === defaultCategory.id)
    
    this.setData({
      showForm: true,
      editingArticle: null,
      formData: {
        title: '',
        description: '',
        category: defaultCategory.id,
        categoryName: defaultCategory.name,
        categoryTheme: defaultCategory.theme || 'default',
        content: '',
        date: today
      },
      parseText: '',
      categoryIndex: defaultCategoryIndex >= 0 ? defaultCategoryIndex : 1
    })
  },

  // 编辑文章
  async editArticle(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return

    wx.showLoading({ title: '加载中...', mask: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'knowledge-management',
        data: {
          action: 'get',
          id
        }
      })

      if (result.result && result.result.success) {
        const article = result.result.data
        const categoryIndex = this.data.categories.findIndex(cat => cat.id === article.category)
        
        this.setData({
          showForm: true,
          editingArticle: article,
          formData: {
            title: article.title || '',
            description: article.description || '',
            category: article.category || 'all',
            categoryName: article.categoryName || '全部',
            categoryTheme: article.categoryTheme || 'default',
            content: article.content || '',
            date: article.date || new Date().toISOString().split('T')[0]
          },
          categoryIndex: categoryIndex >= 0 ? categoryIndex : 1
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error: any) {
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: error.message || '加载文章失败'
      })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 表单输入变化
  onFormChange(e: any) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 分类选择变化
  onCategoryChange(e: any) {
    const index = e.detail.value
    const category = this.data.categories[index]
    if (category) {
      this.setData({
        categoryIndex: index,
        'formData.category': category.id,
        'formData.categoryName': category.name,
        'formData.categoryTheme': category.theme || 'default'
      })
    }
  },

  // 日期选择
  onDateChange(e: any) {
    this.setData({
      'formData.date': e.detail.value
    })
  },

  // 解析文本输入变化
  onParseTextChange(e: any) {
    this.setData({
      parseText: e.detail.value
    })
  },

  // 解析文本内容
  parseText() {
    const text = this.data.parseText.trim()
    if (!text) {
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请输入要解析的文本'
      })
      }
      return
    }

    try {
      const lines = text.split('\n').filter(line => line.trim())
      
      // 解析标题（第一行或包含"标题"的行）
      let title = ''
      let titleLineIndex = -1
      if (lines.length > 0) {
        // 查找包含"标题"的行
        const titleLineIndexFound = lines.findIndex(line => line.includes('标题') || line.includes('题目'))
        if (titleLineIndexFound >= 0) {
          titleLineIndex = titleLineIndexFound
          const titleLine = lines[titleLineIndex]
          title = titleLine.replace(/标题[：:]\s*/, '').replace(/题目[：:]\s*/, '').trim()
        } else {
          // 使用第一行作为标题
          titleLineIndex = 0
          title = lines[0].trim()
        }
      }

      // 从内容中移除标题部分
      let content = text
      if (title && titleLineIndex >= 0) {
        // 移除标题行
        const contentLines = lines.filter((line, index) => {
          // 如果标题行包含"标题"或"题目"关键词，移除整行
          if (index === titleLineIndex) {
            return false
          }
          // 如果第一行被用作标题，且该行与标题完全匹配，也移除
          if (titleLineIndex === 0 && index === 0 && line.trim() === title) {
            return false
          }
          return true
        })
        content = contentLines.join('\n').trim()
        
        // 如果内容开头仍然包含标题文本，尝试移除
        if (content.startsWith(title)) {
          content = content.substring(title.length).trim()
          // 移除开头的换行和标点符号
          content = content.replace(/^[：:。，、\s\n]+/, '')
        }
      }

      // 解析描述（内容的第一段，不包含标题）
      let description = ''
      const contentLines = content.split('\n').filter(line => line.trim())
      if (contentLines.length > 0) {
        // 取第一段作为描述
        description = contentLines[0].trim()
        // 如果第一段太长，截取前100字符
        if (description.length > 100) {
          description = description.substring(0, 100) + '...'
        }
      }

      // 解析分类关键词（使用完整文本进行关键词匹配）
      let category = 'all'
      let categoryName = '全部'
      let categoryTheme = 'default'
      const categoryKeywords = {
        'breeding': { name: '饲养技术', theme: 'success', keywords: ['饲养', '管理', '育雏', '温度', '环境', '营养', '饲料', '养殖'] },
        'disease': { name: '疾病防治', theme: 'danger', keywords: ['疾病', '防治', '治疗', '预防', '疫苗', '用药', '健康', '感染', '死亡'] },
        'breed': { name: '品种介绍', theme: 'primary', keywords: ['品种', '选择', '对比', '介绍', '特性', '狮头鹅'] },
        'market': { name: '市场分析', theme: 'warning', keywords: ['市场', '价格', '行情', '分析', '预测', '趋势', '鹅价'] }
      }

      // 使用标题和内容进行关键词匹配
      const searchText = (title + ' ' + content).toLowerCase()
      for (const [key, value] of Object.entries(categoryKeywords)) {
        if (value.keywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
          category = key
          categoryName = value.name
          categoryTheme = value.theme
          break
        }
      }

      // 解析日期（查找日期格式）
      let date = new Date().toISOString().split('T')[0]
      const dateMatch = text.match(/(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日]/)
      if (dateMatch) {
        const year = dateMatch[1]
        const month = dateMatch[2].padStart(2, '0')
        const day = dateMatch[3].padStart(2, '0')
        date = `${year}-${month}-${day}`
      }

      // 估算阅读时间（按内容字数计算，平均每分钟200字）
      const contentLength = content.length
      const estimatedReadTime = Math.max(1, Math.ceil(contentLength / 200))

      // 更新表单数据
      this.setData({
        'formData.title': title || this.data.formData.title,
        'formData.description': description || this.data.formData.description,
        'formData.category': category,
        'formData.categoryName': categoryName,
        'formData.categoryTheme': categoryTheme,
        'formData.content': content, // 使用去除标题后的内容
        'formData.readTime': estimatedReadTime.toString(),
        'formData.date': date
      })

      // 更新分类选择器索引
      const categoryIndex = this.data.categories.findIndex(cat => cat.id === category)
      if (categoryIndex >= 0) {
        this.setData({
          categoryIndex
        })
      }

      const message = this.getMessage()
      if (message) {
        message.success({
        offset: [20, 32],
        content: '文本解析成功，标题已自动提取，请检查并完善信息'
      })
      }
    } catch (error: any) {
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: '解析失败：' + (error.message || '未知错误')
      })
      }
    }
  },

  // 保存文章
  async saveArticle() {
    const { formData, editingArticle } = this.data

    // 验证必填字段
    if (!formData.title || !formData.content) {
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请填写标题和内容'
      })
      }
      return
    }

    // 验证分类
    if (!formData.category || formData.category === 'all') {
      const message = this.getMessage()
      if (message) {
        message.warning({
        offset: [20, 32],
        content: '请选择文章分类'
      })
      }
      return
    }

    wx.showLoading({ title: '保存中...', mask: true })

    try {
      if (editingArticle && editingArticle._id) {
        // 更新文章
        const result = await wx.cloud.callFunction({
          name: 'knowledge-management',
          data: {
            action: 'update',
            id: editingArticle._id,
            ...formData
          }
        })

        if (result.result && result.result.success) {
          const message = this.getMessage()
          if (message) {
            message.success({
            offset: [20, 32],
            content: '文章更新成功'
          })
          }
          this.closeForm()
          this.loadArticles(true)
        } else {
          const errorMsg = result.result?.message || result.result?.error || '更新失败'
          logger.error('Update failed:', errorMsg)
          throw new Error(errorMsg)
        }
      } else {
        // 创建文章
        const result = await wx.cloud.callFunction({
          name: 'knowledge-management',
          data: {
            action: 'create',
            ...formData
          }
        })

        if (result.result && result.result.success) {
          const message = this.getMessage()
          if (message) {
            message.success({
            offset: [20, 32],
            content: '文章创建成功'
          })
          }
          this.closeForm()
          this.loadArticles(true)
        } else {
          const errorMsg = result.result?.message || result.result?.error || '创建失败'
          logger.error('Create failed:', errorMsg)
          throw new Error(errorMsg)
        }
      }
    } catch (error: any) {
      logger.error('Save article error:', error)
      const errorMessage = error.message || error.errMsg || '保存失败，请重试'
      const message = this.getMessage()
      if (message) {
        message.error({
        offset: [20, 32],
        content: errorMessage
      })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 删除文章
  async deleteArticle(e: any) {
    const id = e.currentTarget?.dataset?.id || e.detail?.id
    if (!id) return

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这篇文章吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true })

          try {
            const result = await wx.cloud.callFunction({
              name: 'knowledge-management',
              data: {
                action: 'delete',
                id
              }
            })

            if (result.result && result.result.success) {
              const message = this.getMessage()
              if (message) {
                message.success({
                offset: [20, 32],
                content: '删除成功'
              })
              }
              // 关闭滑动状态
              this.setData({
                swipedId: '',
                swipeDistance: 0
              })
              this.loadArticles(true)
            } else {
              throw new Error(result.result?.message || '删除失败')
            }
          } catch (error: any) {
            const message = this.getMessage()
            if (message) {
              message.error({
              offset: [20, 32],
              content: error.message || '删除失败'
            })
            }
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  // 触摸开始
  onTouchStart(e: any) {
    const touch = e.touches[0]
    const id = e.currentTarget.dataset.id
    
    this.setData({
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
      isSwiping: false
    })
    
    // 如果点击的不是当前滑动的项目，关闭其他项目的滑动状态
    if (this.data.swipedId && this.data.swipedId !== id) {
      this.setData({
        swipedId: '',
        swipeDistance: 0
      })
    }
  },

  // 触摸移动
  onTouchMove(e: any) {
    const touch = e.touches[0]
    const deltaX = touch.clientX - this.data.touchStartX
    const deltaY = Math.abs(touch.clientY - this.data.touchStartY)
    const id = e.currentTarget.dataset.id
    
    // 判断是否为横向滑动（横向滑动距离大于纵向滑动距离）
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
      this.setData({
        isSwiping: true
      })
      
      // 只允许向左滑动，转换为rpx（1px ≈ 2rpx）
      if (deltaX < 0) {
        const distanceRpx = Math.max(deltaX * 2, -320) // 最大滑动距离320rpx（两个按钮宽度）
        this.setData({
          swipedId: id,
          swipeDistance: distanceRpx
        })
      } else if (deltaX > 0 && this.data.swipedId === id) {
        // 向右滑动，恢复位置
        const currentDistance = this.data.swipeDistance
        const distanceRpx = Math.min(currentDistance + deltaX * 2, 0)
        this.setData({
          swipeDistance: distanceRpx
        })
      }
    }
  },

  // 触摸结束
  onTouchEnd(e: any) {
    if (!this.data.isSwiping) {
      return
    }
    
    const id = e.currentTarget.dataset.id
    
    // 如果滑动距离超过阈值（160rpx），保持滑动状态，否则恢复
    if (Math.abs(this.data.swipeDistance) > 160) {
      this.setData({
        swipeDistance: -320 // 完全展开（两个按钮宽度）
      })
    } else {
      this.setData({
        swipedId: '',
        swipeDistance: 0
      })
    }
    
    this.setData({
      isSwiping: false
    })
  },

  // 卡片点击（编辑文章）
  onItemTap(e: any) {
    // 如果正在滑动，不触发点击
    if (this.data.isSwiping) {
      return
    }
    
    // 如果当前项目已滑动，点击时关闭滑动状态
    const id = e.currentTarget.dataset.id
    if (this.data.swipedId === id) {
      this.setData({
        swipedId: '',
        swipeDistance: 0
      })
      return
    }
    
    // 否则编辑文章
    this.editArticle(e)
  },

  // 滑动编辑按钮点击
  onSwipeEdit(e: any) {
    const id = e.currentTarget.dataset.id
    this.setData({
      swipedId: '',
      swipeDistance: 0
    })
    
    // 延迟一下再触发编辑，确保滑动状态已关闭
    setTimeout(() => {
      this.editArticle({ currentTarget: { dataset: { id } } })
    }, 100)
  },

  // 滑动删除按钮点击
  onSwipeDelete(e: any) {
    const id = e.currentTarget.dataset.id
    this.setData({
      swipedId: '',
      swipeDistance: 0
    })
    
    // 延迟一下再触发删除，确保滑动状态已关闭
    setTimeout(() => {
      this.deleteArticle({ currentTarget: { dataset: { id } } })
    }, 100)
  },

  // 关闭表单
  closeForm() {
    this.setData({
      showForm: false,
      editingArticle: null,
      parseText: ''
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 根据分类主题获取标签主题
  getThemeByCategory(theme?: string): string {
    const themeMap: Record<string, string> = {
      'success': 'success',
      'danger': 'danger',
      'primary': 'primary',
      'warning': 'warning',
      'default': 'default'
    }
    return themeMap[theme || 'default'] || 'default'
  },

  // 返回上一页
  goBack(e?: any) {
    // 阻止事件冒泡，避免 navigation-bar 执行默认返回
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
    
    const pages = getCurrentPages()
    
    if (pages.length > 1) {
      // 有上一页，正常返回
      wx.navigateBack({
        delta: 1,
        fail: (err) => {
          logger.error('返回失败:', err)
          // 返回失败，跳转到个人中心页面（tabBar页面）
          wx.switchTab({
            url: '/pages/profile/profile',
            fail: () => {
              // 如果跳转失败，尝试切换到首页
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    } else {
      // 没有上一页，直接跳转到个人中心页面（tabBar页面）
      wx.switchTab({
        url: '/pages/profile/profile',
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
    }
  },

  // 搜索定时器
  searchTimer: null as any
}

Page(createPageWithNavbar(pageConfig))




