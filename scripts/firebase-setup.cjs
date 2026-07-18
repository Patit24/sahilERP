const https = require('https')
const fs = require('fs')

const config = JSON.parse(fs.readFileSync(
  process.env.HOME + '/.config/configstore/firebase-tools.json', 'utf8'
))
const token = config.tokens.access_token

const uid = 'qObDRlXufkUQOVt8fyfBOSM3djJ3'
const project = 'sahil-erp-40f7d'
const now = new Date().toISOString()

const body = JSON.stringify({
  fields: {
    email: { stringValue: 'admin@sktraders.com' },
    displayName: { stringValue: 'Master Admin' },
    role: { stringValue: 'master_admin' },
    isActive: { booleanValue: true },
    companyId: { stringValue: 'sk_traders' },
    permissions: { mapValue: { fields: {} } },
    createdAt: { stringValue: now },
    updatedAt: { stringValue: now }
  }
})

const options = {
  hostname: 'firestore.googleapis.com',
  path: `/v1/projects/${project}/databases/(default)/documents/users/${uid}`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    const result = JSON.parse(data)
    if (result.name) {
      console.log('✅ Firestore document created successfully!')
      console.log('   Path:', result.name)
    } else {
      console.error('❌ Error:', JSON.stringify(result, null, 2))
      process.exit(1)
    }
  })
})

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message)
  process.exit(1)
})

req.write(body)
req.end()
