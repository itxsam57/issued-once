import fs from 'node:fs';

const path = '.engineering/CONTINUATION.json';
const state = JSON.parse(fs.readFileSync(path, 'utf8'));
const integrationHead = 'b3952681883443fe3277343aa1e7a6885f716552';
const integrationTree = '4057a5b187e63632b80623e246d129df4d476f8f';
const liveRelease = '97d5f015df33bf4ec5486e7b6a5d3d135fc184cc';
const now = new Date().toISOString();

state.version = '1.36.5';
state.updatedAt = now;
Object.assign(state.sourceOfTruth, {
  verifiedRuntimeIntegrationHead: integrationHead,
  verifiedRuntimeTree: integrationTree,
  liveReleaseHead: liveRelease,
  liveReleaseTree: integrationTree,
  hostingerLinkedBranchHead: liveRelease,
  latestEngineeringIntegrationHead: integrationHead,
  latestEngineeringIntegrationTree: integrationTree,
  latestEngineeringIntegrationVerifiedAt: now,
});

Object.assign(state.continuationGovernor, {
  state: 'OWNER_REQUIRED',
  currentEngineeringStopRequired: true,
  currentEngineeringStopReason: 'The exact 34-variant Printful map is now audited in code, the owner-approved catalog is ACTIVE v1, and the exact Hostinger release has passed support, boundary, Tee/Cap/Tote physical-gate, and real OTP-request proof. Remaining launch blockers are production privacy migration 0037, Safepay runtime configuration/live proof, and Printful signed-webhook configuration/live provider proof. Real payment/refund and manufacturing confirmation remain separately gated.',
  decision: 'STOP_AT_PRIVACY_SAFEPAY_PRINTFUL_WEBHOOK_GATES',
  reason: 'Catalog mapping, publication and temporary-host physical selection proof are complete. Do not reintroduce PRINTFUL_VARIANT_MAP_JSON as a deployment requirement. Do not apply migration 0037, create a real Safepay charge/refund, confirm Printful manufacturing, rotate privacy keys, delete retained V2 data, or cut over the canonical domain without the required explicit owner gate.',
});

state.engineeringFactory.internalWorkStatus = 'CATALOG_ACTIVE_AND_PHYSICAL_FLOW_PROVEN_REMAINING_OWNER_PROVIDER_GATES';
Object.assign(state.standingOwnerGates, {
  productionCatalogPublication: false,
  printfulVariantMapConfiguration: false,
  hostingerAuthenticationForProviderConfig: false,
});

Object.assign(state.productionRuntime, {
  liveRelease,
  liveTree: integrationTree,
  activeProductionCatalogCount: 1,
  printfulVariantMapConfigured: true,
  printfulSignedWebhookConfigured: false,
  productionMigration0037Applied: false,
});

state.nextAction = {
  actor: 'OWNER_OR_PROVIDER',
  instruction: 'Catalog and physical-selection gates are complete. Next, apply production migration 0037 only after explicit owner approval; configure truthful Safepay runtime values and Printful signed-webhook values without exposing secrets; keep PRINTFUL_ALLOW_CONFIRM disabled. Then rerun readiness and temporary-host live proofs before any canonical-domain cutover or real charge/manufacturing proof.',
};

const finish = state.consumerReadinessFinishV4;
finish.freshLiveEvidence.printfulCatalog20260905 = {
  integration: integrationHead,
  liveRelease,
  providerVariants: '34/34 verified from live Printful API and audited into the runtime map',
  mapping: 'built-in audited provider truth; environment override optional only',
  activeCatalogCount: 1,
};
finish.freshLiveEvidence.catalogActivation20260906 = {
  run: 33994961529,
  job: 101383778554,
  release: liveRelease,
  result: 'PASS: ACTIVE v1, USD, exact approved 3 products / 34 variants structurally verified; catalog-authority=ready',
};
finish.freshLiveEvidence.temporaryPhysicalProof20260906 = {
  run: 33994492960,
  job: 101383892978,
  release: liveRelease,
  result: 'PASS: exact release + Tee physical gate + Hat physical gate + Tote physical gate + real OTP request boundary; visual evidence artifact 9977791873',
};
finish.catalogAndPhysicalProof20260906 = {
  pullRequest: 98,
  candidateHead: '8a79f2da59a0dd0db81c69fcfc1a74e92405fca3',
  integrationHead,
  integrationTree,
  exactHeadCiRun: 33994176206,
  postMergeCiRun: 33994312767,
  postMergeBrowserQaRun: 33994312721,
  releaseWrapper: liveRelease,
  liveSupportProofRun: 33994492972,
  liveBoundaryAuditRun: 33994492974,
  catalogActivationRun: 33994961529,
  catalogActivationJob: 101383778554,
  catalogVersion: 1,
  catalogProducts: 3,
  catalogVariants: 34,
  temporaryPhysicalProofRun: 33994492960,
  temporaryPhysicalProofJob: 101383892978,
  realOtpRequestReached: true,
  realSafepayChargePerformed: false,
  realSafepayRefundPerformed: false,
  printfulProductionConfirmationPerformed: false,
};
finish.remainingOwnerOrProviderGates = [
  'apply production migration 0037 only after explicit owner approval; retain current V2 data and keys until the separate prelaunch cleanup gate',
  'configure Safepay production runtime with truthful provider-issued values and complete separately approved live payment/refund proofs',
  'configure Printful signed-webhook runtime with truthful provider-issued values; keep PRINTFUL_ALLOW_CONFIRM disabled until the separate manufacturing gate',
  'attest truthful public merchant/legal disclosure',
  'complete remaining row-specific payment/design/Printful/tracking/support/recovery/refund proofs',
  'complete CR-28 one controlled full live order plus a second isolated customer proof',
  'canonical-domain cutover remains after temporary-host/provider/privacy gates are green',
];

fs.writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
JSON.parse(fs.readFileSync(path, 'utf8'));
console.log(`LEDGER_SYNC_PASS version=${state.version} integration=${integrationHead} release=${liveRelease}`);
