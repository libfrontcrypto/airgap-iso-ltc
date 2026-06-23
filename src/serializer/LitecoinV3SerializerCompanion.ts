import { AirGapV3SerializerCompanion, V3SchemaConfiguration } from '@airgap/module-kit'
import { AccountShareResponse, IACMessageType, SchemaRoot, TransactionSignRequest, TransactionSignResponse } from '@airgap/serializer'

import {
  LitecoinUnsignedTransaction,
  LitecoinSignedTransaction
} from '../protocol/LitecoinTypes'
import { deriveLitecoinPublicKeyFromExtendedPublicKey } from '../crypto/litecoin-address'

const accountShareResponse: SchemaRoot = require('@airgap/serializer/v3/schemas/generated/account-share-response.json')
const LitecoinTransactionSignRequest: SchemaRoot = {
  $ref: '#/definitions/LitecoinTransactionSignRequest',
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: {
    LitecoinTransactionSignRequest: {
      additionalProperties: false,
      properties: {
        publicKey: { type: 'string' },
        transaction: {
          additionalProperties: false,
          properties: {
            changeAddress: { type: 'string' },
            fee: { type: 'string' },
            inputs: {
              items: {
                additionalProperties: false,
                properties: {
                  address: { type: 'string' },
                  derivationPath: { type: 'string' },
                  scriptPubKey: { type: 'string' },
                  txid: { type: 'string' },
                  value: { type: 'string' },
                  vout: { type: 'number' }
                },
                required: ['txid', 'vout', 'value', 'scriptPubKey', 'address', 'derivationPath'],
                type: 'object'
              },
              type: 'array'
            },
            outputs: {
              items: {
                additionalProperties: false,
                properties: {
                  address: { type: 'string' },
                  value: { type: 'string' }
                },
                required: ['address', 'value'],
                type: 'object'
              },
              type: 'array'
            },
            type: { type: 'string' }
          },
          required: ['type', 'inputs', 'outputs', 'fee', 'changeAddress'],
          type: 'object'
        }
      },
      required: ['transaction', 'publicKey'],
      type: 'object'
    }
  }
} as any
const LitecoinTransactionSignResponse: SchemaRoot = {
  $ref: '#/definitions/LitecoinTransactionSignResponse',
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: {
    LitecoinTransactionSignResponse: {
      additionalProperties: false,
      properties: {
        accountIdentifier: { type: 'string' },
        transaction: { type: 'string' }
      },
      required: ['transaction', 'accountIdentifier'],
      type: 'object'
    }
  }
} as any

/**
 * Serializer companion for Litecoin. Converts internal transaction objects
 * into the AirGap V3 message format used for QR transfer between wallet and
 * vault and back again. This implementation follows a minimal schema: the
 * unsigned transaction is embedded directly in the sign request and the
 * signed transaction is embedded directly in the sign response.
 */
export class LitecoinV3SerializerCompanion implements AirGapV3SerializerCompanion {
  public readonly schemas: V3SchemaConfiguration[] = [
    {
      type: IACMessageType.AccountShareResponse,
      schema: { schema: accountShareResponse },
      protocolIdentifier: 'litecoin'
    },
    {
      type: IACMessageType.TransactionSignRequest,
      schema: { schema: LitecoinTransactionSignRequest },
      protocolIdentifier: 'litecoin'
    },
    {
      type: IACMessageType.TransactionSignResponse,
      schema: { schema: LitecoinTransactionSignResponse },
      protocolIdentifier: 'litecoin'
    }
  ]

  public async toTransactionSignRequest(
    identifier: string,
    unsignedTransaction: any,
    publicKey: string,
    callbackURL?: string
  ): Promise<TransactionSignRequest> {
    const request: TransactionSignRequest = {
      transaction: unsignedTransaction,
      publicKey
    }

    if (callbackURL !== undefined) {
      request.callbackURL = callbackURL
    }

    return request
  }

