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
    hotArticle: {
      id: 0,
      title: '春季鹅群管理要点及注意事项',
      description: '春季是鹅群繁殖的关键时期，掌握正确的管理方法对提高产蛋率和孵化率至关重要...',
      category: 'breeding',
      categoryName: '饲养技术',
      categoryTheme: 'success',
      views: '1,248',
      readTime: '7',
      date: '3月15日',
      content: '春季气候多变，是鹅群繁殖的重要季节，合理的饲养管理对于提升种鹅产蛋率、种蛋受精率和鹅苗成活率至关重要。\n在气温偏低的早春阶段要加强保温工作，夜间适当加设保温灯或暖风，提高鹅舍温度，避免寒冷刺激导致的产蛋下降。\n做好营养补充，合理搭配日粮，提高优质蛋白和能量饲料比例，并根据产蛋情况适量补充维生素及微量元素，以满足产蛋鹅较高的营养需求。\n保持鹅舍干燥清洁，定期进行消毒并加强通风，减少病原滋生。\n每天定时巡检鹅群，及时发现啄毛、精神不振等异常情况并处理。只有稳定的环境和科学的营养管理，才能让春季鹅群保持旺盛的生产性能。'
    },
    
    // 文章列表
    articles: [
      {
        id: 1,
        title: '鹅苗育雏期的温度控制与环境管理',
        description: '育雏期是鹅苗成长的关键阶段，合理的温度控制和环境管理能有效提高成活率...',
        category: 'breeding',
        categoryName: '饲养技术',
        categoryColor: 'green',
        categoryTheme: 'success',
        views: '892',
        readTime: '5',
        date: '3月14日',
        content: '育雏阶段是鹅苗成长的关键时期，温度控制直接关系到成活率。前7日保持舍内温度在28-30℃，此后每周降低2-3℃，直至与外界温度接近。\n湿度保持在60%-65%，同时加强通风防止氨气积聚。\n在日常管理中要做到“勤看、勤添、勤清理”，及时补充干净饮水，保持垫料干燥并定期翻动，减少病原滋生。'
      },
      {
        id: 2,
        title: '禽流感防控措施与早期识别方法',
        description: '禽流感是威胁鹅群健康的重要疾病，早期识别和及时预防是关键...',
        category: 'disease',
        categoryName: '疾病防治',
        categoryColor: 'red',
        categoryTheme: 'danger',
        views: '1,156',
        readTime: '8',
        date: '3月13日',
        content: '禽流感防控的核心在于“早发现、快隔离、严消毒”。\n养殖场应建立常态化体温监测机制，一旦发现异常精神、采食量下降或呼吸道症状，应立即隔离观察并上报兽医。\n做好场区分区管理，入口设立消毒池，坚持人员车辆进出消毒并做好记录。\n疫苗接种要按照免疫程序执行，必要时进行紧急补免。'
      },
      {
        id: 3,
        title: '优质肉鹅品种对比及选择建议',
        description: '不同鹅品种在生长性能、肉质品质、适应性等方面存在差异...',
        category: 'breed',
        categoryName: '品种介绍',
        categoryColor: 'blue',
        categoryTheme: 'primary',
        views: '743',
        readTime: '6',
        date: '3月12日',
        content: '常见肉鹅品种包括朗德鹅、狮头鹅、潇湘鹅等，不同品种在生长速度、胴体品质和环境适应性方面存在差异。\n选择时应结合养殖模式、市场需求和当地气候。\n朗德鹅适合生产肥肝，狮头鹅生长快、体型大，潇湘鹅适应南方湿热环境。合理搭配品种可提升整体养殖效益。'
      },
      {
        id: 4,
        title: '2024年鹅肉市场行情分析与前景预测',
        description: '分析当前鹅肉市场供需状况、价格走势，预测未来市场发展趋势...',
        category: 'market',
        categoryName: '市场分析',
        categoryColor: 'orange',
        categoryTheme: 'warning',
        views: '654',
        readTime: '10',
        date: '3月11日',
        content: '2024年鹅肉市场总体供需稳中偏紧，节假日和冷链需求提升是主要增长动力。\n预计三季度后需求回落，价格会出现季节性波动。\n养殖端应关注饲料成本和疫病风险，合理安排补栏节奏，结合本地消费习惯拓展直销或预制菜渠道，以提升收益稳定性。'
      }
    ],
    
    // 收藏文章
    collections: [
      {
        id: 1,
        title: '春季鹅群管理要点',
        collectedDate: '3月15日',
        articleId: 0
      },
      {
        id: 2,
        title: '禽流感防控措施',
        collectedDate: '3月13日',
        articleId: 2
      }
    ],
    
    filteredArticles: []
  },

  onLoad() {
    this.setData({
      filteredArticles: this.data.articles
    })
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
    if (!keyword) {
      this.setData({
        filteredArticles: this.data.articles
      })
      return
    }

    const filtered = this.data.articles.filter(article => 
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
    this.setData({
      activeCategory: categoryId
    })

    if (categoryId === 'all') {
      this.setData({
        filteredArticles: this.data.articles
      })
    } else {
      const filtered = this.data.articles.filter(article => article.category === categoryId)
      this.setData({
        filteredArticles: filtered
      })
    }
  },

  // 查看文章
  viewArticle(e: any) {
    const dataset = e.currentTarget.dataset
    let article = dataset.item

    if (!article && typeof dataset.articleId === 'number') {
      if (dataset.articleId === this.data.hotArticle.id) {
        article = this.data.hotArticle
      } else {
        article = this.data.articles.find(item => item.id === dataset.articleId)
      }
    }

    if (!article) {
      wx.showToast({ title: '文章信息不存在', icon: 'none' })
      return
    }

    try {
      const payload = encodeURIComponent(JSON.stringify(article))
      wx.navigateTo({
        url: `/pages/knowledge/article-detail/article-detail?article=${payload}`
      })
    } catch (error) {
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
