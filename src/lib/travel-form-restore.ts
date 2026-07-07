import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

/** Bisect Travel Plan form — enable one level at a time in loop-test-config. */
export const TRAVEL_FORM_SECTION_ORDER = [
  'shell',
  'destination',
  'dates',
  'time',
  'budget',
  'budgetIncludes',
  'people',
  'companion',
  'purpose',
  'custom',
  'generate',
  'overlay',
] as const;

export type TravelFormSection = (typeof TRAVEL_FORM_SECTION_ORDER)[number];

export type TravelFormRestoreLevel = TravelFormSection | 'placeholder' | 'full';

export function travelFormSectionAtLeast(
  level: TravelFormRestoreLevel,
  section: TravelFormSection,
): boolean {
  if (level === 'full') return true;
  if (level === 'placeholder') return false;
  const levelIndex = TRAVEL_FORM_SECTION_ORDER.indexOf(level);
  const sectionIndex = TRAVEL_FORM_SECTION_ORDER.indexOf(section);
  if (levelIndex < 0 || sectionIndex < 0) return false;
  return sectionIndex <= levelIndex;
}

export function shouldShowTravelPlanPlaceholder(): boolean {
  return LOOP_TEST_RESTORE.travelPlanPlaceholder;
}

export function logTravelFormRestoreOnce(): void {
  if (!LOOP_TEST_RESTORE.travelPlanForm || LOOP_TEST_RESTORE.travelPlanPlaceholder) return;
  const level = getTravelFormRestoreLevel();
  loopTestLogOnce(`restore:travelForm:${level}`, `travel plan form active (level: ${level})`);
}

export function getTravelFormRestoreLevel(): TravelFormRestoreLevel {
  const level = LOOP_TEST_RESTORE.travelFormRestoreLevel;
  if (level === 'full' || level === 'placeholder') return level;
  if ((TRAVEL_FORM_SECTION_ORDER as readonly string[]).includes(level)) {
    return level as TravelFormSection;
  }
  return 'full';
}

export function shouldShowTravelFormOverlay(): boolean {
  if (LOOP_TEST_RESTORE.travelPlanPlaceholder) return false;
  return travelFormSectionAtLeast(getTravelFormRestoreLevel(), 'overlay');
}
