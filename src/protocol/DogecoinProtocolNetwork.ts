import { FeeDefaults, ProtocolNetwork } from '@airgap/module-kit'

import { DogecoinUnits } from './DogecoinTypes'

export const DOGECOIN_MAINNET: ProtocolNetwork = {
  name: 'Mainnet',
  type: 'mainnet',
  rpcUrl: 'https://api.blockcypher.com/v1/doge/main',
  blockExplorerUrl: 'https://blockchair.com/dogecoin'
}

export const DOGECOIN_FEE_DEFAULTS: FeeDefaults<DogecoinUnits> = {
  low: { value: '100000', unit: 'koinu' },
  medium: { value: '1000000', unit: 'koinu' },
  high: { value: '5000000', unit: 'koinu' }
}
