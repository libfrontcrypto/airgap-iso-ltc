import {
  AirGapBlockExplorer,
  AirGapModule,
  AirGapOfflineProtocol,
  AirGapOnlineProtocol,
  AirGapV3SerializerCompanion,
  createSupportedProtocols,
  ModuleNetworkRegistry,
  ProtocolConfiguration,
  ProtocolNetwork
} from '@airgap/module-kit'

import { DogecoinOfflineProtocol } from '../protocol/DogecoinOfflineProtocol'
import { DogecoinOnlineProtocol } from '../protocol/DogecoinOnlineProtocol'
import { DogecoinApi } from '../api/DogecoinApi'
import { DogecoinV3SerializerCompanion } from '../serializer/DogecoinV3SerializerCompanion'
import { DOGECOIN_MAINNET } from '../protocol/DogecoinProtocolNetwork'

const createHash = require('@airgap/coinlib-core/dependencies/src/create-hash-1.2.0/browser')

const DOGECOIN_PROTOCOL_IDENTIFIER = 'dogecoin'
const DOGECOIN_NETWORK_REGISTRY = new ModuleNetworkRegistry({
  supportedNetworks: [DOGECOIN_MAINNET]
})

function utf8Bytes(input: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }

  return new Uint8Array(bytes)
}

function base64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i]
    const second = bytes[i + 1]
    const third = bytes[i + 2]
    const triple = (first << 16) | ((second ?? 0) << 8) | (third ?? 0)

    output += alphabet[(triple >> 18) & 0x3f]
    output += alphabet[(triple >> 12) & 0x3f]
    output += i + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : '='
    output += i + 2 < bytes.length ? alphabet[triple & 0x3f] : '='
  }

  return output
}

function protocolNetworkIdentifier(network: ProtocolNetwork): string {
  const hash = base64(createHash('sha256').update(utf8Bytes(`${network.name}-${network.rpcUrl}`)).digest()).slice(0, 10)

  return `${network.type}-${hash}`
}

/**
 * AirGap module wrapper exposing supported protocols and factory methods.
 */
export class DogecoinModule implements AirGapModule {
  private readonly networkRegistries: Record<string, ModuleNetworkRegistry> = {
    [DOGECOIN_PROTOCOL_IDENTIFIER]: DOGECOIN_NETWORK_REGISTRY
  }

  /**
   * Declare the protocols this module supports. Only one protocol (dogecoin) is
   * supported in this module. The identifier must match what the wallet will
   * reference to pick the correct module implementation.
   */
  public readonly supportedProtocols: Record<string, ProtocolConfiguration> = createSupportedProtocols(this.networkRegistries)

  /**
   * Create the offline protocol implementation. Called by the Vault side to
   * derive keys, addresses and sign transactions without network access.
   */
  public async createOfflineProtocol(
    identifier: string
  ): Promise<AirGapOfflineProtocol | undefined> {
    if (identifier !== DOGECOIN_PROTOCOL_IDENTIFIER) {
      return undefined
    }
    return new DogecoinOfflineProtocol() as unknown as AirGapOfflineProtocol
  }

  /**
   * Create the online protocol implementation. Called by the Wallet side to
   * query balances, build unsigned transactions and broadcast signed ones. The
   * optional network argument allows specifying a custom API URL via the
   * `extras.apiUrl` property on the network.
   */
  public async createOnlineProtocol(
    identifier: string,
    networkOrId?: string | ProtocolNetwork
  ): Promise<AirGapOnlineProtocol | undefined> {
    if (identifier !== DOGECOIN_PROTOCOL_IDENTIFIER) {
      return undefined
    }

    const network =
      typeof networkOrId === 'string'
        ? this.networkRegistries[identifier]?.findNetwork(networkOrId)
        : networkOrId ?? this.networkRegistries[identifier]?.findNetwork()

    if (network === undefined) {
      return undefined
    }

    let apiUrl: string | undefined
    if (typeof network === 'object' && (network as any).extras) {
      apiUrl = (network as any).extras.apiUrl
    }
    const url = apiUrl ?? network.rpcUrl
    return new DogecoinOnlineProtocol(new DogecoinApi(url), network) as unknown as AirGapOnlineProtocol
  }

  /**
   * Provide Dogecoin block explorer links for imported Wallet accounts.
   */
  public async createBlockExplorer(
    identifier: string,
    _networkOrId?: string | ProtocolNetwork
  ): Promise<AirGapBlockExplorer | undefined> {
    if (identifier !== DOGECOIN_PROTOCOL_IDENTIFIER) {
      return undefined
    }

    return {
      getMetadata: async () => ({
        name: 'Blockchair',
        url: 'https://blockchair.com/dogecoin'
      }),
      createAddressUrl: async (address: string) => `https://blockchair.com/dogecoin/address/${address}`,
      createTransactionUrl: async (transactionId: string) => `https://blockchair.com/dogecoin/transaction/${transactionId}`
    }
  }

  /**
   * Return the serializer companion that knows how to convert internal
   * transaction representations into the AirGap V3 message format. Required
   * for communication between wallet and vault.
   */
  public async createV3SerializerCompanion(): Promise<AirGapV3SerializerCompanion> {
    return new DogecoinV3SerializerCompanion()
  }
}
