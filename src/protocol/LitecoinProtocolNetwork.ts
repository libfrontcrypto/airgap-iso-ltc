import { FeeDefaults, ProtocolNetwork } from '@airgap/module-kit'

import { LitecoinUnits } from './LitecoinTypes'

export const LITECOIN_MAINNET: ProtocolNetwork = {
  name: 'Mainnet',
  type: 'mainnet',
  rpcUrl: 'https://api.blockcypher.com/v1/ltc/main',
  blockExplorerUrl: 'https://blockchair.com/litecoin'
}

export const LITECOIN_FEE_DEFAULTS: FeeDefaults<LitecoinUnits> = {
  low: { value: '1000', unit: 'litoshi' },
  medium: { value: '10000', unit: 'litoshi' },
  high: { value: '100000', unit: 'litoshi' }
}
