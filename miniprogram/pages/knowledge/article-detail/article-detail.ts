import { createPageWithNavbar } from '../../../utils/navigation'

interface ArticleDetail {
  id: number
  title: string
  description: string
  category?: string
  categoryName?: string
  categoryTheme?: string
  views?: string
  readTime?: string
  date?: string
  content?: string
}

const pageConfig = {
  data: {
    article: null as ArticleDetail | null,
    contentParagraphs: [] as string[],
    themeClass: 'theme-default'
  },

  onLoad(options: Record<string, any>) {
    try {
      const encodedArticle = options?.article
      if (!encodedArticle) {
        throw new Error('missing article payload')
      }

      const article: ArticleDetail = JSON.parse(decodeURIComponent(encodedArticle))
      const content = article.content || article.description || ''
      const contentParagraphs = content
        .split('\n')
        .map(paragraph => paragraph.trim())
        .filter(Boolean)

      this.setData({
        article,
        contentParagraphs,
        themeClass: this.getThemeClass(article.categoryTheme)
      })
    } catch (error) {
      console.error('文章详情加载失败', error)
      wx.showToast({
        title: '文章加载失败',
        icon: 'none'
      })
      setTimeout(() => {
        this.goBack()
      }, 1500)
    }
  },

  getThemeClass(theme?: string) {
    switch (theme) {
      case 'success':
        return 'theme-success'
      case 'danger':
        return 'theme-danger'
      case 'warning':
        return 'theme-warning'
      case 'primary':
        return 'theme-primary'
      default:
        return 'theme-default'
    }
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
}

Page(createPageWithNavbar(pageConfig))


