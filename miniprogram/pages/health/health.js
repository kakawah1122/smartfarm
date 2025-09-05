"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// health.ts
const navigation_1 = require("../../utils/navigation");
const pageConfig = {
    data: {
        activeTab: 'record',
        // 健康统计
        healthStats: {
            healthRate: 95,
            abnormal: 5,
            records: 12
        },
        // 上传的图片
        uploadedImages: [],
        // 健康记录
        healthRecords: [
            {
                id: 1,
                location: '1号鹅舍异常情况',
                symptoms: '3只鹅出现精神萎靡、食欲不振、轻微腹泻等症状',
                treatment: '已隔离观察，投喂止泻药物',
                severity: 'danger',
                statusIcon: '🚨',
                priorityText: '紧急',
                date: '2024-03-15',
                time: '09:30',
                operator: '张三',
                status: '待跟进'
            },
            {
                id: 2,
                location: '2号鹅舍日常检查',
                symptoms: '鹅群状态良好，食欲正常，无异常症状发现',
                treatment: '预防性消毒已完成',
                severity: 'success',
                statusIcon: '✅',
                priorityText: '正常',
                date: '2024-03-14',
                time: '16:00',
                operator: '李四',
                status: '已处理'
            }
        ],
        // 疫苗提醒
        vaccineReminders: [
            {
                id: 1,
                name: '禽流感疫苗',
                location: '1号鹅舍',
                scheduledDate: '明天 (3月16日)'
            },
            {
                id: 2,
                name: '新城疫疫苗',
                location: '2号鹅舍',
                scheduledDate: '后天 (3月17日)'
            }
        ],
        // 疫苗记录
        vaccineRecords: [
            {
                id: 1,
                name: '禽流感疫苗 H5N1',
                location: '3号鹅舍',
                quantity: 180,
                status: '已完成',
                date: '2024-03-15',
                operator: '张三',
                batchNo: 'VN20240315',
                nextDate: '4月15日'
            },
            {
                id: 2,
                name: '新城疫疫苗',
                location: '1号鹅舍',
                quantity: 200,
                status: '计划中',
                plannedDate: '3月20日',
                operator: '李四',
                expectedAmount: '40支'
            }
        ],
        // 症状输入
        symptomInput: '',
        // 常见症状
        commonSymptoms: [
            { id: 1, name: '🔥发热', selected: false },
            { id: 2, name: '🍽️食欲不振', selected: false },
            { id: 3, name: '💧腹泻', selected: false }
        ],
        // AI建议
        aiAdvice: null,
        // 咨询历史
        consultationHistory: [
            {
                id: 1,
                symptoms: '鹅群出现精神萎靡、拉稀、食欲不振的症状，部分鹅只体温偏高...',
                diagnosis: '疑似禽流感或肠道感染',
                mainTreatment: '立即隔离患病鹅只，使用抗生素类药物治疗',
                date: '2024-03-15 10:30',
                adopted: true
            },
            {
                id: 2,
                symptoms: '部分鹅只出现呼吸困难、喘气、流鼻涕症状...',
                diagnosis: '疑似呼吸道感染或感冒',
                mainTreatment: '保持鹅舍温暖干燥，改善通风条件',
                date: '2024-03-13 15:45',
                adopted: false
            }
        ]
    },
    onLoad() {
        this.loadHealthData();
    },
    // 加载健康数据
    loadHealthData() {
        // 模拟API调用
    },
    // Tab切换
    onTabChange(e) {
        const { value } = e.detail;
        this.setData({
            activeTab: value
        });
    },
    // 新增健康记录
    addHealthRecord() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 查看健康记录
    viewHealthRecord(e) {
        const { item } = e.currentTarget.dataset || e.detail || {};
        wx.showModal({
            title: '健康记录详情',
            content: `位置：${item.location}\n症状：${item.symptoms}\n治疗：${item.treatment}`,
            showCancel: false
        });
    },
    // 查看疫苗提醒
    viewVaccineReminder(e) {
        const { item } = e.currentTarget.dataset || e.detail || {};
        wx.showModal({
            title: '疫苗接种提醒',
            content: `疫苗：${item.name}\n位置：${item.location}\n预计接种：${item.scheduledDate}`,
            showCancel: false
        });
    },
    // 查看疫苗记录
    viewVaccineRecord(e) {
        const { item } = e.currentTarget.dataset || e.detail || {};
        wx.showModal({
            title: '疫苗记录详情',
            content: `疫苗：${item.name}\n位置：${item.location}\n数量：${item.quantity}只鹅\n状态：${item.status}`,
            showCancel: false
        });
    },
    // 查看咨询记录
    viewConsultation(e) {
        const { item } = e.currentTarget.dataset || e.detail || {};
        wx.showModal({
            title: '咨询详情',
            content: `症状：${item.symptoms}\n诊断：${item.diagnosis}\n建议：${item.mainTreatment}`,
            showCancel: false
        });
    },
    // 添加疫苗计划
    addVaccinePlan() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 记录接种
    recordVaccination() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 症状输入
    onSymptomInput(e) {
        this.setData({
            symptomInput: e.detail.value
        });
    },
    // 切换症状标签
    toggleSymptom(e) {
        const { id } = e.currentTarget.dataset;
        const symptoms = this.data.commonSymptoms.map((item) => {
            if (item.id === id) {
                return { ...item, selected: !item.selected };
            }
            return item;
        });
        this.setData({
            commonSymptoms: symptoms
        });
    },
    // 获取AI建议
    getAIAdvice() {
        wx.showLoading({
            title: 'AI分析中...'
        });
        // 模拟AI分析
        setTimeout(() => {
            wx.hideLoading();
            this.setData({
                aiAdvice: {
                    diagnosis: '疑似禽流感或肠道感染',
                    treatments: [
                        '立即隔离患病鹅只',
                        '使用抗生素类药物治疗',
                        '加强环境消毒',
                        '观察其他鹅只状况'
                    ]
                }
            });
        }, 2000);
    },
    // 采纳建议
    adoptAdvice() {
        wx.showToast({
            title: '建议已采纳',
            icon: 'success'
        });
    },
    // 保存记录
    saveAdvice() {
        wx.showToast({
            title: '记录已保存',
            icon: 'success'
        });
    },
    // 选择图片
    chooseImage() {
        const that = this;
        const remainingCount = 3 - this.data.uploadedImages.length;
        wx.chooseMedia({
            count: remainingCount,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const newImages = res.tempFiles.map(file => file.tempFilePath);
                const allImages = [...that.data.uploadedImages, ...newImages];
                that.setData({
                    uploadedImages: allImages.slice(0, 3) // 最多3张图片
                });
            },
            fail: () => {
                wx.showToast({
                    title: '图片选择失败',
                    icon: 'none'
                });
            }
        });
    },
    // 删除图片
    deleteImage(e) {
        const { index } = e.currentTarget.dataset;
        const images = this.data.uploadedImages;
        images.splice(index, 1);
        this.setData({
            uploadedImages: images
        });
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
