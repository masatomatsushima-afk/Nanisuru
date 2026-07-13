/**
 * PlacesProvider 切替検証ランナー（外部通信なし）。
 * 実行: npm run verify:places-provider
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatPlacesProviderVerificationReport,
  runPlacesProviderVerification,
} from '../src/lib/places/places-provider.verify';

function verifyNoApiKeyLiterals(): { passed: boolean; detail: string } {
  const placesDir = join(process.cwd(), 'src/lib/places');
  const apiKeyPattern = /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}/;

  for (const file of readdirSync(placesDir)) {
    if (!file.endsWith('.ts')) continue;
    const content = readFileSync(join(placesDir, file), 'utf8');
    if (apiKeyPattern.test(content)) {
      return { passed: false, detail: `Possible API key pattern in ${file}` };
    }
  }

  return { passed: true, detail: 'No API key literals detected in src/lib/places' };
}

runPlacesProviderVerification()
  .then((report) => {
    const keyCheck = verifyNoApiKeyLiterals();
    report.cases.push({
      name: 'no_api_key_literals_in_places_module',
      passed: keyCheck.passed,
      detail: keyCheck.detail,
    });
    report.ok = report.cases.every((item) => item.passed);

    console.log(formatPlacesProviderVerificationReport(report));
    process.exit(report.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
