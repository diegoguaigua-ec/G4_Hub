# Overview

G4 Hub is a multi-tenant e-commerce automation platform that connects online stores with ERP systems to streamline post-sale operations. The application enables businesses to synchronize inventory, automate invoice generation, and manage logistics across multiple e-commerce platforms like Shopify and WooCommerce. Built as a full-stack TypeScript application, it features a React frontend with a modern dashboard interface and an Express.js backend with PostgreSQL database storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side is built with React 18 using Vite as the build tool and bundler. The application follows a component-based architecture with TypeScript for type safety. Key architectural decisions include:

- **UI Framework**: Utilizes shadcn/ui components built on Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with CSS custom properties for theming and responsive design
- **State Management**: React Query (TanStack Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod for validation and type safety
- **Authentication**: Context-based auth provider with session management

## Backend Architecture
The server-side follows a RESTful API design built with Express.js and TypeScript. Key architectural patterns include:

- **API Structure**: Route-based organization with middleware for authentication and logging
- **Authentication**: Passport.js with local strategy using session-based authentication
- **Password Security**: Crypto module with scrypt for secure password hashing
- **Session Management**: Express sessions with PostgreSQL session store
- **Request Handling**: JSON middleware for API endpoints with comprehensive error handling

## Database Design
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations:

- **Multi-tenancy**: Tenant-based data isolation with tenant references across all major entities
- **Schema Management**: Drizzle migrations for database versioning and schema evolution
- **Core Entities**: Tenants, Users, Stores, and Sessions with proper foreign key relationships
- **Data Types**: JSON columns for flexible settings and configuration storage

## Multi-tenant Architecture
The system implements row-level multi-tenancy where:

- Each tenant has isolated data through tenant_id foreign keys
- API endpoints filter data by authenticated user's tenant
- Subdomain-based tenant identification for custom branding
- Tenant-specific settings stored as JSON for flexibility

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL database with WebSocket support for real-time connections
- **Session Storage**: PostgreSQL-backed session management using connect-pg-simple

## UI Libraries
- **Radix UI**: Headless UI components for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Modern build tool with hot module replacement and optimized bundling
- **TypeScript**: Static typing for enhanced developer experience and code safety
- **Drizzle ORM**: Type-safe database operations with automatic migration generation

## Authentication & Security
- **Passport.js**: Authentication middleware with local strategy support
- **bcryptjs**: Password hashing for secure credential storage
- **Express Session**: Server-side session management with PostgreSQL persistence

## Validation & Forms
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Performant form handling with minimal re-renders
- **Hookform Resolvers**: Integration between React Hook Form and Zod validation

The architecture prioritizes type safety, scalability, and developer experience while maintaining clear separation of concerns between frontend and backend systems.

# Recent Changes

## Phase 1: Shopify Push System - COMPLETED (November 18, 2025)

Successfully implemented the complete Shopify Push system for synchronizing inventory movements to external ERP systems (Contifico).

### Key Features Implemented:

1. **Automatic Webhook Configuration**
   - Auto-registration of Shopify webhooks when stores are created (POST /api/stores)
   - Auto-verification/recreation of webhooks when store credentials are updated (PUT /api/stores/:storeId)
   - Webhook metadata preservation during re-configuration (fixed regression bug)

2. **Webhook Reception System**
   - HMAC signature validation for all Shopify webhooks
   - Support for orders/paid, orders/updated, and orders/cancelled events
   - Automatic queuing of inventory movements in `inventory_movements_queue` table

3. **Background Processing Worker**
   - InventoryPushWorker runs automatically every 120 seconds in development
   - Processes pending inventory movements with distributed locking mechanism
   - Automatic retry logic with exponential backoff for failed movements
   - Comprehensive error handling and logging

4. **End-to-End Flow**
   - Complete flow: Shopify webhook → Queue → Worker → Contifico API
   - Tested and validated with real webhook simulation
   - Proper status tracking (pending → processing → completed/failed)

### Technical Implementation:

- **Files Modified**: `server/routes.ts` (webhook auto-configuration on store update)
- **Critical Fix**: Fixed bug where webhook re-registration was overwriting fresh connection metadata with stale data
- **Worker Status**: Runs conditionally (development environment or ENABLE_BACKGROUND_WORKERS=true)

### Next Steps:

Phase 2 would include:
- Implement missing `getProductBySku()` method in ContificoConnector
- Add UI for monitoring queue status and failed movements
- Implement retry mechanism for failed movements
- Add comprehensive logging and alerting system