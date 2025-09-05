"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// health.ts
const navigation_1 = require("../../utils/navigation");
const pageConfig = {
    data: {
        activeTab: 'record',
        // 健康统计
        healthStats: {
            survivalRate: 0,
            abnormal: 0,
            records: 0
        },
        // 上传的图片
        uploadedImages: [],
        // 健康记录
        healthRecords: [],
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
    onShow() {
        // 页面显示时刷新数据
        this.loadHealthData();
    },
    // 加载健康数据
    async loadHealthData() {
        try {
            // 获取健康统计数据
            const statsResult = await wx.cloud.callFunction({
                name: 'health-management',
                data: {
                    action: 'get_health_stats'
                }
            });
            
            if (statsResult.result && statsResult.result.success) {
                const stats = statsResult.result.data;
                this.setData({
                    healthStats: {
                        survivalRate: parseFloat(stats.survivalRate),
                        abnormal: stats.totalAffected,
                        records: stats.totalRecords
                    }
                });
            }
            
            // 获取健康记录列表
            const recordsResult = await wx.cloud.callFunction({
                name: 'health-management',
                data: {
                    action: 'list_health_records',
                    page: 1,
                    pageSize: 10
                }
            });
            
            if (recordsResult.result && recordsResult.result.success) {
                const records = recordsResult.result.data.records || [];
                const formattedRecords = records.map((record) => ({
                    id: record._id,
                    location: record.batchNumber || '未知批次',
                    symptoms: record.symptoms,
                    treatment: record.treatment,
                    severity: this.getSeverityTheme(record.severity),
                    statusIcon: this.getStatusIcon(record.result, record.recordType),
                    priorityText: this.getPriorityText(record.severity, record.recordType),
                    date: record.displayDate || record.recordDate,
                    time: record.createTime ? new Date(record.createTime).toLocaleTimeString() : '',
                    operator: '系统用户',
                    status: this.getResultText(record.result, record.recordType),
                    result: record.result,
                    recordType: record.recordType, // 记录类型
                    affectedCount: record.affectedCount || record.cureCount || record.deathCount,
                    deathCount: record.deathCount || 0,
                    rawRecord: record  // 保存原始记录用于跟进
                }));
                
                this.setData({
                    healthRecords: formattedRecords
                });
            }
        } catch (error) {
            console.error('加载健康数据失败:', error);
            wx.showToast({
                title: '数据加载失败',
                icon: 'none'
            });
        }
    },
    // 获取严重程度主题
    getSeverityTheme(severity) {
        const themes = {
            'mild': 'success',
            'moderate': 'warning',
            'severe': 'danger',
            'success': 'success',  // 治愈记录 -> 绿色
            'danger': 'danger'     // 死亡记录 -> 红色
        };
        return themes[severity] || 'primary';
    },
    // 获取状态图标
    getStatusIcon(result, recordType) {
        // 根据记录类型显示特定图标
        if (recordType === 'cure') {
            return '🎉';  // 治愈记录
        }
        if (recordType === 'death') {
            return '⚰️';   // 死亡记录
        }
        
        // 原始健康记录图标
        const icons = {
            'ongoing': '⏳',
            'cured': '✅',
            'death': '💀'
        };
        return icons[result] || '📝';
    },
    // 获取严重程度文本
    getSeverityText(severity) {
        const texts = {
            'mild': '轻微',
            'moderate': '中等',
            'severe': '严重',
            'success': '正常',  // 治愈记录
            'danger': '危险'    // 死亡记录
        };
        return texts[severity] || '未知';
    },
    // 获取优先级文本（区分记录类型）
    getPriorityText(severity, recordType) {
        // 根据记录类型显示特定标签
        if (recordType === 'cure') {
            return '治愈';
        }
        if (recordType === 'death') {
            return '死亡';
        }
        
        // 原始健康记录的严重程度
        return this.getSeverityText(severity);
    },
    // 获取结果文本
    getResultText(result, recordType) {
        // 根据记录类型显示特定状态
        if (recordType === 'cure') {
            return '治愈记录';
        }
        if (recordType === 'death') {
            return '死亡记录';
        }
        
        // 原始健康记录状态
        const texts = {
            'ongoing': '治疗中',
            'cured': '已治愈',
            'death': '死亡'
        };
        return texts[result] || '未知';
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
        wx.navigateTo({
            url: '/pages/health-record-form/health-record-form'
        });
    },
    // 查看健康记录
    viewHealthRecord(e) {
        const { item } = e.currentTarget.dataset || e.detail || {};
        
        // 治愈记录和死亡记录直接显示详情，不支持跟进
        if (item.recordType === 'cure' || item.recordType === 'death') {
            this.showDetailedRecord(item);
            return;
        }
        
        // 计算剩余需要治疗的数量（仅对原始健康记录）
        const remainingCount = (item.rawRecord?.currentAffectedCount !== undefined) 
            ? item.rawRecord.currentAffectedCount 
            : (item.affectedCount - (item.rawRecord?.curedCount || 0) - (item.rawRecord?.deathCount || 0));
        
        // 如果是治疗中状态或者还有剩余需要治疗的数量，显示跟进选项
        if (item.result === 'ongoing' || remainingCount > 0) {
            const statusInfo = remainingCount > 0 
                ? `\n剩余治疗：${remainingCount}只\n已治愈：${item.rawRecord?.curedCount || 0}只\n已死亡：${item.rawRecord?.deathCount || 0}只`
                : `\n状态：${item.status}`;
                
            wx.showModal({
                title: '健康记录详情',
                content: `批次：${item.location}\n症状：${item.symptoms}\n治疗：${item.treatment}${statusInfo}\n\n是否需要跟进治疗？`,
                confirmText: '跟进治疗',
                cancelText: '查看详情',
                success: (res) => {
                    if (res.confirm) {
                        // 跳转到治疗跟进页面
                        this.followUpTreatment(item);
                    } else {
                        // 显示详细信息
                        this.showDetailedRecord(item);
                    }
                }
            });
        } else {
            // 已完成的记录直接显示详情
            this.showDetailedRecord(item);
        }
    },
    // 显示详细记录信息
    showDetailedRecord(item) {
        const curedCount = item.rawRecord?.curedCount || 0;
        const deathCount = item.rawRecord?.deathCount || 0;
        const remainingCount = (item.rawRecord?.currentAffectedCount !== undefined) 
            ? item.rawRecord.currentAffectedCount 
            : Math.max(0, item.affectedCount - curedCount - deathCount);
        
        let statusInfo = `治疗状态：${item.status}`;
        
        // 如果有跟进记录，显示详细处理情况
        if (curedCount > 0 || deathCount > 0) {
            const processDetails = [];
            if (curedCount > 0) processDetails.push(`已治愈 ${curedCount}只`);
            if (deathCount > 0) processDetails.push(`已死亡 ${deathCount}只`);
            if (remainingCount > 0) processDetails.push(`治疗中 ${remainingCount}只`);
            
            statusInfo = `处理情况：${processDetails.join('，')}`;
        }
            
        wx.showModal({
            title: '健康记录详情',
            content: `批次：${item.location}\n症状：${item.symptoms}\n治疗方案：${item.treatment}\n严重程度：${item.priorityText}\n原始受影响：${item.affectedCount}只\n${statusInfo}\n记录日期：${item.date}`,
            showCancel: false
        });
    },
    // 跟进治疗
    followUpTreatment(item) {
        const recordId = item.id;
        const batchNumber = item.rawRecord?.batchNumber;
        
        wx.navigateTo({
            url: `/pages/treatment-followup/treatment-followup?recordId=${recordId}&batchNumber=${encodeURIComponent(batchNumber || '')}`
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
