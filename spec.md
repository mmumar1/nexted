# AT School LMS - Learning Management System

## Overview

AT School (Amplify Tutorial School) is a modern Learning Management System designed to deliver educational content through a structured course-based learning approach. The platform provides students with access to courses, interactive modules, quizzes, and project submissions, emphasizing learning-focused minimalism and progression visibility.

The application is built as a full-stack web application with a React frontend and Express backend, utilizing PostgreSQL for data persistence and implementing a component-based UI architecture using shadcn/ui components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server, providing fast HMR (Hot Module Replacement)
- Wouter for client-side routing (lightweight React Router alternative)
- React Query (TanStack Query) for server state management and data fetching

**UI Component System**
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Design system follows hybrid approach: educational platform best practices + Notion-inspired organization + Material Design components
- Custom CSS variables for theming (light mode configured, dark mode support available)
- Component structure uses "New York" style variant from shadcn

**State Management**
- React Context API for authentication state (`AuthProvider`)
- localStorage for client-side session persistence
- React Query for server state caching and synchronization
- Form state managed by react-hook-form with Zod schema validation

**Key Pages & Features**
- Authentication: Login and registration with form validation
- Dashboard: Course overview with progress tracking and access code-based course unlocking
- Course View: Module-based content delivery with completion tracking
- Quiz Interface: Interactive assessments with immediate feedback
- Projects: Student project submission and management

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for type-safe API development
- Two-mode operation: development (with Vite middleware) and production (serving static build)
- RESTful API design pattern for all endpoints

**Database Layer**
- PostgreSQL as the primary database
- Drizzle ORM for type-safe database queries and schema management
- Neon Serverless driver for PostgreSQL connections
- Schema-first approach with automatic TypeScript type generation

**Data Model**
- Users: Authentication and profile management
- Courses: Content organization with access code protection
- Modules: Sequential learning units within courses
- User Courses: Many-to-many relationship tracking unlocked courses
- Module Completions: Progress tracking for individual modules
- Quizzes: Assessment system with JSON-based questions
- Quiz Attempts: Student quiz submissions and scoring
- Projects: Student work submissions with status tracking

**API Architecture**
- Centralized route registration in `server/routes.ts`
- Storage abstraction layer (`server/storage.ts`) separating business logic from data access
- In-memory storage implementation (easily swappable for database persistence)
- Zod schemas shared between client and server for validation consistency

**Authentication & Security**
- Basic authentication using email/password (no external auth providers)
- Session persistence via localStorage (client-side)
- Password stored in plain text (NOTE: Production implementation should use bcrypt or similar)
- API endpoints protected by user ID validation

### External Dependencies

**UI & Component Libraries**
- @radix-ui/* family: Accessible UI primitives (accordion, dialog, dropdown, popover, etc.)
- class-variance-authority: Type-safe variant management for components
- clsx & tailwind-merge: Utility for conditional className composition
- cmdk: Command palette component
- embla-carousel-react: Carousel/slider functionality
- lucide-react: Icon library

**Data & Forms**
- @tanstack/react-query: Server state management
- react-hook-form: Form state and validation
- @hookform/resolvers: Zod integration for form validation
- zod: Schema validation and type inference
- drizzle-zod: Zod schema generation from Drizzle schemas

**Database & Backend**
- @neondatabase/serverless: PostgreSQL driver optimized for serverless
- drizzle-orm: TypeScript ORM for PostgreSQL
- drizzle-kit: CLI tools for migrations and schema management
- connect-pg-simple: PostgreSQL session store (installed but not actively used)

**Utilities**
- date-fns: Date manipulation and formatting
- nanoid: Unique ID generation
- wouter: Lightweight routing library

**Development Tools**
- @replit/vite-plugin-*: Replit-specific development enhancements
- vite: Build tool and dev server
- typescript: Type checking and compilation
- tsx: TypeScript execution for development

**Database Configuration**
- Connection managed via DATABASE_URL environment variable
- Migrations stored in `./migrations` directory
- Schema defined in `shared/schema.ts` for frontend-backend sharing
- Drizzle configured for PostgreSQL dialect

**Asset Management**
- Static assets served from `attached_assets` directory
- Vite alias configuration for `@assets` imports
- Generated images for dashboard hero sections
