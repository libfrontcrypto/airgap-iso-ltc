/**
 * Simple API wrapper used by the online protocol to query Litecoin chain data
 * and broadcast transactions. The API must expose endpoints for address
 * balances, UTXO sets and transaction submission. This abstraction allows
 * switching between public APIs or self-hosted indexers without changing
 * protocol logic.
 */
export interface LitecoinUtxo {
  txid: string
  vout: number
  value: string // in litoshi
  scriptPubKey: string
}

export interface LitecoinTransaction {
  hash: string
  blockHeight?: number
  timestamp?: number
  inputs: string[]
  outputs: Array<{ address: string; value: string }>
}

export interface LitecoinBalance {
  total: string
  transferable?: string
}

export class LitecoinApi {
  constructor(private readonly baseUrl: string) {}

  private readonly blockchairBaseUrl: string = 'https://api.blockchair.com/litecoin'

  private get readBaseUrls(): string[] {
    const urls = [this.baseUrl, this.blockchairBaseUrl]

    return urls.filter((url, index) => urls.indexOf(url) === index)
  }

  private async getJson(path: string, baseUrl: string = this.baseUrl): Promise<any> {
    if (typeof fetch !== 'function') {
      throw new Error('Network requests are not available in this isolated runtime')
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : undefined
    const timeout = typeof setTimeout === 'function'
      ? setTimeout(() => controller?.abort(), 6000)
      : undefined

    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        signal: controller?.signal,
        headers: { accept: 'application/json' }
      })
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout)
      }
    }

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(`Litecoin API request failed: ${response.status}${message ? ` ${message}` : ''}`)
    }

    return response.json()
  }

  private async getJsonOrUndefined(path: string, baseUrl: string = this.baseUrl): Promise<any | undefined> {
    try {
      return await this.getJson(path, baseUrl)
    } catch {
      return undefined
    }
  }

  private async getJsonResults(paths: (baseUrl: string) => string): Promise<Array<{ baseUrl: string; json: any }>> {
    const results = await Promise.all(
      this.readBaseUrls.map(async (baseUrl) => ({
        baseUrl,
        json: await this.getJsonOrUndefined(paths(baseUrl), baseUrl)
      }))
    )

    return results.filter((result): result is { baseUrl: string; json: any } => result.json !== undefined)
  }

  private async getFirstJson(paths: (baseUrl: string) => string): Promise<{ baseUrl: string; json: any } | undefined> {
    const urls = this.readBaseUrls
    if (urls.length === 0) {
      return undefined
    }

    return new Promise<{ baseUrl: string; json: any } | undefined>((resolve) => {
      let settled = false
      let remaining = urls.length

      for (const baseUrl of urls) {
        this.getJsonOrUndefined(paths(baseUrl), baseUrl).then((json) => {
          remaining--
          if (!settled && json !== undefined) {
            settled = true
            resolve({ baseUrl, json })
          } else if (!settled && remaining === 0) {
            settled = true
            resolve(undefined)
          }
        })
      }
    })
  }

  private normalizeInteger(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value))
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return value
    }

    return undefined
  }

  private addDecimalStrings(left: string, right: string): string {
    let carry = 0
    let result = ''
    let i = left.length - 1
    let j = right.length - 1

    while (i >= 0 || j >= 0 || carry > 0) {
      const sum = (i >= 0 ? left.charCodeAt(i--) - 48 : 0) + (j >= 0 ? right.charCodeAt(j--) - 48 : 0) + carry
      result = String(sum % 10) + result
      carry = Math.floor(sum / 10)
    }

    return result.replace(/^0+(?=\d)/, '')
  }

  private parseBlockchairBalance(address: string, json: any): LitecoinBalance | undefined {
    const addressData = json.data?.[address]?.address
    if (addressData === undefined) {
      return undefined
    }

    const confirmed = this.normalizeInteger(addressData.balance)
    const unconfirmed = this.normalizeInteger(
      addressData.unconfirmed_balance ??
      addressData.unconfirmedBalance ??
      addressData.mempool_balance ??
      addressData.mempoolBalance
    )

    if (confirmed === undefined && unconfirmed === undefined) {
      return undefined
    }

    return {
      total: this.addDecimalStrings(confirmed ?? '0', unconfirmed ?? '0'),
      transferable: confirmed
    }
  }

  private parseBlockcypherBalance(json: any): LitecoinBalance | undefined {
    const finalBalance = this.normalizeInteger(json.final_balance)
    const confirmed = this.normalizeInteger(json.balance)
    const unconfirmed = this.normalizeInteger(json.unconfirmed_balance)

    if (finalBalance !== undefined) {
      return {
        total: finalBalance,
        transferable: confirmed
      }
    }

    if (confirmed !== undefined || unconfirmed !== undefined) {
      return {
        total: this.addDecimalStrings(confirmed ?? '0', unconfirmed ?? '0'),
        transferable: confirmed
      }
    }

    return undefined
  }

  private parseGenericBalance(json: any): LitecoinBalance | undefined {
    const total =
      this.normalizeInteger(json.balanceLitoshi) ??
      this.normalizeInteger(json.balancelitoshi) ??
      this.normalizeInteger(json.balanceSat) ??
      this.normalizeInteger(json.finalBalance) ??
      this.normalizeInteger(json.balance)

    if (total !== undefined) {
      return { total }
    }

    if (json.balance !== undefined) {
      const floatBalance = Number(json.balance)
      if (Number.isFinite(floatBalance)) {
        return { total: String(Math.round(floatBalance * 1e8)) }
      }
    }

    return undefined
  }

  /**
   * Fetch the balance of a Litecoin address in litoshi. The API should return
   * either a raw integer or a string containing the value in litoshi (1 LTC =
   * 100 000 000 litoshi). If the API returns balance in LTC, multiply by
   * 100 000 000 externally.
   */
  public async getBalance(address: string): Promise<LitecoinBalance> {
    const results = await this.getJsonResults((baseUrl) =>
      baseUrl.includes('blockchair.com')
        ? `/dashboards/address/${address}?limit=0`
        : baseUrl.includes('blockcypher.com')
          ? `/addrs/${address}/balance`
          : `/address/${address}/balance`
    )

    let zeroBalance: LitecoinBalance | undefined

    for (const { baseUrl, json } of results) {
      const balance = baseUrl.includes('blockchair.com')
        ? this.parseBlockchairBalance(address, json)
        : baseUrl.includes('blockcypher.com')
          ? this.parseBlockcypherBalance(json)
          : this.parseGenericBalance(json)

      if (balance === undefined) {
        continue
      }

      if (balance.total !== '0') {
        return balance
      }

      zeroBalance = balance
    }

    if (zeroBalance !== undefined) {
      return zeroBalance
    }

    return { total: '0' }
  }

  /**
   * Retrieve unspent transaction outputs for the given address. Each UTXO
   * includes the txid (big-endian hex), vout index, value in litoshi and
   * scriptPubKey of the output.
   */
  public async getUtxos(address: string): Promise<LitecoinUtxo[]> {
    const results = await this.getJsonResults((baseUrl) =>
      baseUrl.includes('blockchair.com')
        ? `/dashboards/address/${address}?limit=100`
        : baseUrl.includes('blockcypher.com')
          ? `/addrs/${address}?unspentOnly=true&includeScript=true`
          : `/address/${address}/utxos`
    )

    let emptyResult: LitecoinUtxo[] | undefined

    for (const { baseUrl, json } of results) {
      let utxos: LitecoinUtxo[] | undefined

      if (baseUrl.includes('blockchair.com')) {
        const data = json.data?.[address]
        const scriptPubKey = data?.address?.script_hex ?? ''
        if (Array.isArray(data?.utxo)) {
          utxos = data.utxo.map((u: any) => ({
            txid: u.transaction_hash,
            vout: u.index,
            value: String(u.value),
            scriptPubKey
          }))
        }
      } else if (Array.isArray(json.txrefs) || Array.isArray(json.unconfirmed_txrefs)) {
        utxos = [...(json.txrefs ?? []), ...(json.unconfirmed_txrefs ?? [])].map((u: any) => ({
          txid: u.tx_hash,
          vout: u.tx_output_n,
          value: String(u.value),
          scriptPubKey: u.script ?? u.scriptPubKey ?? ''
        }))
      } else if (Array.isArray(json.utxos)) {
        utxos = json.utxos.map((u: any) => ({
          txid: u.txid,
          vout: u.vout,
          value: String(u.valueLitoshi ?? u.valuelitoshi ?? u.valueSat ?? u.value),
          scriptPubKey: u.scriptPubKey
        }))
      }

      if (utxos === undefined) {
        continue
      }

      if (utxos.length > 0) {
        return utxos
      }

      emptyResult = utxos
    }

    return emptyResult ?? []
  }

  public async getTransactions(address: string, limit: number): Promise<LitecoinTransaction[]> {
    const result = await this.getFirstJson((baseUrl) =>
      baseUrl.includes('blockchair.com')
        ? `/dashboards/address/${address}?limit=${limit}`
        : baseUrl.includes('blockcypher.com')
          ? `/addrs/${address}?limit=${limit}`
          : `/address/${address}/transactions?limit=${limit}`
    )

    if (result === undefined) {
      return []
    }

    const { baseUrl, json } = result

    if (baseUrl.includes('blockchair.com')) {
      const hashes = json.data?.[address]?.transactions
      if (!Array.isArray(hashes)) {
        return []
      }

      return hashes.slice(0, limit).map((hash: string) => ({
        hash,
        inputs: [],
        outputs: []
      }))
    }

    if (Array.isArray(json.txrefs) || Array.isArray(json.unconfirmed_txrefs)) {
      return [...(json.txrefs ?? []), ...(json.unconfirmed_txrefs ?? [])].slice(0, limit).map((tx: any) => ({
        hash: tx.tx_hash,
        blockHeight: tx.block_height,
        timestamp: tx.confirmed ? Math.floor(new Date(tx.confirmed).getTime() / 1000) : undefined,
        inputs: [],
        outputs: [{
          address,
          value: String(tx.value ?? 0)
        }]
      }))
    }

    if (Array.isArray(json.txs)) {
      return json.txs.slice(0, limit).map((tx: any) => ({
        hash: tx.hash ?? tx.txid,
        blockHeight: tx.block_height ?? tx.blockHeight,
        timestamp: tx.confirmed ? Math.floor(new Date(tx.confirmed).getTime() / 1000) : tx.time,
        inputs: (tx.inputs ?? []).flatMap((input: any) => input.addresses ?? [input.address].filter(Boolean)),
        outputs: (tx.outputs ?? []).flatMap((output: any) =>
          (output.addresses ?? [output.address].filter(Boolean)).map((outputAddress: string) => ({
            address: outputAddress,
            value: String(output.value ?? 0)
          }))
        )
      }))
    }

    return []
  }

  /**
   * Broadcast a raw signed transaction to the network. The API should accept a
   * JSON body with the raw hex string under a key such as `rawTx` or
   * `hex` and return the resulting txid.
   */
  public async broadcast(rawTxHex: string): Promise<string> {
    if (typeof fetch !== 'function') {
      throw new Error('Network requests are not available in this isolated runtime')
    }

    const targets = [
      {
        url: `${this.baseUrl}/txs/push`,
        body: { tx: rawTxHex }
      },
      {
        url: `${this.blockchairBaseUrl}/push/transaction`,
        body: { data: rawTxHex }
      }
    ]

    let lastError: unknown
    for (const target of targets) {
      try {
        const response = await fetch(target.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(target.body)
        })
        if (!response.ok) {
          const message = await response.text().catch(() => '')
          throw new Error(`Failed to broadcast LTC transaction: ${response.status}${message ? ` ${message}` : ''}`)
        }
        const json = (await response.json()) as any
        if (json.txid !== undefined) {
          return String(json.txid)
        }
        if (json.tx?.hash !== undefined) {
          return String(json.tx.hash)
        }
        if (json.result !== undefined) {
          return String(json.result)
        }
        if (json.data?.transaction_hash !== undefined) {
          return String(json.data.transaction_hash)
        }
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unknown broadcast response format')
  }
}
