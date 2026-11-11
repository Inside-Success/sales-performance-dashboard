// Identity-only reference: classification is not approval to sell or promise terms.
// Provenance: governed knowledge records company-current-context,
// active-show-list-resource (ISTV Offers spreadsheet, reviewed Nov 2), and
// documentary-casting-versus-filming-dates-2026-11-04. No pricing inferred here.
const VERSION='offer-identity-catalog-2026-11-12';
const CATALOG={
 main_istv:['Legacy Makers','Women in Power','America’s Best Doctors','Mompreneurs','Blue Collar America','Dropout to CEO'],
 next_level_ceo:['Next Level CEO'],
 reality:['Business Race','Business Race UK','Entrepreneurs Island','Entrepreneurs Jungle','Mansion of Money','Operation Profit','Startup Lockdown','Flipping for Fortune','Millionaire Match House','Love or Business','Kids CEO'],
};
const TEXT=`APPROVED IDENTITY REFERENCE (${VERSION}): ${JSON.stringify(CATALOG)}
This reference maps identified show names to families only. It establishes no current availability, price or entitlement. Use it only after full-source evidence identifies the CURRENT offer; matching a name in a past/comparison/rejected offer or generic video does not identify this call. Ordinary singular/plural transcription variation can be recognized when the surrounding live dialogue establishes the same named show. Do not use fuzzy celebrity matching or invent a title. A clearly identified named show in this reference resolves its family; the rep need not literally say the internal family label. An unlisted show or generic Inside Success brand remains unresolved unless independent source evidence resolves the family. Daymond's name alone is not Next Level CEO. Preserve mixed/unknown when appropriate.`;
module.exports={VERSION,CATALOG,TEXT};
