export { spawnCli } from './util/spawn-cli';
export type { SpawnCliResult, SpawnCliOptions } from './util/spawn-cli';

export { WalletClient } from './wallet';
export type {
  WalletStatus,
  BalanceOptions,
  SendTokenOptions,
  SendTokenResult,
  HistoryOptions,
  HistoryEntry,
} from './wallet';

export { X402PaymentClient } from './x402-payment';
export type { SignPaymentOptions, PaymentProof } from './x402-payment';

export { TrenchesClient } from './trenches';
export type {
  DevHoldingInfo,
  TokenDevInfoResult,
  BundleInfoResult,
} from './trenches';

export { SecurityClient } from './security';

export { SwapClient } from './swap';
export type { SwapQuoteEntry, SwapExecResult } from './swap';

export { createWalletHistoryFetcher } from './recovery-adapter';
export type {
  WalletHistoryEntry,
  RecoveryAdapterOptions,
} from './recovery-adapter';

export {
  AttestationClient,
  CELINA_ATTESTATION_ABI,
  getAttestationFromChain,
} from './attestation';
export type {
  AttestationClientConfig,
  AttestationResult,
  MessageSignature,
} from './attestation';
