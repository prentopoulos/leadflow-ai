import type { MilitaryAnswers } from '@leadflow-ai/domain';

// Question wording copied from the Military.com auto quote flow definition
// (auto.military.com, read 2026-10-27). The dossier reuses it so answers
// read back exactly as they were asked.
export const MILITARY_QUESTIONS = {
  zip: 'Compare Rates In Your Area',
  currentlyInsured: 'Are you currently insured?',
  currentCarrier: 'Who are you currently insured with?',
  validLicense: 'Do you have a valid driver license?',
  recentIncidents:
    'How many tickets and accidents have you had in the last 3 years?',
  duiDwi: 'Have you gotten a DUI or DWI in the last 3 years?',
  sr22: 'Are you required to have an SR-22?',
  militaryService: 'Have you or a family member served in the U.S. military?',
  vehicle: 'What’s your vehicle year, make and model?',
  multipleDrivers: 'Are there multiple drivers in your household?',
  homeOwner: 'Do you own your home?',
  bundleInterest: 'Want to save by bundling your insurance?',
  married: 'Are you married?',
  gender: 'What is your gender?',
  birthDate: 'What’s your birthdate?',
  address: 'What’s your street address?',
  name: 'What’s your name?',
  email: 'What’s your email address?',
  phone: 'What’s your phone number?',
} as const;

export type ChoiceKey =
  | 'currentlyInsured'
  | 'validLicense'
  | 'recentIncidents'
  | 'duiDwi'
  | 'sr22'
  | 'militaryService'
  | 'multipleDrivers'
  | 'homeOwner'
  | 'bundleInterest'
  | 'married'
  | 'gender';

const yesNo = [
  ['yes', 'Yes'],
  ['no', 'No'],
] as const;
const noYes = [
  ['no', 'No'],
  ['yes', 'Yes'],
] as const;

// Option order follows the live flow.
export const CHOICE_OPTIONS: Record<
  ChoiceKey,
  ReadonlyArray<readonly [string, string]>
> = {
  currentlyInsured: yesNo,
  validLicense: yesNo,
  recentIncidents: [
    ['none', 'None'],
    ['one', 'One'],
    ['multiple', 'Multiple'],
  ],
  duiDwi: noYes,
  sr22: noYes,
  militaryService: yesNo,
  multipleDrivers: yesNo,
  homeOwner: yesNo,
  bundleInterest: yesNo,
  married: yesNo,
  gender: [
    ['male', 'Male'],
    ['female', 'Female'],
  ],
};

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();
  return value === '' ? null : value;
}

// Reads the flow answers from the form; the schema validates them.
export function readMilitaryAnswers(formData: FormData) {
  const choice = (field: ChoiceKey) => text(formData, `military.${field}`);
  const rowIds = new Set<string>();
  for (const key of formData.keys()) {
    const match = /^extraVehicle\.(\d+)\./u.exec(key);
    if (match) rowIds.add(match[1]!);
  }
  const additionalVehicles = [...rowIds]
    .map((row) => {
      const year = text(formData, `extraVehicle.${row}.year`);
      return {
        year: year === null ? null : Number(year),
        make: text(formData, `extraVehicle.${row}.make`),
        model: text(formData, `extraVehicle.${row}.model`),
      };
    })
    .filter(
      (vehicle) =>
        vehicle.year !== null ||
        vehicle.make !== null ||
        vehicle.model !== null,
    );
  const phone = text(formData, 'phone');
  return {
    currentlyInsured: choice('currentlyInsured'),
    currentCarrier: text(formData, 'military.currentCarrier'),
    validLicense: choice('validLicense'),
    recentIncidents: choice('recentIncidents'),
    duiDwi: choice('duiDwi'),
    sr22: choice('sr22'),
    militaryService: choice('militaryService'),
    additionalVehicles,
    multipleDrivers: choice('multipleDrivers'),
    homeOwner: choice('homeOwner'),
    bundleInterest: choice('bundleInterest'),
    married: choice('married'),
    gender: choice('gender'),
    birthDate: text(formData, 'birthDate'),
    streetAddress: text(formData, 'streetAddress'),
    aptUnitSuite: text(formData, 'aptUnitSuite'),
    // Stored as ten digits, so formatting such as dashes is stripped.
    phone: phone === null ? null : phone.replace(/\D/gu, ''),
  } as Record<keyof MilitaryAnswers, unknown>;
}
