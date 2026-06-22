import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { signAsync } from '@noble/ed25519'

/*
 * sign-module.ts
 *
 * This script creates a signature for an AirGap isolated module bundle.
 * AirGap requires that the files listed in the module manifest are concatenated,
 * followed by the manifest file itself, and then signed with an Ed25519 key.
 * The resulting signature is written to `module.sig` in the module folder.
 *
 * Usage:
 *   Set the environment variable MODULE_ED25519_PRIVATE_KEY to your private key
 *   (as a hex string without the leading 0x). Then run:
 *     ts-node scripts/sign-module.ts
 *
 * The manifest's `publicKey` field must be set to the corresponding public key
 * (prefixed with 0x) before publishing your module.
 */

async function main(): Promise<void> {
  const moduleDir = join(process.cwd(), 'module')
  const manifestPath = join(moduleDir, 'manifest.json')
  const manifestContent = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')
  const manifest = JSON.parse(manifestContent)

  const privateKeyHex = process.env.MODULE_ED25519_PRIVATE_KEY
  if (!privateKeyHex) {
    throw new Error('Set MODULE_ED25519_PRIVATE_KEY in your environment to sign the module')
  }

  const chunks: Buffer[] = []
  // Concatenate each file listed in manifest.include
  for (const file of manifest.include as string[]) {
    chunks.push(readFileSync(join(moduleDir, file)))
  }
  // Finally append the manifest itself
  chunks.push(readFileSync(manifestPath))
  const payload = Buffer.concat(chunks)

  // Convert the private key to bytes
  const privateKey = Buffer.from(privateKeyHex.replace(/^0x/, ''), 'hex')
  const signature = await signAsync(payload, privateKey)

  writeFileSync(join(moduleDir, 'module.sig'), Buffer.from(signature))
  console.log('Module signed successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
