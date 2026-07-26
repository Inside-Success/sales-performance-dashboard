# Ask Sales blind answer review

## Superseded root packet — do not review or score

The files in this directory root are retained only as an audit record of an invalid run. They must not be used to compare V3 with V5.5 because:

- neither runtime had a configured model provider, so all provider-attempt counts were zero;
- the supposed V5.5 side called the frozen V5.4 entrypoint;
- the user reviewed the resulting fallback-heavy packet before those defects were found.

The corrected provider-backed diagnostic and its low-overload review packet are in [`provider-corrected/`](provider-corrected/). Open `provider-corrected/ASK-SALES-BLIND-REVIEW.html`, not the root HTML file.

The corrected run uses the real production V3 and frozen isolated V5.5 entrypoints with provider/model parity. It is useful diagnostic evidence, but these questions are already exposed and therefore are not a fresh unseen promotion holdout. V5.5 also has a repeatability promotion hold. Production promotion remains unauthorized.
