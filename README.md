# HabeshaBiz (Ethiopian Small Business Management SaaS)

Multi-tenant digital operating system tailored for Ethiopian retail, wholesale, and electronics trading businesses.

## Overview

HabeshaBiz bridges the gap between fragmented manual tools (Excel, paper notebooks, Telegram messages, separate bank apps) and modern enterprise operations. It provides a single source of truth for:
- **Inventory Lifecycle**: Quantity-based and serialized items (IMEI, battery health, cycle count, cosmetic condition, storage, dual/eSIM).
- **Sales & Brokered Sourcing**: Direct stock sales, flexible salesperson pricing, and instant neighbour-shop brokered sourcing with automated payables.
- **Unified Money Flow**: Multi-bank account tracking (CBE, BOA, Awash, Zemen, TeleBirr, Cash), transfers without artificial income/expense, and asset tracking (USD, USDT, Gold).
- **Debt & Credit Ledger**: Audit-trailed receivables and payables replacing scratchpad arithmetic formulas.
- **Strict Multi-Tenancy**: Isolated business workspaces on a shared high-performance PostgreSQL foundation.

## Technology Stack

- **Backend**: Laravel 11/12 (PHP 8.3+) REST API, PostgreSQL 17, Redis (queues & caching), Pest testing suite, Laravel Pint, Larastan.
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, TanStack Query, Lucide Icons, responsive mobile/tablet counter design.
- **Integrations Ready**: Telegram Bot notifications, n8n webhook pipelines, NativePHP cross-platform mobile client.

## Repository Structure

```text
finance/
├── backend/                  # Laravel API (business logic, tenant scoping, domain rules)
├── frontend/                 # React + TypeScript web application (counter & mobile)
├── .github/
│   └── workflows/
│       └── ci.yml            # CI Pipeline (linting, types, tests, security audits)
├── Universal Software Project Instructions — Master Version.md
└── README.md
```

## Branching Strategy

- `main`: Protected production release branch.
- `develop`: Default primary development & integration branch.
- `feature/*`: Specific feature branches merged via PR into `develop`.
- `fix/*`: Bug fixes merged into `develop`.
- `hotfix/*`: Critical production hotfixes.
