/**
 * Definitions of DOGE transaction and unit types used by the Dogecoin module.
 */

/**
 * The symbol for whole Dogecoin units. Each Dogecoin is equal to 100 000 000
 * koinu (the smallest unit), similar to how 1 Bitcoin is 100 000 000 satoshi.
 */
export type DogecoinUnits = 'DOGE' | 'koinu'

/**
 * A UTXO input used when assembling an unsigned transaction. It references a
 * previous transaction output and includes the value and script of that
 * output so that the signer can produce a valid signature script. The
 * derivationPath indicates which HD derivation path should be used to sign
 * this input.
 */
export interface DogecoinTxInput {
  txid: string
  vout: number
  value: string // koinu
  scriptPubKey: string
  address: string
  derivationPath: string
}

/**
 * A transaction output specifying a destination address and the amount of
 * Dogecoin (in koinu) to send. For change outputs the address will be the
 * sender’s own address.
 */
export interface DogecoinTxOutput {
  address: string
  value: string // koinu
  isChange?: boolean
}

/**
 * Unsigned transaction passed from the wallet to the vault for signing. The
 * vault will read the inputs, produce signatures and assemble a signed
 * transaction. Fee is represented in koinu.
 */
export interface DogecoinUnsignedTransaction {
  type: 'unsigned'
  inputs: DogecoinTxInput[]
  outputs: DogecoinTxOutput[]
  fee: string // koinu
  changeAddress?: string
}

/**
 * Signed transaction returned by the vault. Contains the fully assembled raw
 * transaction hex ready to be broadcast to the network.
 */
export interface DogecoinSignedTransaction {
  type: 'signed'
  transaction: string // raw transaction hex
}
