#!/usr/bin/env node

const { execSync } = require('child_process')

console.log('🔒 Running strict security audit...')

try {
  // Check for high/critical vulnerabilities in production dependencies
  // Using json output to parse results cleanly
  const auditOutput = execSync('npm audit --json --omit=dev', {
    encoding: 'utf8',
  })
  const auditData = JSON.parse(auditOutput)

  if (
    auditData.metadata.vulnerabilities.high > 0 ||
    auditData.metadata.vulnerabilities.critical > 0
  ) {
    console.error('\x1b[31m❌ SECURITY CHECK FAILED!')
    console.error(`   Critical: ${auditData.metadata.vulnerabilities.critical}`)
    console.error(`   High: ${auditData.metadata.vulnerabilities.high}`)
    console.error(
      '\x1b[33mPlease run "npm audit fix" or update the vulnerable packages.\x1b[0m'
    )
    process.exit(1)
  }

  console.log(
    '\x1b[32m✅ Security check passed! No critical or high vulnerabilities found.\x1b[0m'
  )
  process.exit(0)
} catch (error) {
  // npm audit exits with code 1 if vulnerabilities are found
  if (error.stdout) {
    try {
      const auditData = JSON.parse(error.stdout)
      if (auditData.metadata && auditData.metadata.vulnerabilities) {
        console.error('\x1b[31m❌ SECURITY CHECK FAILED!')
        console.error(
          `   Critical: ${auditData.metadata.vulnerabilities.critical || 0}`
        )
        console.error(
          `   High: ${auditData.metadata.vulnerabilities.high || 0}`
        )
        console.error(
          `   Moderate: ${auditData.metadata.vulnerabilities.moderate || 0}`
        )
        process.exit(1)
      }
    } catch (e) {
      // JSON parse failed, just print the error
    }
  }
  console.error('\x1b[31m❌ Error running npm audit:\x1b[0m', error.message)
  process.exit(1)
}
