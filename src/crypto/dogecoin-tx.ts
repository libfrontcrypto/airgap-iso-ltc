import {
  DogecoinSignedTransaction,
  DogecoinUnsignedTransaction
} from '../protocol/DogecoinTypes'
import { DOGECOIN_NETWORK } from './dogecoin-address'

const BitGo = require('@airgap/coinlib-core/dependencies/src/bitgo-utxo-lib-5d91049fd7a988382df81c8260e244ee56d57aac/src')
const BigInteger = require('@airgap/coinlib-core/dependencies/src/bigi-1.4.2/lib/index')
const Buffer = require('@airgap/coinlib-core/dependencies/src/safe-buffer-5.2.0/index').Buffer

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

export async function signDogecoinP2PKHTransaction(
  tx: DogecoinUnsignedTransaction,
  privKeyHex: string
): Promise<string> {
  const privateKey = BigInteger.fromBuffer(Buffer.from(hexToBytes(privKeyHex)))
  const keyPair = new BitGo.ECPair(privateKey, undefined, { compressed: true, network: DOGECOIN_NETWORK })
  const builder = new BitGo.TransactionBuilder(DOGECOIN_NETWORK)
  const signingAddress = BitGo.address.toBase58Check(
    BitGo.crypto.hash160(keyPair.getPublicKeyBuffer()),
    DOGECOIN_NETWORK.pubKeyHash,
    DOGECOIN_NETWORK
  )

  tx.inputs.forEach((input) => {
    if (input.address !== signingAddress) {
      throw new Error(`Secret key cannot sign input for address ${input.address}`)
    }

    if (input.scriptPubKey) {
      const expectedScript = BitGo.address.toOutputScript(input.address, DOGECOIN_NETWORK).toString('hex')
      if (input.scriptPubKey !== expectedScript) {
        throw new Error(`Input script does not match address ${input.address}`)
      }
    }

    builder.addInput(input.txid, input.vout)
  })

  tx.outputs.forEach((output) => {
    builder.addOutput(output.address, Number(output.value))
  })

  tx.inputs.forEach((_input, index) => {
    builder.sign(index, keyPair)
  })

  return builder.build().toHex()
}

export function decodeDogecoinP2PKHOutputs(rawTxHex: string): Array<{ address: string; value: string }> {
  const transaction = BitGo.Transaction.fromHex(rawTxHex)

  return transaction.outs.map((output: any) => ({
    address: BitGo.address.fromOutputScript(output.script, DOGECOIN_NETWORK),
    value: String(output.value)
  }))
}
