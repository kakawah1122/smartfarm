// privacy-settings.ts - 隐私设置页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    loading: true,
    needAuthorization: false,
    privacyContractName: '',
    authorized: false
  },

  onLoad() {
    this.loadPrivacySetting()
  },

  /**
   * 加载隐私设置状态
   */
  loadPrivacySetting() {
    wx.getPrivacySetting({
      success: (res) => {
        const needAuthorization = res.needAuthorization || false
        const privacyContractName = res.privacyContractName || '《隐私保护指引》'
        
        this.setData({
          loading: false,
          needAuthorization: needAuthorization,
          privacyContractName: privacyContractName,
          authorized: !needAuthorization
        })
      },
      fail: () => {
        this.setData({
          loading: false
        })
        wx.showToast({
          title: '获取隐私设置失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 打开隐私协议
   */
  openPrivacyContract() {
    wx.openPrivacyContract({
      fail: () => {
        wx.showToast({
          title: '打开隐私协议失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/profile/profile'
        })
      }
    })
  }
}

Page(createPageWithNavbar(pageConfig))

