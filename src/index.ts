import './runtime-polyfills'
import { AirGapModule } from '@airgap/module-kit'
import { LitecoinModule } from './module/LitecoinModule'

/**
 * Entry point called by the AirGap Wallet/Vault runtime when loading the isolated module.
 * It must return an instance of your module implementation.
 */
export function create(): AirGapModule {
  return new LitecoinModule()
}
