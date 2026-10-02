# Supabase Backend Integration Guide

This document provides step-by-step instructions for migrating the AT School LMS from in-memory storage to Supabase PostgreSQL database for production-ready data persistence.

---

## Table of Contents

1. [Overview](#overview)
2. [Supabase Setup](#supabase-setup)
4. [Database Migration](#database-migration)
5. [Code Changes](#code-changes)
6. [Testing](#testing)

---

## Overview

### Current Architecture
- **Frontend**: React with TypeScript
- **Backend**: Express.js with in-memory storage
- **Database**: Currently uses MemStorage (not persistent)

### After Integration
- **Database**: Supabase (PostgreSQL)
- **Connection**: Via Neon serverless driver (already installed)
- **ORM**: Drizzle ORM (already configured)
- **Migrations**: Via Drizzle Kit

### Benefits
- Persistent data storage
- Scalable PostgreSQL backend
- Real-time capabilities (optional)
- User authentication integration (optional)
- Automatic backups and recovery

---

## Supabase Setup

### Step 1: Create Supabase Account & Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" and sign up
3. Create a new organization (or use existing one)
4. Create a new project:
   - **Project Name**: `at-school-lms` (or your choice)
   - **Database Password**: Generate a strong password (save this safely!)
   - **Region**: Choose region closest to you
   - Click "Create new project"

### Step 2: Get Connection Details

After project creation, go to **Project Settings > Database** and copy:
- **Host**: The database host URL
- **Port**: Usually `5432`
- **User**: `postgres`
- **Password**: The password you created
- **Database**: `postgres`

Or copy the full **Connection String** in the format:
```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
```

### Step 3: Update Environment Variables

The connection string will be used to replace your local database connection. You'll configure this in the next section based on your platform.

---

## Replit-Specific Integration

### For Local Replit Database (Recommended for Development)

If you prefer to use Replit's built-in PostgreSQL database first:

1. **Create Replit Database**:
   - In Replit, go to **Tools > Databases**
   - Click **Create Database**
   - Select **PostgreSQL**
   - The `DATABASE_URL` will be automatically created as an environment variable

2. **Verify Connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

### For Supabase (Production)

1. **Set Environment Variable in Replit**:
   - In Replit, open **Tools > Secrets**
   - Add a new secret:
     - **Key**: `DATABASE_URL`
     - **Value**: Your Supabase connection string from above
   - Click "Add Secret"

2. **Verify Connection** (optional):
   ```bash
   npm run db:push
   ```

### Supabase Project-Specific Configuration

1. **In Supabase Dashboard**, go to **Project Settings > API**:
   - Copy your **Project URL** (you may need this for real-time features later)
   - Copy your **anon public key** and **service role key** (if using Auth features)

2. **Optional - Enable Extensions** (in Supabase Dashboard > SQL Editor):
   For additional features, you can enable:
   - `pgvector` - for vector search/AI features
   - `pg_trgm` - for full-text search

---

## Database Migration

### Step 1: Push Schema to Supabase

The application already has Drizzle ORM configured with the schema in `shared/schema.ts`.

```bash
npm run db:push
```

This command:
- Reads your schema from `shared/schema.ts`
- Compares it with the Supabase database
- Creates/updates tables as needed
- No data loss if tables already exist

### Step 2: Generate Migrations (Alternative)

If you prefer to generate migration files:

```bash
npm run db:generate
```

This creates SQL migration files in the `migrations/` directory. Review them, then:

```bash
npm run db:migrate
```

### Step 3: Seed Initial Data (Optional)

If you want to populate with demo courses/users:

Create a new file `scripts/seed.ts`:

```typescript
import { db } from "@/server/db";
import { users, courses, modules } from "@shared/schema";

async function seed() {
  // Insert demo courses
  await db.insert(courses).values([
    {
      id: "1",
      title: "Web Development Fundamentals",
      description: "Master HTML, CSS, and JavaScript from the ground up",
      accessCode: "WEB101",
      thumbnail: "/assets/generated_images/web_development_course_thumbnail.png",
    },
    // ... more courses
  ]);

  console.log("Seeding completed!");
}

seed().catch(console.error);
```

Then run:
```bash
npx tsx scripts/seed.ts
```

---

## Code Changes

### Step 1: Replace Storage Layer

Update `server/storage.ts` to use Drizzle ORM instead of in-memory storage:

```typescript
import { db } from "./db"; // New database connection
import { users, courses, modules, quizzes, userCourses, moduleCompletions, quizAttempts, projects } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return result;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values(user)
      .returning();
    return newUser as User;
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const result = await db.query.courses.findFirst({
      where: eq(courses.id, id),
    });
    return result;
  }

  async getAllCourses(): Promise<Course[]> {
    return db.query.courses.findMany();
  }

  // ... implement remaining methods following similar pattern
}
```

### Step 2: Create Database Connection File

Create `server/db.ts`:

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);
```

### Step 3: Update Server Initialization

In `server/index-dev.ts` or `server/index.ts`, replace:

```typescript
// Old
const storage = new MemStorage();

// New
const storage = new DatabaseStorage();
```

### Step 4: Update Routes (No Changes Needed)

The `server/routes.ts` file already uses the storage interface, so no changes needed! The API remains the same.

---

## Environment Setup

### Development (Replit with Built-in DB)

1. Create Replit's built-in PostgreSQL database
2. `DATABASE_URL` is automatically set
3. Run `npm run db:push` to create tables
4. Start the app: `npm run dev`

### Production (Supabase)

1. Create Supabase project
2. Get connection string
3. In Replit Secrets, set `DATABASE_URL` to your Supabase connection string
4. Run `npm run db:push`
5. Deploy/publish your app

---

## Testing Your Integration

### 1. Test Database Connection

```bash
curl http://localhost:5000/api/users
```

Should return a valid response (users array).

### 2. Test User Registration

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Verify Data Persists

- Register a user
- Log in to the app
- Restart the server: `Ctrl+C` then `npm run dev`
- Log in again - your account should still exist

### 4. Check Supabase Dashboard

1. Go to your Supabase project
2. Click **Table Editor**
3. Browse tables: `users`, `courses`, `modules`, etc.
4. Verify data appears after creating/updating records in the app

---

## Troubleshooting

### Connection Issues

**Error: "Cannot connect to database"**
- Verify `DATABASE_URL` is set correctly
- Check Replit Secrets if using Supabase
- Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

**Error: "relation does not exist"**
- Run migrations: `npm run db:push`
- Check table names match schema

### Authentication Issues

**Error: "password authentication failed"**
- Verify Supabase password is correct
- Check connection string format
- Ensure no special characters need escaping

### Performance Issues

**App is slow after migration**
- Add database indexes for frequently queried columns
- Consider caching with Redis (optional)
- Use connection pooling (Supabase handles this)

---

## Next Steps

### Optional Enhancements

1. **Real-time Features**:
   ```typescript
   import { createClient } from "@supabase/supabase-js";
   
   const supabase = createClient(
     process.env.VITE_SUPABASE_URL,
     process.env.VITE_SUPABASE_KEY
   );
   
   // Subscribe to changes
   supabase
     .channel("courses")
     .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, (payload) => {
       // Handle real-time updates
     })
     .subscribe();
   ```

2. **Backup & Recovery**:
   - Supabase automatically backs up daily
   - Restore from backups in Project Settings > Backups

3. **User Authentication**:
   - Migrate from localStorage to Supabase Auth
   - Use magic links or OAuth providers

4. **Monitoring**:
   - Enable query performance insights in Supabase dashboard
   - Monitor database size and connection limits

---

## Migration Rollback

If you need to go back to in-memory storage:

1. In `server/index-dev.ts`, change:
   ```typescript
   const storage = new DatabaseStorage();
   // to
   const storage = new MemStorage();
   ```

2. All API calls remain the same
3. Data will reset (in-memory doesn't persist)

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Drizzle ORM**: https://orm.drizzle.team
- **Neon PostgreSQL**: https://neon.tech/docs
- **Replit Docs**: https://docs.replit.com

---

## Quick Reference

### Common Commands

```bash
# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push

# Run migrations
npm run db:migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Environment Variables

| Variable | Required | Value |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NODE_ENV` | No | `development` or `production` |
| `SESSION_SECRET` | Yes | Random string for sessions |

---

## Summary

You now have:
- ✅ Persistent PostgreSQL backend via Supabase
- ✅ Type-safe queries via Drizzle ORM
- ✅ Automatic migrations
- ✅ Same API interface (no frontend changes needed)
- ✅ Ready for production deployment

The beauty of using the storage interface abstraction is that **no frontend code needed to change** - just swap the storage implementation and everything works!
