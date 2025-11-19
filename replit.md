# Overview
G4 Hub is a multi-tenant e-commerce automation platform designed to streamline post-sale operations by connecting online stores (Shopify, WooCommerce) with ERP systems. Its primary purpose is to automate inventory synchronization, invoice generation, and logistics management. The project aims to provide a robust, scalable solution for businesses seeking to enhance their e-commerce efficiency and reduce manual overhead.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture
The application is a full-stack TypeScript project featuring a React frontend and an Express.js backend with a PostgreSQL database.

## UI/UX Decisions
- **UI Framework**: shadcn/ui components built on Radix UI primitives for consistent and accessible design.
- **Styling**: Tailwind CSS with CSS custom properties for theming and responsive design.

## Technical Implementations
- **Frontend**: React 18 with Vite, TypeScript for type safety, React Query for server state management, Wouter for routing, React Hook Form with Zod for form handling and validation, and context-based authentication.
- **Backend**: RESTful API with Express.js and TypeScript, Passport.js for authentication (local strategy, session-based), Crypto module for password hashing, and Express sessions with PostgreSQL store.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations.

## Feature Specifications
- **Multi-tenancy**: Row-level data isolation using `tenant_id` foreign keys, API data filtering by tenant, subdomain-based tenant identification, and JSON storage for tenant-specific settings.
- **Post-sale Automation**: Includes inventory synchronization, automated invoice generation, and logistics management across various e-commerce platforms.
- **Webhook System**: Robust webhook reception with HMAC signature validation for Shopify events (orders, inventory levels), automatic queuing of inventory movements, and background processing workers with retry logic.
- **SKU-Based Product Lookup**: Implemented across connectors (Shopify, WooCommerce, Contifico) for efficient product identification.
- **Idempotency**: Application-level duplicate detection for inventory movements to prevent double processing.

## System Design Choices
- **Type Safety**: Prioritized throughout with TypeScript and Drizzle ORM.
- **Scalability**: Designed with multi-tenancy and robust background processing for future growth.
- **Modularity**: Clear separation of concerns between frontend, backend, and database layers.
- **Modern API Integration**: Supports modern GraphQL Admin API for Shopify (future-ready implementation).

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL for primary data storage and real-time capabilities.
- **connect-pg-simple**: PostgreSQL-backed session management.

## UI Libraries
- **Radix UI**: Headless UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

## Development Tools
- **Vite**: Build tool for frontend.
- **TypeScript**: Language for type safety.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.

## Authentication & Security
- **Passport.js**: Authentication middleware.
- **bcryptjs**: Password hashing library.
- **Express Session**: Server-side session management.

## Validation & Forms
- **Zod**: Runtime type validation.
- **React Hook Form**: Performant form handling.
- **Hookform Resolvers**: Integration between React Hook Form and Zod.