#!/usr/bin/env node

const http = require('http')
const { App } = require('../index')

console.log('⚡ Starting Vako benchmark...')

// Minimal app to test framework overhead
const app = new App({
  port: 9999,
  isDev: false,
  showStack: false,
})

// Silence the logger during the benchmark
app.logger.log = () => {}

// Minimal route with no middleware
app.app.get('/bench', (req, res) => {
  res.json({ status: 'ok', framework: 'vako' })
})

const server = app.listen(9999, () => {
  let requests = 0
  let bytesReceived = 0
  const startTime = Date.now()
  const duration = 10000 // 10 seconds

  console.log(`Targeting http://localhost:9999/bench for 10 seconds...\n`)

  const makeRequest = () => {
    http
      .get('http://localhost:9999/bench', (res) => {
        res.on('data', (chunk) => {
          bytesReceived += chunk.length
        })
        res.on('end', () => {
          requests++
          if (Date.now() - startTime < duration) {
            makeRequest()
          }
        })
      })
      .on('error', (err) => {
        console.error('Request error:', err.message)
      })
  }

  // Start with 10 concurrent requests
  for (let i = 0; i < 10; i++) {
    makeRequest()
  }

  // Timeout to stop the benchmark
  setTimeout(() => {
    const totalSeconds = (Date.now() - startTime) / 1000
    const rps = Math.round(requests / totalSeconds)

    console.log('━'.repeat(40))
    console.log('📊 Vako Benchmark Results:')
    console.log(`   Total Requests: ${requests.toLocaleString()}`)
    console.log(`   Data Received:  ${(bytesReceived / 1024).toFixed(2)} KB`)
    console.log(`   Duration:       ${totalSeconds.toFixed(2)}s`)
    console.log(`\x1b[32m   Requests/sec:   ${rps.toLocaleString()}\x1b[0m`)
    console.log('━'.repeat(40))

    server.close()
    process.exit(0)
  }, duration)
})
