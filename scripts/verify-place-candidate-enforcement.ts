/**
 * enforcePlaceCandidateSelection 検証ランナー（外部通信なし）。
 * 実行: npm run verify:places-enforcement
 */

import {
  formatVerificationReport,
  runPlaceCandidateEnforcementVerification,
} from '../src/lib/places/place-candidate-enforcement.verify';

const report = runPlaceCandidateEnforcementVerification();
console.log(formatVerificationReport(report));
process.exit(report.ok ? 0 : 1);
