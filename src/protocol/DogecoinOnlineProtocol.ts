import {
  Address,
  AirGapTransactionsWithCursor,
  AirGapTransaction,
  Amount,
  Balance,
  ExtendedPublicKey,
  FeeEstimation,
  ProtocolMetadata,
  ProtocolNetwork,
  PublicKey
} from '@airgap/module-kit'

import {
  DogecoinUnits,
  DogecoinUnsignedTransaction,
  DogecoinSignedTransaction,
  DogecoinTxOutput
} from './DogecoinTypes'
import {
  deriveDogecoinPublicKeyFromExtendedPublicKey,
  dogecoinAddressFromExtendedPublicKey,
  dogecoinAddressFromPublicKey
} from '../crypto/dogecoin-address'
import { DogecoinApi } from '../api/DogecoinApi'
import { DOGECOIN_FEE_DEFAULTS, DOGECOIN_MAINNET } from './DogecoinProtocolNetwork'
import { decodeDogecoinP2PKHOutputs } from '../crypto/dogecoin-tx'

type DogecoinTransactionCursor = { hasNext: boolean }

function normalizeDecimal(value: string): string {
  return value.replace(/^0+(?=\d)/, '')
}

function compareDecimalStrings(left: string, right: string): number {
  const normalizedLeft = normalizeDecimal(left)
  const normalizedRight = normalizeDecimal(right)

  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length > normalizedRight.length ? 1 : -1
  }

  if (normalizedLeft === normalizedRight) {
    return 0
  }

  return normalizedLeft > normalizedRight ? 1 : -1
}

function addDecimalStrings(left: string, right: string): string {
  let carry = 0
  let result = ''
  let i = left.length - 1
  let j = right.length - 1

  while (i >= 0 || j >= 0 || carry > 0) {
    const sum = (i >= 0 ? left.charCodeAt(i--) - 48 : 0) + (j >= 0 ? right.charCodeAt(j--) - 48 : 0) + carry
    result = String(sum % 10) + result
    carry = Math.floor(sum / 10)
  }

  return normalizeDecimal(result)
}

function subtractDecimalStrings(left: string, right: string): string {
  if (compareDecimalStrings(left, right) < 0) {
    throw new Error('Cannot subtract a larger decimal string')
  }

  let borrow = 0
  let result = ''
  let i = left.length - 1
  let j = right.length - 1

  while (i >= 0) {
    let digit = left.charCodeAt(i--) - 48 - borrow
    const subtrahend = j >= 0 ? right.charCodeAt(j--) - 48 : 0
    if (digit < subtrahend) {
      digit += 10
      borrow = 1
    } else {
      borrow = 0
    }
    result = String(digit - subtrahend) + result
  }

  return normalizeDecimal(result)
}

function amountToKoinu(amount: Amount<DogecoinUnits> | { value: string; unit?: string }): string {
  if (amount.unit === 'DOGE') {
    return String(Math.round(Number(amount.value) * 1e8))
  }

  return amount.value
}

/**
 * Online protocol implementation for Dogecoin. Runs on the AirGap Wallet
 * application with network access. Fetches balances and UTXOs, builds
 * unsigned transactions and broadcasts signed transactions using an API
 * backend.
 */
export class DogecoinOnlineProtocol {
  constructor(
    private readonly api: DogecoinApi,
    private readonly network: ProtocolNetwork = DOGECOIN_MAINNET
  ) {}

  /**
   * Provide the same metadata as the offline protocol. Some wallets may call
   * this to display network information without requiring the vault.
   */
  public async getMetadata(): Promise<ProtocolMetadata<DogecoinUnits, DogecoinUnits>> {
    return {
      identifier: 'dogecoin',
      name: 'Dogecoin',
      units: {
        DOGE: { symbol: { value: 'DOGE' }, decimals: 8 },
        koinu: { symbol: { value: 'koinu' }, decimals: 0 }
      },
      mainUnit: 'DOGE',
      fee: {
        defaults: DOGECOIN_FEE_DEFAULTS
      },
      account: {
        standardDerivationPath: "m/44'/3'/0'",
        address: {
          isCaseSensitive: true,
          placeholder: 'D...',
          regex: '^D[1-9A-HJ-NP-Za-km-z]{25,34}$'
        }
      }
    }
  }

  /**
   * Convert a public key into a Dogecoin address using the helper.
   */
  public async getAddressFromPublicKey(publicKey: PublicKey | ExtendedPublicKey): Promise<string> {
    switch (publicKey.type) {
      case 'pub':
        return dogecoinAddressFromPublicKey(publicKey.value)
      case 'xpub':
        return dogecoinAddressFromExtendedPublicKey(publicKey)
      default:
        throw new Error('Public key type is not supported.')
    }
  }

  public async getAddressesFromPublicKey(publicKey: PublicKey): Promise<Array<{ address: string; cursor: { hasNext: boolean } }>> {
    return [
      {
        address: await this.getAddressFromPublicKey(publicKey),
        cursor: { hasNext: false }
      }
    ]
  }

