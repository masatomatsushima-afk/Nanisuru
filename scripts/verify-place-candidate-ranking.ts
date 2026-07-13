/**
 * PlaceCandidate ランキング検証ランナー（外部通信なし）。
 * 実行: npm run verify:places-ranking
 */

import {
  formatVerificationReport,
  runPlaceCandidateRankingVerification,
} from '../src/lib/places/place-candidate-ranking.verify';

const report = runPlaceCandidateRankingVerification();
console.log(formatVerificationReport(report));
process.exit(report.ok ? 0 : 1);
