# Welcome page simplification — September 22, 2026

Implements Tyler's September 22 welcome-page feedback and Moonis's approved plan. The hero reads “Elite Closers/Athletes Study The Film.”, followed by Review, Reflect, Adjust, Sell More. Two text-only linked cards open Casting Manager AI Coach and Sales FAQ chatbot. Existing branding, background, typography, and card styling are retained with shorter cards and quieter spacing.

Only `src/app/page.tsx` changes runtime behavior. Icons, promotional descriptions, badges, separate button labels, and the redundant footer tagline are removed. Links remain `/coaching` and `/ask-sales-faq`; `dashboard_home_viewed` and its `product_hub` source are unchanged. Authentication, shared navigation, APIs, coaching, scoring, compliance, and chatbot logic are untouched.

Cards retain native link semantics, visible keyboard focus, full-card hit areas, and reduced-motion support. They stack on smaller screens.

Scoped ESLint and a webpack production build passed locally. Release verification must include the production deployment, desktop/mobile rendering, both card destinations, keyboard navigation, and unauthenticated login redirect. No local server is required. See the PR's final verification receipt for live results.

Baseline: main `0e360a588b61690dfe27da084291acc738f3dd0f`. If rollback is needed, revert this page-only release rather than changing any workflow or database.
