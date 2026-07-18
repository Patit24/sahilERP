const https = require('https')
const fs = require('fs')

const config = JSON.parse(fs.readFileSync(
  process.env.HOME + '/.config/configstore/firebase-tools.json', 'utf8'
))
const token = config.tokens.access_token

const project = 'sahil-erp-40f7d'
const companyId = 'sk_traders'
const tenantKey = 'data_sk_traders_FY2026-27'

const body = JSON.stringify({
  fields: {
    payload: { mapValue: { fields: { test: { booleanValue: true } } } },
    revision: { integerValue: 1 },
    updatedAt: { stringValue: new Date().toISOString() },
    deviceId: { stringValue: 'diagnostic-rest-test' }
  }
})

const options = {
  hostname: 'firestore.googleapis.com',
  path: `/v1/projects/${project}/databases/(default)/documents/tenants/${companyId}/snapshots/${tenantKey}`,
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
      console.log('✅ REST API write to snapshot document succeeded!')
      console.log('   Path:', result.name)
    } else {
      console.error('❌ REST API write to snapshot document failed:')
      console.error(JSON.stringify(result, null, 2))
    }
  })
})

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message)
})

req.write(body)
req.end()