  public async getAddressFromExtendedPublicKey(
    extendedPublicKey: ExtendedPublicKey,
    visibilityIndex: number,
    addressIndex: number
  ): Promise<{ address: string; cursor: { hasNext: boolean } }> {
    const publicKey = await this.deriveFromExtendedPublicKey(extendedPublicKey, visibilityIndex, addressIndex)

    return {
      address: await this.getAddressFromPublicKey(publicKey),
      cursor: { hasNext: false }
    }
  }

  public async getAddressesFromExtendedPublicKey(
    extendedPublicKey: ExtendedPublicKey,
    visibilityIndex: number,
    addressCount: number,
    offset: number
  ): Promise<Array<{ address: string; cursor: { hasNext: boolean } }>> {
    const addresses: Array<{ address: string; cursor: { hasNext: boolean } }> = []
    for (let i = 0; i < addressCount; i++) {
      addresses.push(await this.getAddressFromExtendedPublicKey(extendedPublicKey, visibilityIndex, offset + i))
    }

    return addresses
  }

  public async deriveFromExtendedPublicKey(
    extendedPublicKey: ExtendedPublicKey,
    visibilityIndex: number,
    addressIndex: number
  ): Promise<PublicKey> {
    return deriveDogecoinPublicKeyFromExtendedPublicKey(extendedPublicKey, visibilityIndex, addressIndex)
  }

  public async getNetwork(): Promise<ProtocolNetwork> {
    return this.network
  }

  public async getTransactionsForPublicKey(
    publicKey: PublicKey | ExtendedPublicKey,
    limit: number,
    cursor?: DogecoinTransactionCursor
  ): Promise<AirGapTransactionsWithCursor<DogecoinTransactionCursor, DogecoinUnits, DogecoinUnits>> {
    const address = await this.getAddressFromPublicKey(publicKey)
    return this.getTransactionsForAddress(address, limit, cursor)
  }

  public async getTransactionsForAddress(
    address: Address,
    limit: number,
    _cursor?: DogecoinTransactionCursor
  ): Promise<AirGapTransactionsWithCursor<DogecoinTransactionCursor, DogecoinUnits, DogecoinUnits>> {
    const transactions = await this.api.getTransactions(address, limit)

    return {
      transactions: transactions.map((transaction) => {
        const received = transaction.outputs
          .filter((output) => output.address === address)
          .reduce((sum, output) => addDecimalStrings(sum, output.value), '0')

        return {
          hash: transaction.hash,
          from: transaction.inputs.length > 0 ? transaction.inputs : [address],
          to: transaction.outputs.map((output) => output.address),
          isInbound: received !== '0',
          amount: { value: received, unit: 'koinu' },
          fee: { value: '0', unit: 'koinu' },
          timestamp: transaction.timestamp,
          network: this.network
        }
      }),
      cursor: { hasNext: false }
    }
  }

  public async getTransactionsForAddresses(
    addresses: Address[],
    limit: number,
    cursor?: DogecoinTransactionCursor
  ): Promise<AirGapTransactionsWithCursor<DogecoinTransactionCursor, DogecoinUnits, DogecoinUnits>> {
    const results = await Promise.all(addresses.map((address) => this.getTransactionsForAddress(address, limit, cursor)))

    return {
      transactions: results.flatMap((result) => result.transactions).slice(0, limit),
      cursor: { hasNext: false }
    }
  }

  /**
   * Fetch the balance of a public key by first converting it to an address.
   * Balance is returned in koinu (1 DOGE = 100 000 000 koinu)【832165120621745†L320-L481】.
   */
  public async getBalanceOfPublicKey(publicKey: PublicKey | ExtendedPublicKey): Promise<Balance<DogecoinUnits>> {
    const address = await this.getAddressFromPublicKey(publicKey)
    return this.getBalanceOfAddress(address)
  }

  public async getBalanceOfAddress(address: Address): Promise<Balance<DogecoinUnits>> {
    const balance = await this.api.getBalance(address)
    return {
      total: {
        value: balance,
        unit: 'koinu'
      }
    }
  }

  public async getBalanceOfAddresses(addresses: Address[]): Promise<Balance<DogecoinUnits>> {
    const balances = await Promise.all(addresses.map((address) => this.getBalanceOfAddress(address)))
    const total = balances.reduce((sum, balance) => addDecimalStrings(sum, balance.total.value), '0')

    return {
      total: {
        value: total,
        unit: 'koinu'
      }
    }
  }

  public async getTransactionMaxAmountWithPublicKey(
    publicKey: PublicKey | ExtendedPublicKey,
    _to: Address[],
    configuration?: { fee?: Amount<DogecoinUnits> }
  ): Promise<Amount<DogecoinUnits>> {
    const balance = await this.getBalanceOfPublicKey(publicKey)
    const fee = configuration?.fee !== undefined ? amountToKoinu(configuration.fee) : DOGECOIN_FEE_DEFAULTS.medium.value
    const hasFee = compareDecimalStrings(balance.total.value, fee) > 0

    return {
      value: hasFee ? subtractDecimalStrings(balance.total.value, fee) : '0',
      unit: 'koinu'
    }
  }

