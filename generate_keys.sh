
# 为您创建密钥生成脚本
echo '正在生成Ed25519密钥对...'

# 生成Ed25519私钥
openssl genpkey -algorithm ED25519 -out ed25519-private.pem

# 生成对应的公钥  
openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem

echo '✅ 密钥对生成完成!'
echo '📁 文件位置：'
echo '   私钥: /Users/kakawah/Documents/Wechat/ed25519-private.pem'
echo '   公钥: /Users/kakawah/Documents/Wechat/ed25519-public.pem'
echo ''
echo '📋 公钥内容（需要上传到和风天气控制台）：'
echo '============================================'
cat ed25519-public.pem
echo '============================================'

