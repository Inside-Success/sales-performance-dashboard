# Ask Sales V5.3 seven-stage failure funnel

Generated: 2026-07-24T20:05:27.680Z

Status: consumed-data diagnostic only. This is not promotion evidence and must not be used to tune question-specific rules.

## Populations

- Source/admission audit: 80 source-reviewed cases across the V5, V5.1, and V5.2 consumed Slack sets.
- Runtime funnel: 40 V5.2 cases with frozen runtime traces and manual source review.
- Expected-answer runtime cases: 26; expected-route runtime cases: 14.

## Answer funnel

| Stage | Cases | Rate |
|---|---:|---:|
| Exact Slack source lineage exists in the snapshot | 23 | 88.5% |
| Exact source-linked policy is answer eligible | 15 | 57.7% |
| Source-linked answer evidence entered top-k | 8 | 30.8% |
| Source-linked answer evidence survived source planning | 5 | 19.2% |
| Source-linked answer evidence was selected for composition | 4 | 15.4% |
| Concept-equivalent answer evidence exists | 7 | 26.9% |
| Equivalent evidence entered top-k | 4 | 15.4% |
| Equivalent evidence survived source planning | 2 | 7.7% |
| Equivalent evidence was selected for composition | 1 | 3.8% |
| Runtime returned answer or partial | 9 | 34.6% |
| Output preserved all simple gold concepts | 1 | 3.8% |

## Route funnel

- Correct owner: 9/14.
- Wrong owner: 5/14.
- Route cases without a single owner label: 0/14.

### Confusion matrix

Rows are the source-reviewed owner; columns show the runtime owner or `none`. Multi-owner outputs retain every owner instead of being forced into one label.

```json
{
  "finance": {
    "finance+fulfillment": 1,
    "sales_policy": 1,
    "finance": 1
  },
  "sales_policy": {
    "none": 2,
    "sales_policy": 5
  },
  "greenlight": {
    "greenlight": 1
  },
  "sales_tech": {
    "sales_tech": 1
  },
  "fulfillment": {
    "sales_policy": 2
  }
}
```

## Interpretation boundary

Concept matching is a deterministic diagnostic approximation, not an answer judge. The per-case traces and manual source review remain controlling. The funnel separates source coverage, answer admission, top-k retrieval, source planning, composition, routing, and final manual outcome so later work changes the stage that actually loses support.
