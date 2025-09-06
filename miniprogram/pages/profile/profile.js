"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// profile.ts
const navigation_1 = require("../../utils/navigation");
// 获取全局应用实例
const app = getApp();
const pageConfig = {
    data: {
        // 登录状态
        isLoggedIn: false,
        // 用户信息
        userInfo: {
            name: '未设置',
            role: '用户',
            farm: '未设置',
            experience: '0',
            currentStock: '0',
            healthRate: '0',
            avatarUrl: '/assets/icons/profile.png' // 默认头像
        },
        // 云开发用户信息
        cloudUserInfo: null,
        // 财务概览
        financeOverview: {
            income: '21.2',
            incomeGrowth: '15.3',
            expense: '16.8',
            expenseGrowth: '8.7',
            profit: '4.4',
            profitGrowth: '32.1'
        },
        // 功能菜单
        menuItems: [
            {
                id: 1,
                title: '财务管理',
                description: '收支记录、AI建议、报表分析',
                icon: 'money-circle',
                page: '/pages/finance/finance'
            },
            {
                id: 2,
                title: '员工管理',
                description: '邀请码管理、员工权限设置',
                icon: 'user-group',
                page: '/pages/invite-management/invite-management',
                requiredPermission: 'employee.view'
            },
            {
                id: 3,
                title: '报销审核',
                description: '待审核报销申请、采购申请',
                icon: 'file-text',
                badge: '3'
            },
            {
                id: 4,
                title: '系统设置',
                description: '隐私设置、帮助反馈、关于我们',
                icon: 'setting'
            }
        ],
        // 待处理事项
        pendingItems: [
            {
                id: 1,
                title: '李四提交的差旅费报销',
                description: '金额：¥280 • 提交时间：今天 14:30',
                priority: 'danger',
                status: '待审核'
            },
            {
                id: 2,
                title: '王五的饲料采购申请',
                description: '饲料2吨 • 预计金额：¥6,000',
                priority: 'warning',
                status: '待审核'
            },
            {
                id: 3,
                title: '疫苗采购申请',
                description: '禽流感疫苗50支 • 预计金额：¥750',
                priority: 'primary',
                status: '待审核'
            }
        ],
        // 养殖场统计
        farmStats: {
            totalStock: '1,280',
            stockChange: '120',
            survivalRate: '95.2',
            staffCount: '8',
            adminCount: '1',
            employeeCount: '7',
            monthlyProfit: '4.4',
            profitGrowth: '32'
        },
        // 消息通知
        notifications: [
            {
                id: 1,
                title: '系统消息',
                content: '您有3条待审核的报销申请',
                time: '10分钟前',
                type: 'system',
                read: false
            },
            {
                id: 2,
                title: '健康提醒',
                content: '今日疫苗接种提醒：200只鹅需要接种',
                time: '1小时前',
                type: 'health',
                read: false
            }
        ]
    },
    onLoad() {
        this.checkLoginStatus();
        this.initUserInfo();
    },
    async onShow() {
        // 页面显示时刷新数据
        console.log('个人中心页面显示，开始检查登录状态');
        await this.checkLoginStatus();
        if (this.data.isLoggedIn) {
            console.log('用户已登录，加载云端用户信息');
            await this.loadCloudUserInfo();
        }
        else {
            console.log('用户未登录');
        }
    },
    // 检查登录状态
    async checkLoginStatus() {
        const app = getApp();
        let isLoggedIn = app.globalData.isLoggedIn || false;
        let openid = app.globalData.openid;
        // 如果应用全局状态中没有登录信息，尝试从本地存储恢复
        if (!isLoggedIn || !openid) {
            const storedOpenid = wx.getStorageSync('openid');
            const storedUserInfo = wx.getStorageSync('userInfo');
            if (storedOpenid && storedUserInfo) {
                console.log('个人中心: 从本地存储恢复登录状态');
                app.globalData.openid = storedOpenid;
                app.globalData.isLoggedIn = true;
                app.globalData.userInfo = storedUserInfo;
                isLoggedIn = true;
                openid = storedOpenid;
                // 立即更新用户信息显示
                this.setData({
                    userInfo: {
                        name: storedUserInfo.nickname || '未设置',
                        role: this.getRoleDisplayName(storedUserInfo.role || 'user'),
                        farm: storedUserInfo.farmName || '智慧养殖场',
                        experience: '1',
                        currentStock: '1280',
                        healthRate: '95.2',
                        avatarUrl: storedUserInfo.avatarUrl || '/assets/icons/profile.png'
                    }
                });
            }
        }
        this.setData({
            isLoggedIn: isLoggedIn
        });
        console.log('个人中心登录状态检查:', { isLoggedIn, hasOpenid: !!openid });
    },
    // 从云开发加载用户信息
    async loadCloudUserInfo() {
        try {
            const db = wx.cloud.database();
            const result = await db.collection('users').where({
                _openid: wx.cloud.database().command.exists(true)
            }).get();
            if (result.data.length > 0) {
                const cloudUserInfo = result.data[0];
                // 更新本地和全局用户信息
                const app = getApp();
                app.globalData.userInfo = cloudUserInfo;
                wx.setStorageSync('userInfo', cloudUserInfo);
                this.setData({
                    cloudUserInfo: cloudUserInfo,
                    userInfo: {
                        name: cloudUserInfo.nickname || '未设置',
                        role: this.getRoleDisplayName(cloudUserInfo.role || 'user'),
                        farm: cloudUserInfo.farmName || '智慧养殖场', // 使用数据库中的养殖场名称
                        experience: '1',
                        currentStock: '1280',
                        healthRate: '95.2',
                        avatarUrl: cloudUserInfo.avatarUrl || '/assets/icons/profile.png'
                    }
                });
                console.log('个人中心用户信息已更新:', {
                    name: cloudUserInfo.nickname,
                    farm: cloudUserInfo.farmName,
                    phone: cloudUserInfo.phone
                });
            }
        }
        catch (error) {
            console.error('加载用户信息失败:', error);
        }
    },
    // 初始化用户信息
    async initUserInfo() {
        if (this.data.isLoggedIn) {
            // 已登录，先尝试从本地存储获取，再从云开发加载最新信息
            const storedUserInfo = wx.getStorageSync('userInfo');
            if (storedUserInfo) {
                this.setData({
                    userInfo: {
                        name: storedUserInfo.nickname || '未设置',
                        role: '用户',
                        farm: storedUserInfo.farmName || '智慧养殖场',
                        experience: '1',
                        currentStock: '1280',
                        healthRate: '95.2',
                        avatarUrl: storedUserInfo.avatarUrl || '/assets/icons/profile.png'
                    }
                });
            }
            // 从云开发加载最新用户信息
            await this.loadCloudUserInfo();
        }
        else {
            // 未登录，显示默认信息
            this.setData({
                userInfo: {
                    name: '游客',
                    role: '用户',
                    farm: '示范养殖场',
                    experience: '0',
                    currentStock: '0',
                    healthRate: '0',
                    avatarUrl: '/assets/icons/profile.png'
                }
            });
        }
    },
    // 登录
    goToLogin() {
        wx.navigateTo({
            url: '/pages/login/login'
        });
    },
    // 云开发登录
    async cloudLogin() {
        try {
            wx.showLoading({
                title: '登录中...',
                mask: true
            });
            const app = getApp();
            await app.login();
            wx.hideLoading();
            // 更新页面状态
            this.setData({
                isLoggedIn: true
            });
            // 加载用户信息
            await this.loadCloudUserInfo();
            wx.showToast({
                title: '登录成功',
                icon: 'success'
            });
        }
        catch (error) {
            console.error('登录失败:', error);
            wx.hideLoading();
            wx.showToast({
                title: '登录失败，请重试',
                icon: 'error'
            });
        }
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
    // 查看财务详情
    viewFinanceDetail() {
        wx.navigateTo({
            url: '/pages/finance/finance',
            fail: () => {
                wx.showToast({
                    title: '功能开发中',
                    icon: 'none'
                });
            }
        });
    },
    // 导航到功能菜单
    navigateToMenu(e) {
        const { item } = e.currentTarget.dataset;
        // 检查权限
        if (item.requiredPermission && !this.hasPermission(item.requiredPermission)) {
            wx.showModal({
                title: '权限不足',
                content: '您没有访问此功能的权限，请联系管理员',
                showCancel: false
            });
            return;
        }
        // 如果是系统设置，显示设置选项
        if (item.id === 4) {
            this.showSystemSettings();
            return;
        }
        if (item.page) {
            wx.navigateTo({
                url: item.page,
                fail: () => {
                    wx.showToast({
                        title: '功能开发中',
                        icon: 'none'
                    });
                }
            });
        }
        else {
            wx.showModal({
                title: item.title,
                content: item.description,
                showCancel: false,
                success: () => {
                    wx.showToast({
                        title: '功能开发中',
                        icon: 'none'
                    });
                }
            });
        }
    },
    // 显示系统设置选项
    showSystemSettings() {
        wx.showActionSheet({
            itemList: ['隐私设置', '帮助与反馈', '关于我们'],
            success: (res) => {
                switch (res.tapIndex) {
                    case 0:
                        this.privacySettings();
                        break;
                    case 1:
                        this.helpAndFeedback();
                        break;
                    case 2:
                        this.aboutUs();
                        break;
                }
            }
        });
    },
    // 处理待办事项
    handlePendingItem(e) {
        const { item } = e.currentTarget.dataset;
        wx.showModal({
            title: '处理申请',
            content: `${item.title}\n\n${item.description}`,
            confirmText: '审核',
            success: (res) => {
                if (res.confirm) {
                    wx.showModal({
                        title: '审核操作',
                        content: '是否通过此申请？',
                        confirmText: '通过',
                        cancelText: '拒绝',
                        success: (result) => {
                            const action = result.confirm ? '通过' : '拒绝';
                            wx.showToast({
                                title: `申请已${action}`,
                                icon: 'success'
                            });
                            // 更新待处理事项列表
                            this.removePendingItem(item.id);
                        }
                    });
                }
            }
        });
    },
    // 移除待处理事项
    removePendingItem(id) {
        const pendingItems = this.data.pendingItems.filter(item => item.id !== id);
        this.setData({
            pendingItems
        });
    },
    // 更换头像 - 跳转到个人信息编辑页面
    changeAvatar() {
        if (!this.data.isLoggedIn) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '更换头像',
            content: '头像更换功能请在个人信息编辑页面进行操作',
            showCancel: true,
            confirmText: '去编辑',
            cancelText: '取消',
            success: (res) => {
                if (res.confirm) {
                    wx.navigateTo({
                        url: '/pages/login/login'
                    });
                }
            }
        });
    },
    // 编辑个人信息
    editProfile() {
        wx.showActionSheet({
            itemList: ['编辑养殖场名称', '编辑职位'],
            success: async (res) => {
                const options = ['养殖场名称', '职位'];
                const currentValues = [
                    this.data.userInfo.farm,
                    this.data.userInfo.role
                ];
                wx.showModal({
                    title: `编辑${options[res.tapIndex]}`,
                    content: `当前${options[res.tapIndex]}：${currentValues[res.tapIndex]}`,
                    placeholderText: `请输入新的${options[res.tapIndex]}`,
                    editable: true,
                    confirmText: '保存',
                    success: (modalRes) => {
                        if (modalRes.confirm && modalRes.content.trim()) {
                            this.handleSaveProfile(modalRes.content.trim(), res.tapIndex, options[res.tapIndex]);
                        }
                    }
                });
            }
        });
    },
    // 处理保存个人信息
    async handleSaveProfile(newValue, fieldIndex, fieldName) {
        try {
            wx.showLoading({
                title: '保存中...'
            });
            // 更新本地显示
            const keys = ['farm', 'role'];
            const dataKey = `userInfo.${keys[fieldIndex]}`;
            this.setData({
                [dataKey]: newValue
            });
            wx.hideLoading();
            wx.showToast({
                title: '保存成功',
                icon: 'success'
            });
        }
        catch (error) {
            wx.hideLoading();
            wx.showToast({
                title: '保存失败',
                icon: 'none'
            });
        }
    },
    // 显示消息通知
    showNotifications() {
        const unreadCount = this.data.notifications.filter(n => !n.read).length;
        const notificationList = this.data.notifications.map(n => `${n.title}: ${n.content}`).join('\n\n');
        wx.showModal({
            title: `消息通知 (${unreadCount}条未读)`,
            content: notificationList || '暂无消息',
            confirmText: '全部已读',
            cancelText: '关闭',
            success: (res) => {
                if (res.confirm) {
                    // 标记所有消息为已读
                    const notifications = this.data.notifications.map(n => ({ ...n, read: true }));
                    this.setData({ notifications });
                    wx.showToast({
                        title: '已标记为已读',
                        icon: 'success'
                    });
                }
            }
        });
    },
    // 隐私设置
    privacySettings() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 帮助与反馈
    helpAndFeedback() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 关于我们
    aboutUs() {
        wx.showModal({
            title: '关于智慧养鹅',
            content: '智慧养鹅小程序 v1.0.0\n\n集生产管理、健康监控、知识学习和财务分析于一体的专业养鹅管理系统。',
            showCancel: false
        });
    },
    // 获取角色显示名称
    getRoleDisplayName(role) {
        switch (role) {
            case 'admin':
                return '管理员';
            case 'employee':
                return '员工';
            case 'user':
            default:
                return '用户';
        }
    },
    // 检查用户权限
    hasPermission(requiredPermission) {
        const app = getApp();
        const userInfo = app.globalData.userInfo;
        if (!userInfo)
            return false;
        // 管理员拥有所有权限
        if (userInfo.role === 'admin')
            return true;
        // 检查是否有所有权限
        if (userInfo.permissions && userInfo.permissions.includes('all'))
            return true;
        // 检查特定权限
        if (userInfo.permissions && userInfo.permissions.includes(requiredPermission))
            return true;
        return false;
    },
    // 退出登录
    logout() {
        if (!this.data.isLoggedIn) {
            wx.showToast({
                title: '您还未登录',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '退出登录',
            content: '确定要退出登录吗？退出后需要重新登录才能使用完整功能。',
            success: (res) => {
                if (res.confirm) {
                    // 清除全局登录状态
                    const app = getApp();
                    app.globalData.openid = undefined;
                    app.globalData.isLoggedIn = false;
                    app.globalData.userInfo = undefined;
                    // 清除本地存储
                    wx.removeStorageSync('openid');
                    wx.removeStorageSync('userInfo');
                    // 重置页面数据
                    this.setData({
                        isLoggedIn: false,
                        cloudUserInfo: null,
                        userInfo: {
                            name: '游客',
                            role: '用户',
                            farm: '示范养殖场',
                            experience: '0',
                            currentStock: '0',
                            healthRate: '0',
                            avatarUrl: '/assets/icons/profile.png'
                        }
                    });
                    wx.showToast({
                        title: '已退出登录',
                        icon: 'success'
                    });
                    console.log('已退出登录，状态已重置');
                }
            }
        });
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
