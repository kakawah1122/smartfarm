// image-upload.ts - 图片上传组件
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 已上传的图片列表
    value: {
      type: Array,
      value: []
    },
    // 最大上传数量
    max: {
      type: Number,
      value: 9
    },
    // 是否支持多选
    multiple: {
      type: Boolean,
      value: true
    },
    // 图片质量
    quality: {
      type: Number,
      value: 80
    },
    // 是否压缩
    compressed: {
      type: Boolean,
      value: true
    },
    // 最大文件大小(MB)
    maxSize: {
      type: Number,
      value: 5
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    },
    // 是否只读
    readonly: {
      type: Boolean,
      value: false
    },
    // 上传按钮文字
    uploadText: {
      type: String,
      value: '添加图片'
    }
  },

  data: {
    uploadingCount: 0
  },

  methods: {
    // 选择图片
    async chooseImage() {
      if (this.data.disabled || this.data.readonly) return

      const { value, max, multiple } = this.data
      const remainingCount = max - value.length

      if (remainingCount <= 0) {
        wx.showToast({
          title: `最多上传${max}张图片`,
          icon: 'none'
        })
        return
      }

      try {
        const res = await wx.chooseMedia({
          count: multiple ? Math.min(remainingCount, 9) : 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          maxDuration: 30,
          camera: 'back'
        })

        if (res.tempFiles && res.tempFiles.length > 0) {
          this.uploadImages(res.tempFiles)
        }
      } catch (error) {
        if (error.errMsg && !error.errMsg.includes('cancel')) {
          wx.showToast({
            title: '选择图片失败',
            icon: 'none'
          })
        }
      }
    },

    // 上传图片
    async uploadImages(tempFiles) {
      const { maxSize } = this.data
      const validFiles = []

      // 检查文件大小
      for (const file of tempFiles) {
        const fileSizeMB = file.size / (1024 * 1024)
        if (fileSizeMB > maxSize) {
          wx.showToast({
            title: `图片大小不能超过${maxSize}MB`,
            icon: 'none'
          })
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length === 0) return

      this.setData({ uploadingCount: validFiles.length })

      const uploadPromises = validFiles.map(file => this.uploadSingleImage(file))

      try {
        const results = await Promise.all(uploadPromises)
        const successResults = results.filter(result => result.success)
        
        if (successResults.length > 0) {
          const newValue = [...this.data.value, ...successResults]
          this.triggerEvent('change', {
            value: newValue
          })
        }

        if (successResults.length < results.length) {
          wx.showToast({
            title: `${successResults.length}张上传成功，${results.length - successResults.length}张上传失败`,
            icon: 'none'
          })
        } else {
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          })
        }
      } catch (error) {
        // 已移除调试日志
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      } finally {
        this.setData({ uploadingCount: 0 })
      }
    },

    // 上传单个图片
    async uploadSingleImage(file) {
      try {
        const result = await wx.cloud.uploadFile({
          cloudPath: `health-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
          filePath: file.tempFilePath
        })

        return {
          success: true,
          fileID: result.fileID,
          tempFilePath: file.tempFilePath,
          size: file.size,
          uploadTime: new Date().toISOString()
        }
      } catch (error) {
        // 已移除调试日志
        return {
          success: false,
          error: error
        }
      }
    },

    // 预览图片
    previewImage(e) {
      const { index } = e.currentTarget.dataset
      const { value } = this.data
      
      const urls = value.map(item => item.fileID || item.tempFilePath || item)
      
      wx.previewImage({
        current: urls[index],
        urls: urls
      })
    },

    // 删除图片
    removeImage(e) {
      if (this.data.disabled || this.data.readonly) return

      const { index } = e.currentTarget.dataset
      
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这张图片吗？',
        success: (res) => {
          if (res.confirm) {
            const newValue = [...this.data.value]
            newValue.splice(index, 1)
            
            this.triggerEvent('change', {
              value: newValue
            })
          }
        }
      })
    },

    // 获取图片URL
    getImageUrl(item) {
      if (typeof item === 'string') {
        return item
      }
      return item.fileID || item.tempFilePath || item.url || ''
    },

    // 检查是否可以添加更多图片
    canAddMore() {
      const { value, max, disabled, readonly, uploadingCount } = this.data
      return !disabled && !readonly && (value.length + uploadingCount) < max
    }
  }
})