  public async getTransactionFeeWithPublicKey(): Promise<FeeEstimation<DogecoinUnits>> {
    return DOGECOIN_FEE_DEFAULTS
  }

  /**
   * Prepare an unsigned transaction sending funds from the given public key
   * address to the specified outputs. UTXOs are fetched from the API and the
   * selection is naive – it selects UTXOs sequentially until the required
   * amount plus fee is covered. Change is returned to the sender’s address.
   */
  public async prepareTransactionWithPublicKey(
    publicKey: PublicKey | ExtendedPublicKey,
    details: DogecoinTxOutput[] | Array<{ to: string; amount: Amount<DogecoinUnits> }>,
    configuration?: { fee?: Amount<DogecoinUnits> }
  ): Promise<DogecoinUnsignedTransaction> {
    const fromAddress = await this.getAddressFromPublicKey(publicKey)
    const utxos = await this.api.getUtxos(fromAddress)
    const txOutputs = details.map((detail: any) =>
      typeof detail.value === 'string'
        ? detail as DogecoinTxOutput
        : {
            address: detail.to,
            value: amountToKoinu(detail.amount)
          }
    )
    // Compute total required amount
    const sendTotal = txOutputs.reduce((sum, output) => addDecimalStrings(sum, output.value), '0')
    const fee = configuration?.fee !== undefined ? amountToKoinu(configuration.fee) : DOGECOIN_FEE_DEFAULTS.medium.value
    const needed = addDecimalStrings(sendTotal, fee)
    let selected = '0'
    const inputs: any[] = []
    for (const utxo of utxos) {
      inputs.push({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubKey: utxo.scriptPubKey,
        address: fromAddress,
        derivationPath: "m/44'/3'/0'/0/0"
      })
      selected = addDecimalStrings(selected, utxo.value)
      if (compareDecimalStrings(selected, needed) >= 0) {
        break
      }
    }
    if (compareDecimalStrings(selected, needed) < 0) {
      throw new Error('Insufficient Dogecoin balance')
    }
    const outputs: DogecoinTxOutput[] = [...txOutputs]
    const change = subtractDecimalStrings(selected, needed)
    if (compareDecimalStrings(change, '0') > 0) {
      outputs.push({ address: fromAddress, value: change, isChange: true })
    }
    return {
      type: 'unsigned',
      inputs,
      outputs,
      fee,
      changeAddress: fromAddress
    }
  }

  /**
   * Broadcast a signed transaction to the Dogecoin network using the API.
   */
  public async broadcastTransaction(
    transaction: DogecoinSignedTransaction
  ): Promise<string> {
    return this.api.broadcast(transaction.transaction)
  }

  /**
   * Same as offline: extract details from an unsigned transaction. For signed
   * transactions we cannot reverse engineer the recipients so we return an empty
   * array.
   */
  public async getDetailsFromTransaction(
    transaction: DogecoinUnsignedTransaction | DogecoinSignedTransaction,
    publicKey: PublicKey | ExtendedPublicKey
  ): Promise<AirGapTransaction<DogecoinUnits, DogecoinUnits>[]> {
    if (transaction.type === 'signed') {
      return this.getDetailsFromSignedTransaction(transaction, publicKey)
    }
    const paymentOutputs = transaction.outputs.filter((output) => !output.isChange && output.address !== transaction.changeAddress)
    let total = '0'
    for (const output of paymentOutputs) {
      total = addDecimalStrings(total, output.value)
    }
    return [
      {
        from: transaction.inputs.map((i) => i.address),
        to: paymentOutputs.map((o) => o.address),
        isInbound: false,
        amount: { value: total, unit: 'koinu' },
        fee: { value: transaction.fee, unit: 'koinu' },
        network: this.network
      }
    ]
  }

  private async getDetailsFromSignedTransaction(
    transaction: DogecoinSignedTransaction,
    publicKey: PublicKey | ExtendedPublicKey
  ): Promise<AirGapTransaction<DogecoinUnits, DogecoinUnits>[]> {
    const fromAddress = await this.getAddressFromPublicKey(publicKey)
    const outputs = decodeDogecoinP2PKHOutputs(transaction.transaction)
    const paymentOutputs = outputs.filter((output) => output.address !== fromAddress)
    const displayedOutputs = paymentOutputs.length > 0 ? paymentOutputs : outputs
    const total = displayedOutputs.reduce((sum, output) => addDecimalStrings(sum, output.value), '0')

    return [
      {
        from: [fromAddress],
        to: displayedOutputs.map((output) => output.address),
        isInbound: false,
        amount: { value: total, unit: 'koinu' },
        fee: { value: '0', unit: 'koinu' },
        network: this.network,
        transactionDetails: transaction.transaction
      } as AirGapTransaction<DogecoinUnits, DogecoinUnits>
    ]
  }
}
