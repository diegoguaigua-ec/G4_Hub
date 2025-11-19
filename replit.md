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

## Phase 2: Enhanced Push System - COMPLETED (November 19, 2025)

Successfully enhanced the Push system with comprehensive order event handling, SKU-based product lookups, and idempotency safeguards.

### Key Features Implemented:

1. **Expanded Webhook Coverage**
   - Added `orders/create` webhook topic to capture all order events, not just paid orders
   - System now supports both `orders/create` and `orders/paid` to accommodate different Shopify store configurations
   - Idempotency logic prevents duplicate inventory movements when orders transition through multiple states

2. **SKU-Based Product Lookup (All Connectors)**
   - **ShopifyConnector.getProductBySku()**: Uses GraphQL Admin API with `productVariants(query: "sku:...")` for efficient SKU lookups without manual pagination
   - **WooCommerceConnector.getProductBySku()**: Uses REST API query parameter `?sku=` to filter products
   - **ContificoConnector.getProductBySku()**: Simple wrapper since Contifico accepts SKU as product identifier
   - All implementations properly handle "SKU not found" errors

3. **Idempotency Protection**
   - Application-level duplicate detection in `queueMovementsFromWebhook()`
   - Checks for existing movements with same orderId+SKU+movementType before enqueueing
   - Prevents double stock decrements when same order is processed multiple times
   - Comprehensive logging when duplicates are detected

4. **Monitoring & Retry UI (Already Existed)**
   - UI components for monitoring inventory movement queue already implemented
   - Endpoints for statistics and manual retry already functional
   - MovementsTab component displays queue status and allows retry of failed movements

### Technical Implementation:

- **Files Modified**: 
  - `server/connectors/ShopifyConnector.ts`: GraphQL-based getProductBySku()
  - `server/connectors/WooCommerceConnector.ts`: REST-based getProductBySku()
  - `server/connectors/ContificoConnector.ts`: SKU-wrapper getProductBySku()
  - `server/connectors/BaseConnector.ts`: Abstract method definition
  - `server/services/inventoryPushService.ts`: Idempotency logic and orders/create support
  - `server/routes/webhooks.ts`: Added orders/create to supported events

### Known Improvements for Future:

**Database-Level Idempotency (Optional Enhancement)**
- Current implementation has application-level duplicate detection
- For high-concurrency scenarios, consider adding unique index on `(orderId, sku, movementType)` in the database schema
- This would prevent race conditions where concurrent webhook deliveries might both pass the duplicate check
- Recommendation: `CREATE UNIQUE INDEX idx_movement_idempotency ON inventory_movements_queue (order_id, sku, movement_type) WHERE status != 'failed';`

### Production Notes:

- Background workers (InventoryPushWorker) disabled by default in Autoscale deployments
- To enable continuous processing on Reserved VM: set `ENABLE_BACKGROUND_WORKERS=true`
- GraphQL implementation in Shopify connector is more efficient than deprecated REST pagination

## Phase 3: Webhook Infrastructure Improvements - COMPLETED (November 19, 2025)

Successfully upgraded webhook registration system to support production deployments and added modern GraphQL API support.

### Key Features Implemented:

1. **Fixed Production Webhook URL Generation**
   - Created `getPublicUrl()` helper function that correctly handles all environments
   - Priority: `PUBLIC_URL` env var → `REPLIT_DOMAINS` (production) → request host (development)
   - Fixed bug where webhooks were using incorrect URL construction with REPL_SLUG/REPL_OWNER (which don't exist in production)
   - Updated 3 webhook registration points: POST /api/stores, PUT /api/stores/:storeId, POST /api/stores/:storeId/configure-webhooks

2. **Expanded Webhook Topics**
   - Added `inventory_levels/update` webhook (critical for inventory sync system)
   - Added `orders/updated` webhook (for comprehensive order state tracking and idempotency)
   - Complete topics now: orders/create, orders/paid, orders/updated, orders/cancelled, refunds/create, inventory_levels/update

3. **GraphQL Admin API Support**
   - Implemented `registerWebhooksGraphQL()` method following Shopify's October 2024 recommendations
   - Uses modern GraphQL mutations instead of legacy REST API
   - Benefits: Better error handling, typed responses, future-proof implementation
   - **Note**: Currently implemented as future-ready alternative; REST API remains the active method
   - GraphQL method available for manual testing or future migration

### OAuth Scopes Required for Shopify Integration:

**Critical**: Shopify webhooks require READ permissions on the resources being monitored. The application needs the following scopes:

- `read_orders` - Required for all order-related webhooks (orders/create, orders/paid, orders/updated, orders/cancelled)
- `read_inventory` - Required for inventory_levels/update webhook
- `read_products` - Required for product synchronization features
- `write_inventory` - Required for inventory sync operations (sending movements to ERP)

**Setup Instructions for Shopify Partners**:
When creating a Shopify app in the Partner Dashboard, ensure these scopes are requested during OAuth flow. Without proper scopes, webhook registration will fail with 403 Forbidden errors.

### Technical Implementation:

- **Files Modified**:
  - `server/routes.ts`: Added getPublicUrl() helper, updated 3 webhook registration callsites
  - `server/connectors/ShopifyConnector.ts`: Updated webhook topics, added registerWebhooksGraphQL() method
  
### Environment Variables:

- **Development**: Uses request host (automatic)
- **Production (Autoscale/Reserved VM)**: Uses `REPLIT_DOMAINS` (automatically set by Replit)
- **Custom Domains**: Set `PUBLIC_URL` env var to override (e.g., `https://yourdomain.com`)

### Testing Notes:

Webhooks should now register successfully in both development and production environments. The system automatically detects the environment and uses the appropriate URL for webhook callbacks.

### Follow-up Improvements (November 19, 2025):

1. **API Version Update**
   - Updated default Shopify API version from `2024-10` to `2025-07`
   - Aligns with current Shopify supported versions and user configurations
   - Ensures webhook registrations use the latest stable API version

2. **URL Construction Fix**
   - Fixed double slash (`//`) issue in webhook registration URLs
   - Modified `apiUrl` getter to clean trailing slashes from `baseUrl` before URL construction
   - Results in cleaner, properly formatted API URLs: `https://domain.com/admin/api/2025-07/webhooks.json`