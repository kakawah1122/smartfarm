"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// knowledge.ts
const navigation_1 = require("../../utils/navigation");
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
            views: '1,248',
            date: '3月15日'
        },
        // 文章列表
        articles: [
            {
                id: 1,
                title: '鹅苗育雏期的温度控制与环境管理',
                description: '育雏期是鹅苗成长的关键阶段，合理的温度控制和环境管理能有效提高成活率...',
                category: 'breeding',
                categoryName: '饲养技术',
                categoryIcon: '🌱',
                categoryColor: 'green',
                categoryTheme: 'success',
                views: '892',
                readTime: '5',
                date: '3月14日'
            },
            {
                id: 2,
                title: '禽流感防控措施与早期识别方法',
                description: '禽流感是威胁鹅群健康的重要疾病，早期识别和及时预防是关键...',
                category: 'disease',
                categoryName: '疾病防治',
                categoryIcon: '🏥',
                categoryColor: 'red',
                categoryTheme: 'danger',
                views: '1,156',
                readTime: '8',
                date: '3月13日'
            },
            {
                id: 3,
                title: '优质肉鹅品种对比及选择建议',
                description: '不同鹅品种在生长性能、肉质品质、适应性等方面存在差异...',
                category: 'breed',
                categoryName: '品种介绍',
                categoryIcon: '🦢',
                categoryColor: 'blue',
                categoryTheme: 'primary',
                views: '743',
                readTime: '6',
                date: '3月12日'
            },
            {
                id: 4,
                title: '2024年鹅肉市场行情分析与前景预测',
                description: '分析当前鹅肉市场供需状况、价格走势，预测未来市场发展趋势...',
                category: 'market',
                categoryName: '市场分析',
                categoryIcon: '📈',
                categoryColor: 'orange',
                categoryTheme: 'warning',
                views: '654',
                readTime: '10',
                date: '3月11日'
            }
        ],
        // 收藏文章
        collections: [
            {
                id: 1,
                title: '春季鹅群管理要点',
                collectedDate: '3月15日'
            },
            {
                id: 2,
                title: '禽流感防控措施',
                collectedDate: '3月13日'
            }
        ],
        filteredArticles: []
    },
    onLoad() {
        this.setData({
            filteredArticles: this.data.articles
        });
    },
    // 返回上一页
    goBack() {
        wx.navigateBack({
            fail: () => {
                wx.switchTab({
                    url: '/pages/index/index'
                });
            }
        });
    },
    // 显示搜索
    showSearch() {
        this.setData({
            showSearchBar: !this.data.showSearchBar
        });
    },
    // 搜索输入
    onSearchInput(e) {
        this.setData({
            searchKeyword: e.detail.value
        });
    },
    // 搜索文章
    searchArticles() {
        const keyword = this.data.searchKeyword.toLowerCase();
        if (!keyword) {
            this.setData({
                filteredArticles: this.data.articles
            });
            return;
        }
        const filtered = this.data.articles.filter(article => article.title.toLowerCase().includes(keyword) ||
            article.description.toLowerCase().includes(keyword));
        this.setData({
            filteredArticles: filtered
        });
    },
    // 选择分类 - TDesign 格式
    selectCategory(e) {
        const categoryId = e.detail?.value || e.currentTarget?.dataset?.id;
        this.setData({
            activeCategory: categoryId
        });
        if (categoryId === 'all') {
            this.setData({
                filteredArticles: this.data.articles
            });
        }
        else {
            const filtered = this.data.articles.filter(article => article.category === categoryId);
            this.setData({
                filteredArticles: filtered
            });
        }
    },
    // 查看文章
    viewArticle(e) {
        const { item } = e.currentTarget.dataset;
        wx.showModal({
            title: '文章详情',
            content: `标题：${item.title}\n\n这里会跳转到文章详情页面`,
            showCancel: false,
            success: () => {
                wx.showToast({
                    title: '功能开发中',
                    icon: 'none'
                });
            }
        });
    },
    // 查看全部收藏
    viewAllCollections() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
