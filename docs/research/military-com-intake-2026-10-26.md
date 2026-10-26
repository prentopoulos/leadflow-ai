# Military.com auto-insurance intake: full question list

Checked: 2026-10-26. Supersedes the field list in
[military-com-intake-2026-10-24.md](military-com-intake-2026-10-24.md), which saw only the
landing page.

## Method

- Public page: [Compare Car Insurance Quotes](https://auto.military.com/), opened in a browser.
- The page renders every form step into the document up front and reveals one at a time. The
  question headings and answer options were read from that rendered page.
- Nothing was typed, selected, clicked or submitted, so no answer or personal data reached
  Military.com or its partners. Authorized by the owner on 2026-10-26.

## What changed since 2026-10-24

The page now opens directly on the form at "21% complete" with the first question "Are you
currently insured?". The ZIP Code step ("Compare Rates In Your Area") is still in the page but was
skipped, and the header named the visitor's state (California), which suggests the location is
inferred from the connection. The header reads "Get fast, cheap car insurance quotes in California
with one simple form."

## Questions, in page order

| # | Question | Answer type and options |
|---|---|---|
| 1 | Compare Rates In Your Area | ZIP Code text field (skipped when the location is inferred) |
| 2 | Are you currently insured? | Yes, No |
| 3 | Who are you currently insured with? | Allstate, American Family, Farmers, GEICO, Liberty Mutual, Mercury, Nationwide, Progressive, State Farm, Travelers, USAA, The General, Other |
| 4 | Do you have a valid driver license? | Yes (valid), No (none, suspended or revoked) |
| 5 | How many tickets and accidents have you had in the last 3 years? | None, One, Multiple |
| 6 | Have you gotten a DUI or DWI in the last 3 years? | No, Yes |
| 7 | Are you required to have an SR-22? | No, Yes |
| 8 | Have you or a family member served in the U.S. military? | Yes, No |
| 9 | What's your vehicle year? | 28 buttons, 2026 down to 1999 |
| 10 | What's your vehicle make? | Select list, filled after the year is chosen |
| 11 | What's your vehicle model? | Options filled after the make is chosen |
| 12 | Are you interested in insuring another vehicle? | Add another vehicle, or done; steps 9–12 repeat for up to five vehicles |
| 13 | Are there multiple drivers in your household? | Yes, No |
| 14 | Do you own your home? | Yes, No |
| 15 | Want to save by bundling your insurance? | Yes, No |
| 16 | Are you married? | Yes, No |
| 17 | What is your gender? | Male, Female |
| 18 | What's your birthdate? | Month, day and year selects (years from 2008 back) |
| 19 | What's your street address? | Street address (required), apartment/unit/suite (optional) |
| 20 | What's your name? | First name, last name |
| 21 | What's your email address? | Email field |
| 22 | What's your phone number? | Phone field |

A "Welcome back!" step offers to continue or restart a saved quote.

## Not established

- The final step's button label, any consent or contact-permission wording near the phone field,
  and what happens after submission. That text is not in the page until the step is reached.
- Vehicle make and model lists, which load from the chosen year and make.
- Validation rules beyond the required street-address field, and whether answers branch the order
  (for example skipping question 3 when the answer to 2 is No).
- Any partner pages after submission.

## Comparison with the LeadFlow demo intake

- **Matches:** ZIP Code (1); vehicle year, make and model (9–11, one vehicle only); name (20);
  email (21).
- **LeadFlow has, Military.com does not:** coverage focus, request intent, need timeline, free-text
  request details, and the explicit email-contact consent checkbox.
- **Military.com has, LeadFlow does not:** current insurance and insurer, licence status, tickets
  and accidents, DUI/DWI, SR-22, military service, multiple vehicles and drivers, home ownership,
  bundling, marital status, gender, birthdate, street address and phone.

Many of Military.com's questions (driving record, DUI, SR-22, gender, marital status, birthdate)
are underwriting and pricing factors. LeadFlow deliberately scores marketing readiness only, never
eligibility or price (PROJECT.md section 5), so adopting them would need an owner decision. The
PROJECT.md parity gate stays unresolved: the question list is now known, but the consent wording
and submission flow are not.

## Recheck trigger

Recheck before changing the intake form toward parity, claiming parity, or describing Military.com's
intake in a walkthrough.
