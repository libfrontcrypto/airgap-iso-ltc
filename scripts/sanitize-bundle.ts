import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const bundlePath = join(process.cwd(), 'module', 'index.js')
const bundle = readFileSync(bundlePath, 'utf8')
const sanitized = bundle.replace(
  /\/\/ D[a-z]+ BIP32 is a proposed standard: https:\/\/bitcointalk\.org\/index\.php\?topic=409731\r?\n/g,
  ''
)

if (sanitized !== bundle) {
  writeFileSync(bundlePath, sanitized)
}
