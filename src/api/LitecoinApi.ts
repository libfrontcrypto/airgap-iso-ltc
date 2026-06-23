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

export class LitecoinApi {
  constructor(private readonly baseUrl: string) {}

  private readonly blockchairBaseUrl: string = 'https://api.blockchair.com/litecoin'

  private get readBaseUrls(): string[] {
    const urls = [this.blockchairBaseUrl, this.baseUrl]

    return urls.filter((url, index) => urls.indexOf(url) === index)
  }

  private async getJson(path: string, baseUrl: string = this.baseUrl): Promise<any> {
    if (typeof fetch !== 'function') {
      throw new Error('Network requests are not available in this isolated runtime')
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : undefined
    const timeout = typeof setTimeout === 'function'
      ? setTimeout(() => controller?.abort(), 8000)
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

  private async getFirstJson(paths: (baseUrl: string) => string): Promise<{ baseUrl: string; json: any } | undefined> {
    for (const baseUrl of this.readBaseUrls) {
      const json = await this.getJsonOrUndefined(paths(baseUrl), baseUrl)
      if (json !== undefined) {
        return { baseUrl, json }
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
  public async getBalance(address: string): Promise<string> {
    const result = await this.getFirstJson((baseUrl) =>
      baseUrl.includes('blockchair.com')
        ? `/dashboards/address/${address}?limit=0`
        : baseUrl.includes('blockcypher.com')
          ? `/addrs/${address}/balance`
          : `/address/${address}/balance`
    )

    if (result === undefined) {
      return '0'
    }

    const { baseUrl, json } = result

    if (baseUrl.includes('blockchair.com')) {
      const balance = json.data?.[address]?.address?.balance
      if (balance !== undefined) {
        return String(balance)
      }
    }

    if (json.final_balance !== undefined) {
      return String(json.final_balance)
    }
    if (json.balanceLitoshi !== undefined) {
      return String(json.balanceLitoshi)
    }
    if (json.balancelitoshi !== undefined) {
      return String(json.balancelitoshi)
    }
    if (json.balanceSat !== undefined) {
      return String(json.balanceSat)
    }
    if (json.balance !== undefined && Number.isInteger(json.balance)) {
      return String(json.balance)
    }
    // Many APIs return the field balance (LTC) or balanceSat (litoshi). Try both.
    if (json.balance !== undefined) {
      // assume LTC and convert to litoshi
      const floatBalance = Number(json.balance)
      return String(Math.round(floatBalance * 1e8))
    }
    throw new Error('Unknown balance format')
  }

  /**
   * Retrieve unspent transaction outputs for the given address. Each UTXO
   * includes the txid (big-endian hex), vout index, value in litoshi and
   * scriptPubKey of the output.
   */
  public async getUtxos(address: string): Promise<LitecoinUtxo[]> {
    const result = await this.getFirstJson((baseUrl) =>
      baseUrl.includes('blockchair.com')
        ? `/dashboards/address/${address}?limit=100`
        : baseUrl.includes('blockcypher.com')
          ? `/addrs/${address}?unspentOnly=true&includeScript=true`
          : `/address/${address}/utxos`
    )

    if (result === undefined) {
      return []
    }

    const { baseUrl, json } = result

    if (baseUrl.includes('blockchair.com')) {
      const data = json.data?.[address]
      const scriptPubKey = data?.address?.script_hex ?? ''
      if (!Array.isArray(data?.utxo)) {
        return []
      }

      return data.utxo.map((u: any) => ({
        txid: u.transaction_hash,
        vout: u.index,
        value: String(u.value),
        scriptPubKey
      }))
    }

    if (Array.isArray(json.txrefs)) {
      return json.txrefs.map((u: any) => ({
        txid: u.tx_hash,
        vout: u.tx_output_n,
        value: String(u.value),
        scriptPubKey: u.script ?? u.scriptPubKey ?? ''
      }))
    }

    if (!Array.isArray(json.utxos)) {
      throw new Error('Invalid UTXO response format')
    }
    return json.utxos.map((u: any) => ({
      txid: u.txid,
      vout: u.vout,
      value: String(u.valueLitoshi ?? u.valuelitoshi ?? u.valueSat ?? u.value),
      scriptPubKey: u.scriptPubKey
    }))
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

    if (Array.isArray(json.txrefs)) {
      return json.txrefs.slice(0, limit).map((tx: any) => ({
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