  public async fromTransactionSignRequest(
    _identifier: string,
    transactionSignRequest: TransactionSignRequest
  ): Promise<LitecoinUnsignedTransaction> {
    return transactionSignRequest.transaction as unknown as LitecoinUnsignedTransaction
  }

  public async validateTransactionSignRequest(
    identifier: string,
    transactionSignRequest: TransactionSignRequest
  ): Promise<boolean> {
    return (
      identifier === 'litecoin' &&
      typeof transactionSignRequest.publicKey === 'string' &&
      (transactionSignRequest.transaction as any)?.type === 'unsigned'
    )
  }

  public async toTransactionSignResponse(
    identifier: string,
    signedTransaction: any,
    accountIdentifier: string
  ): Promise<TransactionSignResponse> {
    return {
      transaction: typeof signedTransaction === 'string' ? signedTransaction : signedTransaction.transaction,
      accountIdentifier
    }
  }

  public async fromTransactionSignResponse(
    _identifier: string,
    transactionSignResponse: TransactionSignResponse
  ): Promise<LitecoinSignedTransaction> {
    return {
      type: 'signed',
      transaction: transactionSignResponse.transaction
    }
  }

  public async validateTransactionSignResponse(
    identifier: string,
    transactionSignResponse: TransactionSignResponse
  ): Promise<boolean> {
    return (
      identifier === 'litecoin' &&
      typeof transactionSignResponse.accountIdentifier === 'string' &&
      typeof transactionSignResponse.transaction === 'string' &&
      transactionSignResponse.transaction.length > 0
    )
  }

  public async toAccountShareResponse(
    identifier: string,
    publicKey: string,
    derivationPath: string,
    masterFingerprint: string = '',
    isActive: boolean = true,
    groupId: string = '',
    groupLabel: string = 'Litecoin'
  ): Promise<AccountShareResponse> {
    const walletPublicKey = this.isExtendedPublicKey(publicKey)
      ? (await deriveLitecoinPublicKeyFromExtendedPublicKey(
          { type: 'xpub', format: 'encoded', value: publicKey },
          0,
          0
        )).value
      : publicKey
    const walletDerivationPath = this.isExtendedPublicKey(publicKey) ? `${derivationPath}/0/0` : derivationPath

    if (!(await this.validateAccountShareResponse(identifier, {
      publicKey: walletPublicKey,
      derivationPath: walletDerivationPath,
      isExtendedPublicKey: false,
      masterFingerprint,
      isActive,
      groupId,
      groupLabel
    }))) {
      throw new Error('Invalid Litecoin account share response')
    }

    return {
      publicKey: walletPublicKey,
      derivationPath: walletDerivationPath,
      isExtendedPublicKey: false,
      masterFingerprint,
      isActive,
      groupId,
      groupLabel
    }
  }

  public async fromAccountShareResponse(
    _identifier: string,
    accountShareResponse: AccountShareResponse
  ): Promise<string> {
    return accountShareResponse.publicKey
  }

  public async validateAccountShareResponse(
    identifier: string,
    accountShareResponse: AccountShareResponse
  ): Promise<boolean> {
    if (identifier !== 'litecoin') {
      return false
    }

    if (typeof accountShareResponse?.publicKey !== 'string' || accountShareResponse.publicKey.length === 0) {
      return false
    }

    if (
      typeof accountShareResponse.derivationPath !== 'string' ||
      !accountShareResponse.derivationPath.startsWith("m/44'/2'")
    ) {
      return false
    }

    if (
      typeof accountShareResponse.isExtendedPublicKey !== 'boolean' ||
      accountShareResponse.isExtendedPublicKey !== this.isExtendedPublicKey(accountShareResponse.publicKey)
    ) {
      return false
    }

    return (
      typeof accountShareResponse.masterFingerprint === 'string' &&
      typeof accountShareResponse.isActive === 'boolean' &&
      typeof accountShareResponse.groupId === 'string' &&
      typeof accountShareResponse.groupLabel === 'string'
    )
  }

  private isExtendedPublicKey(publicKey: string): boolean {
    return /^(xpub|ypub|zpub)/.test(publicKey)
  }
}
