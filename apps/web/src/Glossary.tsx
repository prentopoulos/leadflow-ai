import { Search } from 'lucide-react';
import { useState } from 'react';

// Plain-language meanings for the terms on the other tabs, grouped the way
// the tabs are. Wording follows the domain metric definitions
// (packages/domain/src/metrics.ts) and the qualification thresholds.
const groups = [
  {
    title: 'Acquisition',
    terms: [
      ['Spend', 'Money spent on advertising in the planned campaign.'],
      ['Lead', 'A person who filled in the insurance enquiry form.'],
      [
        'CPL (cost per lead)',
        'Spend divided by the number of leads. Lower is better.',
      ],
      [
        'MQL (marketing-qualified lead)',
        'A lead scored High or Standard priority: ready for sales follow-up.',
      ],
      ['Cost per MQL', 'Spend divided by the number of MQLs.'],
      [
        'Contactable lead',
        'A lead who agreed to be contacted by email. Only these can be followed up.',
      ],
      ['Cost per contactable lead', 'Spend divided by contactable leads.'],
      ['MQL rate', 'The share of leads that became MQLs.'],
      [
        'Channel',
        'Where a lead came from, such as Paid Search, Paid Social or Affiliates.',
      ],
      ['Campaign', 'One named advert or promotion inside a channel.'],
      ['Spend share / Lead share', 'A channel’s part of all spend or leads.'],
      [
        'Free channel',
        'A channel with no ad spend, such as organic search, so it has no cost per lead.',
      ],
    ],
  },
  {
    title: 'Leads and priority',
    terms: [
      [
        'Priority score',
        'Points out of 100 for how ready a lead is for marketing follow-up. It is never insurance eligibility, pricing or risk.',
      ],
      ['High', '80 or more: call these first.'],
      ['Standard', '50 to 79: worth following up.'],
      ['Nurture', 'Under 50: keep warm with lighter contact.'],
      [
        'Held',
        'Scoring paused because the lead’s details did not add up; a person checks it.',
      ],
      ['Draft', 'A suggested follow-up email. It is never sent automatically.'],
      [
        'Approval queue',
        'Drafts waiting for a person to approve, edit or reject.',
      ],
      [
        'Outcomes',
        'Contacted, Responded and Appointment: how far a lead got after follow-up.',
      ],
    ],
  },
  {
    title: 'Pipeline',
    terms: [
      ['Lead volume', 'How many leads have been stored.'],
      ['Agent failures', 'The share of runs where a processing step failed.'],
      [
        'Typical processing',
        'The middle (median) time to score, enrich and draft one lead.',
      ],
      [
        'Typical review time',
        'The middle (median) time a draft waited before a person decided on it.',
      ],
      [
        'Median',
        'The middle value when all times are sorted; one slow lead does not skew it.',
      ],
    ],
  },
  {
    title: 'Enrichment',
    terms: [
      [
        'Enrichment',
        'Facts added to a lead from public sources, such as the car model or the town for a ZIP code.',
      ],
      [
        'NHTSA vPIC',
        'The US road safety agency’s vehicle database: confirms the make, model and year exist.',
      ],
      [
        'Zippopotam.us',
        'A free ZIP code lookup that returns the town and state.',
      ],
      [
        'Success',
        'Lookups that got an answer, whether or not a match was found.',
      ],
      ['Found', 'Lookups that found a match.'],
      [
        'Not attempted',
        'Lookups skipped because the lead left that detail blank.',
      ],
    ],
  },
] as const;

export function Glossary() {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visible = groups
    .map((group) => ({
      ...group,
      terms: group.terms.filter(([term, meaning]) =>
        `${term} ${meaning}`.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.terms.length > 0);

  return (
    <div className="glossary">
      <div className="operations-heading">
        <h1>Glossary</h1>
      </div>
      <label className="glossary-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search terms</span>
        <input
          type="search"
          placeholder="Search a term, e.g. CPL"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {visible.length === 0 ? (
        <p className="glossary-empty">No term matches “{query}”.</p>
      ) : (
        visible.map((group) => (
          <section
            key={group.title}
            className="glossary-group"
            aria-labelledby={`glossary-${group.title}`}
          >
            <h2 id={`glossary-${group.title}`}>{group.title}</h2>
            <dl>
              {group.terms.map(([term, meaning]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </div>
  );
}
