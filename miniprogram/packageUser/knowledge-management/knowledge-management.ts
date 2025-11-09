// knowledge-management.ts - 知识库文章管理页面
import { createPageWithNavbar } from '../../utils/navigation'
import Message from 'tdesign-miniprogram/message/index'

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
  date: string
  operator?: string
  createTime?: Date
  updateTime?: Date
}

interface FormData {
  title: string
  description: string
  category: string
  categoryName: string
  categoryTheme: string
  content: string
  views: string
  readTime: string
  date: string
}

const pageConfig = {
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
      views: '0',
      readTime: '5',
      date: ''
    } as FormData,
    parseText: '',
    categoryIndex: 0
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
        
        this.setData({
          articleList: reset ? newList : [...this.data.articleList, ...newList],
          page: page + 1,
          hasMore: newList.length >= this.data.pageSize,
          loading: false
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error: any) {
      this.setData({ loading: false })
      Message.error({
        context: this,
        offset: [20, 32],
        content: error.message || '加载文章列表失败'
      })
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
    this.setData({
      showForm: true,
      editingArticle: null,
      formData: {
        title: '',
        description: '',
        category: 'all',
        categoryName: '全部',
        categoryTheme: 'default',
        content: '',
        views: '0',
        readTime: '5',
        date: today
      },
      parseText: '',
      categoryIndex: 0
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
            views: article.views || '0',
            readTime: article.readTime || '5',
            date: article.date || new Date().toISOString().split('T')[0]
          },
          categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error: any) {
      Message.error({
        context: this,
        offset: [20, 32],
        content: error.message || '加载文章失败'
      })
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
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请输入要解析的文本'
      })
      return
    }

    try {
      // 解析标题（第一行或包含"标题"的行）
      let title = ''
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length > 0) {
        // 查找包含"标题"的行
        const titleLine = lines.find(line => line.includes('标题') || line.includes('题目'))
        if (titleLine) {
          title = titleLine.replace(/标题[：:]\s*/, '').replace(/题目[：:]\s*/, '').trim()
        } else {
          // 使用第一行作为标题
          title = lines[0].trim()
        }
      }

      // 解析描述（标题后的第一段）
      let description = ''
      if (lines.length > 1) {
        description = lines.slice(1).find(line => line.trim().length > 10) || ''
        if (description.length > 100) {
          description = description.substring(0, 100) + '...'
        }
      }

      // 解析分类关键词
      let category = 'all'
      let categoryName = '全部'
      let categoryTheme = 'default'
      const categoryKeywords = {
        'breeding': { name: '饲养技术', theme: 'success', keywords: ['饲养', '管理', '育雏', '温度', '环境', '营养', '饲料'] },
        'disease': { name: '疾病防治', theme: 'danger', keywords: ['疾病', '防治', '治疗', '预防', '疫苗', '用药', '健康'] },
        'breed': { name: '品种介绍', theme: 'primary', keywords: ['品种', '选择', '对比', '介绍', '特性'] },
        'market': { name: '市场分析', theme: 'warning', keywords: ['市场', '价格', '行情', '分析', '预测', '趋势'] }
      }

      for (const [key, value] of Object.entries(categoryKeywords)) {
        if (value.keywords.some(keyword => text.includes(keyword))) {
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

      // 估算阅读时间（按字数计算，平均每分钟200字）
      const contentLength = text.length
      const estimatedReadTime = Math.max(1, Math.ceil(contentLength / 200))

      // 更新表单数据
      this.setData({
        'formData.title': title || this.data.formData.title,
        'formData.description': description || this.data.formData.description,
        'formData.category': category,
        'formData.categoryName': categoryName,
        'formData.categoryTheme': categoryTheme,
        'formData.content': text,
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

      Message.success({
        context: this,
        offset: [20, 32],
        content: '文本解析成功，请检查并完善信息'
      })
    } catch (error: any) {
      Message.error({
        context: this,
        offset: [20, 32],
        content: '解析失败：' + (error.message || '未知错误')
      })
    }
  },

  // 保存文章
  async saveArticle() {
    const { formData, editingArticle } = this.data

    // 验证必填字段
    if (!formData.title || !formData.content) {
      Message.warning({
        context: this,
        offset: [20, 32],
        content: '请填写标题和内容'
      })
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
          Message.success({
            context: this,
            offset: [20, 32],
            content: '文章更新成功'
          })
          this.closeForm()
          this.loadArticles(true)
        } else {
          throw new Error(result.result?.message || '更新失败')
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
          Message.success({
            context: this,
            offset: [20, 32],
            content: '文章创建成功'
          })
          this.closeForm()
          this.loadArticles(true)
        } else {
          throw new Error(result.result?.message || '创建失败')
        }
      }
    } catch (error: any) {
      Message.error({
        context: this,
        offset: [20, 32],
        content: error.message || '保存失败'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 删除文章
  async deleteArticle(e: any) {
    const id = e.currentTarget.dataset.id
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
              Message.success({
                context: this,
                offset: [20, 32],
                content: '删除成功'
              })
              this.loadArticles(true)
            } else {
              throw new Error(result.result?.message || '删除失败')
            }
          } catch (error: any) {
            Message.error({
              context: this,
              offset: [20, 32],
              content: error.message || '删除失败'
            })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
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
  }
}

Page(createPageWithNavbar(pageConfig))




