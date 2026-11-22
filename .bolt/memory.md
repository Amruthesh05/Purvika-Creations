# Project memory

## Product intent & audience

- E-commerce storefront (brand: **Styvio**) selling physical products.
- Includes an admin panel for catalog management (add/edit products, active toggle, stock status) and admin-user management.
- Public-facing pages: storefront/products page, legal/policy pages, about/brand page.

## Brand personality & voice

- Brand story ("Styvio story") already exists and is used on the About page.
- Policy pages use a professional, customer-facing tone; copy should be reviewed for accuracy against actual business practices.

## Visual design & UX direction

- Footer links to four key pages: Privacy Policy, Terms of Service, Returns & Replacements, About.
- Products page is the primary storefront entry for browsing catalog items.
- Admin catalog UI includes an "Active (visible in catalog)" checkbox per product and a stock-status toggle.
- Admin panel uses role-based UI: regular admins do not see the **Authorization** menu option; superadmins do.
- Regular admin product UI exposes only the stock-status switch; price fields, edit/delete buttons, and visibility/sale-mode controls are hidden from regular admins.

## Decisions, constraints & rationale

- Policy pages created as separate routes: privacy, terms, returns/replacements, about/brand.
- Returns & Replacements policy uses a **7-day return window**.
- COD (cash-on-delivery) is a supported payment method; refund process wording is placeholder and should be verified.
- Contact details in policy pages are placeholders to be replaced with real info.
- Product catalog uses a **cache layer**: admin saves update a cached catalog, but storefront may serve stale data — potential cause of missing-product issue.
- **Admin roles:** two tiers — regular admin and superadmin.
  - Authorization (user-management/approvals) page is restricted to superadmins only.
  - Regular admins: Authorization menu item hidden; direct URL access redirects to Catalog.
  - **Product permissions enforced server-side AND in admin UI:**
    - Regular admins: can toggle stock status only.
    - Superadmins: can add, edit, delete, change prices, toggle visibility, and change sale mode.
    - Server rejects unauthorized product mutations from regular admins (add, edit, delete, price, visibility, sale-mode changes).
  - Rationale: protect product data integrity; regular admins manage availability, superadmins own catalog structure and pricing.
- Test suite includes coverage for regular-admin allowed stock updates and blocked deletions/edits.
- Site builds successfully; all tests pass.

## Open questions & assumptions

- **Missing product bug unresolved:** new product appears in admin list but not on public products page. Possible causes: (a) product "Active" toggle not checked, (b) stale cache served to storefront.
- Assumption: switching storefront to read live data (bypass cache) is a viable fix if cache staleness is confirmed.
- Need user confirmation on actual refund process for COD orders.
- Need real contact details for legal pages.
- Role assignment mechanism (how a user becomes superadmin vs regular admin) not yet confirmed.