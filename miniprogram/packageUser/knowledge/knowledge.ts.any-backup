// knowledge.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    showSearchBar: false,
    searchKeyword: '',
    activeCategory: 'all',
    
    // 分类
    categories: [
      { id: 'all', name: '全部' },
      { id: 'breeding', name: '饲养技术' },
      { id: 'disease', name: '疾病防治' },
      { id: 'breed', name: '品种介绍' },
      { id: 'market', name: '市场分析' }
    ],
    
    // 热门文章
    hotArticle: null as any,
    
    // 文章列表
    articles: [] as any[],
    
    filteredArticles: []
  },

  async onLoad() {
    await this.loadArticles()
  },

  // 加载文章列表
  async loadArticles() {
    try {
      wx.showLoading({ title: '加载中...', mask: true })
      
      const result = await wx.cloud.callFunction({
        name: 'knowledge-management',
        data: {
          action: 'list',
          page: 1,
          pageSize: 100 // 获取所有文章
        }
      })

      if (result.result && result.result.success) {
        const articles = result.result.data.list || []
        
        // 转换为前端需要的格式
        const formattedArticles = articles.map((article: any) => ({
          id: article._id,
          title: article.title,
          description: article.description,
          category: article.category,
          categoryName: article.categoryName,
          categoryColor: this.getCategoryColor(article.categoryTheme),
          categoryTheme: article.categoryTheme,
          views: article.views,
          readTime: article.readTime,
          date: article.date,
          content: article.content
        }))
        
        // 第一篇文章作为热门文章（仅用于首页展示）
        const hotArticle = formattedArticles.length > 0 ? formattedArticles[0] : null
        
        // 列表显示所有文章（包括热门文章）
        this.setData({
          hotArticle,
          articles: formattedArticles,
          filteredArticles: formattedArticles
        })
      } else {
        // 如果数据库没有数据，使用空数组
        this.setData({
          hotArticle: null,
          articles: [],
          filteredArticles: []
        })
      }
    } catch (error) {
      this.setData({
        hotArticle: null,
        articles: [],
        filteredArticles: []
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 根据主题获取分类颜色
  getCategoryColor(theme?: string): string {
    const colorMap: Record<string, string> = {
      'success': 'green',
      'danger': 'red',
      'primary': 'blue',
      'warning': 'orange',
      'default': 'purple'
    }
    return colorMap[theme || 'default'] || 'purple'
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  },

  // 显示搜索
  showSearch() {
    this.setData({
      showSearchBar: !this.data.showSearchBar
    })
  },

  // 搜索输入
  onSearchInput(e: any) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 搜索文章
  searchArticles() {
    const keyword = this.data.searchKeyword.toLowerCase()
    const allArticles = this.data.articles
    
    if (!keyword) {
      this.setData({
        filteredArticles: allArticles
      })
      return
    }

    const filtered = allArticles.filter(article => 
      article.title.toLowerCase().includes(keyword) ||
      article.description.toLowerCase().includes(keyword)
    )
    
    this.setData({
      filteredArticles: filtered
    })
  },

  // 选择分类 - TDesign 格式
  selectCategory(e: any) {
    const categoryId = e.detail?.value || e.currentTarget?.dataset?.id
    const allArticles = this.data.articles
    
    this.setData({
      activeCategory: categoryId
    })

    if (categoryId === 'all') {
      this.setData({
        filteredArticles: allArticles
      })
    } else {
      const filtered = allArticles.filter(article => article.category === categoryId)
      this.setData({
        filteredArticles: filtered
      })
    }
  },

  // 查看文章
  viewArticle(e: any) {
    const dataset = e.currentTarget.dataset
    let article = dataset.item

    if (!article) {
      wx.showToast({ title: '文章信息不存在', icon: 'none' })
      return
    }

    try {
      const payload = encodeURIComponent(JSON.stringify(article))
      wx.navigateTo({
        url: `/packageUser/knowledge/article-detail/article-detail?article=${payload}`
      })
    } catch (error) {
      console.error('文章跳转失败:', error)
      wx.showToast({ title: '文章打开失败', icon: 'none' })
    }
  },

  // 查看全部收藏
  viewAllCollections() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
