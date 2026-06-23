import {
  LitecoinSignedTransaction,
  LitecoinUnsignedTransaction
} from '../protocol/LitecoinTypes'
import { LITECOIN_NETWORK } from './litecoin-address'

const BitGo = require('@airgap/coinlib-core/dependencies/src/bitgo-utxo-lib-5d91049fd7a988382df81c8260e244ee56d57aac/src')
const BigInteger = require('@airgap/coinlib-core/dependencies/src/bigi-1.4.2/lib/index')
const Buffer = require('@airgap/coinlib-core/dependencies/src/safe-buffer-5.2.0/index').Buffer

const LITECOIN_LEGACY_P2SH_NETWORK = {
  ...LITECOIN_NETWORK,
  scriptHash: 0x05
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  if (normalized.length % 2 !== 0) {
    throw new Error('Invalid hex string length')
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }

  return bytes
}

function outputScriptFromAddress(address: string): Buffer {
  try {
    return BitGo.address.toOutputScript(address, LITECOIN_NETWORK)
  } catch (error) {
    return BitGo.address.toOutputScript(address, LITECOIN_LEGACY_P2SH_NETWORK)
  }
}

export async function signLitecoinP2PKHTransaction(
  tx: LitecoinUnsignedTransaction,
  privKeyHex: string
): Promise<string> {
  const privateKey = BigInteger.fromBuffer(Buffer.from(hexToBytes(privKeyHex)))
  const keyPair = new BitGo.ECPair(privateKey, undefined, { compressed: true, network: LITECOIN_NETWORK })
  const builder = new BitGo.TransactionBuilder(LITECOIN_NETWORK)
  const signingAddress = BitGo.address.toBase58Check(
    BitGo.crypto.hash160(keyPair.getPublicKeyBuffer()),
    LITECOIN_NETWORK.pubKeyHash,
    LITECOIN_NETWORK
  )

  tx.inputs.forEach((input) => {
    if (input.address !== signingAddress) {
      throw new Error(`Secret key cannot sign input for address ${input.address}`)
    }

    if (input.scriptPubKey) {
      const expectedScript = outputScriptFromAddress(input.address).toString('hex')
      if (input.scriptPubKey !== expectedScript) {
        throw new Error(`Input script does not match address ${input.address}`)
      }
    }

    builder.addInput(input.txid, input.vout)
  })

  tx.outputs.forEach((output) => {
    builder.addOutput(outputScriptFromAddress(output.address), Number(output.value))
  })

  tx.inputs.forEach((_input, index) => {
    builder.sign(index, keyPair)
  })

  return builder.build().toHex()
}

export function decodeLitecoinP2PKHOutputs(rawTxHex: string): Array<{ address: string; value: string }> {
  const transaction = BitGo.Transaction.fromHex(rawTxHex)

  return transaction.outs.map((output: any) => ({
    address: BitGo.address.fromOutputScript(output.script, LITECOIN_NETWORK),
    value: String(output.value)
  }))
}
