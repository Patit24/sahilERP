const https = require('https')
const fs = require('fs')
const path = require('path')

// RFC 4180 compliant CSV parser to handle embedded commas, newlines, and escaped quotes in JSON
function parseCSV(content) {
  const rows = []
  let row = []
  let col = ''
  let inQuotes = false
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i+1]
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          col += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        col += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(col)
        col = ''
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') {
          i++
        }
        row.push(col)
        rows.push(row)
        row = []
        col = ''
      } else {
        col += char
      }
    }
  }
  if (col || row.length > 0) {
    row.push(col)
    rows.push(row)
  }
  return rows
}

// Convert JS objects/arrays to Firestore REST format
function jsToFirestore(val) {
  if (val === null || val === undefined) {
    return { nullValue: "NULL_VALUE" }
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val }
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) }
    }
    return { doubleValue: val }
  }
  if (typeof val === 'string') {
    return { stringValue: val }
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return { arrayValue: {} }
    }
    return { arrayValue: { values: val.map(jsToFirestore) } }
  }
  if (typeof val === 'object') {
    const fields = {}
    for (const k of Object.keys(val)) {
      fields[k] = jsToFirestore(val[k])
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(val) }
}

function uploadSnapshotToFirestore(token, project, companyId, tenantKey, payload) {
  return new Promise((resolve) => {
    // Clean up empty collections and add required fields for runtime safety
    const cleanPayload = {
      ...payload,
      suppliers: payload.suppliers || [],
      customers: payload.customers || [],
      items: payload.items || [],
      invoices: payload.invoices || [],
      payments: payload.payments || [],
      receivedDiscounts: payload.receivedDiscounts || [],
      salesInvoices: payload.salesInvoices || [],
      customerPayments: payload.customerPayments || [],
      expenseTypes: payload.expenseTypes || [],
      expenseEntries: payload.expenseEntries || [],
      fixedSchemes: payload.fixedSchemes || [],
      mtBookings: payload.mtBookings || [],
      advanceBookingPickups: payload.advanceBookingPickups || [],
      discountLedgerEntries: payload.discountLedgerEntries || []
    }

    const body = JSON.stringify({
      fields: {
        payload: jsToFirestore(cleanPayload),
        revision: { integerValue: "1000" }, // High revision to clear out any cache states
        updatedAt: { stringValue: new Date().toISOString() },
        deviceId: { stringValue: 'supabase-csv-migration-script' }
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Successfully uploaded snapshot: ${tenantKey}`)
          resolve(true)
        } else {
          console.error(`❌ Failed to upload snapshot ${tenantKey}:`, res.statusCode, data)
          resolve(false)
        }
      })
    })

    req.on('error', (err) => {
      console.error(`❌ Request error for ${tenantKey}:`, err.message)
      resolve(false)
    })

    req.write(body)
    req.end()
  })
}

async function run() {
  console.log('🔄 Starting Supabase CSV restore to Firestore...')
  
  // 1. Get Firebase CLI token
  const home = process.env.HOME
  const configPath = path.join(home, '.config/configstore/firebase-tools.json')
  let token
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    token = config.tokens.access_token
  } catch (e) {
    console.error('❌ Could not load Firebase CLI token. Please run "firebase login" in your terminal first.')
    process.exit(1)
  }

  // 2. Scan Downloads directory for latest CSV files
  const downloadsDir = '/Users/patitpabanroy/Downloads'
  const files = fs.readdirSync(downloadsDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => {
      const fullPath = path.join(downloadsDir, f)
      return { path: fullPath, mtime: fs.statSync(fullPath).mtime }
    })
    .sort((a, b) => b.mtime - a.mtime)

  if (files.length === 0) {
    console.error('❌ No CSV files found in your Downloads folder. Please export the query result to CSV first.')
    process.exit(1)
  }

  const targetCsv = files[0].path
  console.log(`📂 Found latest CSV file: ${path.basename(targetCsv)}`)

  // 3. Parse CSV
  let rows
  try {
    const content = fs.readFileSync(targetCsv, 'utf8')
    rows = parseCSV(content)
  } catch (e) {
    console.error('❌ Failed to parse CSV:', e.message)
    process.exit(1)
  }

  if (rows.length < 2) {
    console.error('❌ CSV file has no records.')
    process.exit(1)
  }

  // Find column indices from headers
  const headers = rows[0].map(h => h.trim().toLowerCase())
  const keyIdx = headers.indexOf('tenant_key')
  const payloadIdx = headers.indexOf('payload')

  if (keyIdx === -1 || payloadIdx === -1) {
    console.error('❌ CSV file must have "tenant_key" and "payload" columns as headers.')
    console.error('   Found headers:', rows[0])
    process.exit(1)
  }

  console.log(`📊 Processing ${rows.length - 1} database snapshot records...`)

  let successCount = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length <= Math.max(keyIdx, payloadIdx)) continue
    
    const tenantKey = row[keyIdx].trim()
    const payloadStr = row[payloadIdx].trim()
    
    if (!tenantKey || !payloadStr) continue

    // Filter out smoke test payloads or invalid entries
    if (tenantKey.includes('smoke') || payloadStr.includes('"smoke":')) {
      console.log(`- Skipping smoke test snapshot: ${tenantKey}`)
      continue
    }

    try {
      const payload = JSON.parse(payloadStr)
      // Check if this payload has actual lists
      const recordsCount = Object.keys(payload).reduce((sum, k) => {
        return sum + (Array.isArray(payload[k]) ? payload[k].length : 0)
      }, 0)

      if (recordsCount === 0) {
        console.log(`- Skipping empty snapshot: ${tenantKey}`)
        continue
      }

      console.log(`📤 Uploading snapshot ${tenantKey} with ${recordsCount} records...`)
      const success = await uploadSnapshotToFirestore(token, 'sahil-erp-40f7d', 'sk_traders', tenantKey, payload)
      if (success) {
        successCount++
      }
    } catch (err) {
      console.error(`- Skipping row ${i} due to JSON parse error on payload:`, err.message)
    }
  }

  console.log(`\n🎉 Restore complete! Successfully migrated ${successCount} snapshots to Firestore.`)
}

run()
