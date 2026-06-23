/**
 * Definitions of LTC transaction and unit types used by the Litecoin module.
 */

/**
 * The symbol for whole Litecoin units. Each Litecoin is equal to 100 000 000
 * litoshi (the smallest unit), similar to how 1 Bitcoin is 100 000 000 satoshi.
 */
export type LitecoinUnits = 'LTC' | 'litoshi'

/**
 * A UTXO input used when assembling an unsigned transaction. It references a
 * previous transaction output and includes the value and script of that
 * output so that the signer can produce a valid signature script. The
 * derivationPath indicates which HD derivation path should be used to sign
 * this input.
 */
export interface LitecoinTxInput {
  txid: string
  vout: number
  value: string // litoshi
  scriptPubKey: string
  address: string
  derivationPath: string
}

/**
 * A transaction output specifying a destination address and the amount of
 * Litecoin (in litoshi) to send. For change outputs the address will be the
 * sender’s own address.
 */
export interface LitecoinTxOutput {
  address: string
  value: string // litoshi
  isChange?: boolean
}

/**
 * Unsigned transaction passed from the wallet to the vault for signing. The
 * vault will read the inputs, produce signatures and assemble a signed
 * transaction. Fee is represented in litoshi.
 */
export interface LitecoinUnsignedTransaction {
  type: 'unsigned'
  inputs: LitecoinTxInput[]
  outputs: LitecoinTxOutput[]
  fee: string // litoshi
  changeAddress?: string
}

/**
 * Signed transaction returned by the vault. Contains the fully assembled raw
 * transaction hex ready to be broadcast to the network.
 */
export interface LitecoinSignedTransaction {
  type: 'signed'
  transaction: string // raw transaction hex
}
