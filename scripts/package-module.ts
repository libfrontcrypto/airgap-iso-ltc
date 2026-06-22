import { deflateRawSync } from 'zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const files = ['dogecoin.svg', 'index.js', 'manifest.json', 'module.sig']

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff

  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(date.getFullYear(), 1980)

  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  }
}

function writeUInt16(value: number): Buffer {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function writeUInt32(value: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

function createEntry(name: string, data: Buffer, offset: number, timestamp: Date, method: 0 | 8 = 8) {
  const compressed = method === 8 ? deflateRawSync(data) : data
  const checksum = crc32(data)
  const encodedName = Buffer.from(name, 'utf8')
  const { date, time } = dosDateTime(timestamp)

  const localHeader = Buffer.concat([
    writeUInt32(0x04034b50),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(method),
    writeUInt16(time),
    writeUInt16(date),
    writeUInt32(checksum),
    writeUInt32(compressed.length),
    writeUInt32(data.length),
    writeUInt16(encodedName.length),
    writeUInt16(0),
    encodedName
  ])

  const centralHeader = Buffer.concat([
    writeUInt32(0x02014b50),
    writeUInt16(20),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(method),
    writeUInt16(time),
    writeUInt16(date),
    writeUInt32(checksum),
    writeUInt32(compressed.length),
    writeUInt32(data.length),
    writeUInt16(encodedName.length),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(0),
    writeUInt32(offset),
    encodedName
  ])

  return {
    local: Buffer.concat([localHeader, compressed]),
    central: centralHeader
  }
}

function main(): void {
  const root = process.cwd()
  const moduleDir = join(root, 'module')
  const manifest = JSON.parse(readFileSync(join(moduleDir, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''))
  const version = manifest.version ?? 'dev'
  const outputPath = join(moduleDir, `airgap-iso-doge-${version}-dev.zip`)
  const timestamp = new Date(1980, 0, 1, 0, 0, 0)
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  mkdirSync(moduleDir, { recursive: true })

  const directoryEntry = createEntry('module/', Buffer.alloc(0), offset, timestamp, 8)
  locals.push(directoryEntry.local)
  centrals.push(directoryEntry.central)
  offset += directoryEntry.local.length

  for (const file of files) {
    const entryName = `module/${file}`
    const entry = createEntry(entryName, readFileSync(join(moduleDir, file)), offset, timestamp)
    locals.push(entry.local)
    centrals.push(entry.central)
    offset += entry.local.length
  }

  const centralDirectory = Buffer.concat(centrals)
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(files.length + 1),
    writeUInt16(files.length + 1),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0)
  ])

  writeFileSync(outputPath, Buffer.concat([...locals, centralDirectory, end]))
  console.log(`Created ${outputPath}`)
}

main()
