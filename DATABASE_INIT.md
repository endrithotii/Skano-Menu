# Database Initialization Guide

## Current Status

The Skano Menu application is deployed to Vercel with a SQLite database via Turso.

**Important**: The database initialization is NOT automatic during the build process anymore. This is intentional - it prevents build failures due to database connectivity issues.

## Prerequisites

1. **Environment Variables in Vercel**
   - `DATABASE_URL`: Your Turso database connection string (e.g., `libsql://xxx.turso.io`)
   - `DATABASE_AUTH_TOKEN`: Your Turso database authentication token

   To verify these are set:
   - Go to Vercel project settings
   - Navigate to Environment Variables
   - Check that both variables are present and have valid values

## How to Initialize the Database

### Option 1: Use the API Endpoint (Recommended)

Once the app is deployed and environment variables are configured:

```bash
curl -X POST https://skano-menu.vercel.app/api/admin/initialize \
  -H "Content-Type: application/json"
```

This will:
1. Check if the database is already initialized
2. Create default users (admin, resto, cafe)
3. Create demo restaurants for the managers
4. Hash passwords securely

### Option 2: Check Environment Variables

To diagnose issues, check if environment variables are properly set:

```bash
curl https://skano-menu.vercel.app/api/admin/diagnostic
```

Expected response:
```json
{
  "DATABASE_URL": "✓ Set",
  "DATABASE_AUTH_TOKEN": "✓ Set",
  "NODE_ENV": "production",
  "VERCEL_ENV": "production",
  "INIT_TOKEN": "✗ Missing"
}
```

### Option 3: Test Database Connection

To verify the database is working:

```bash
curl https://skano-menu.vercel.app/api/admin/test-db
```

Expected response:
```json
{
  "status": "✓ Connected",
  "userCount": 3,
  "restaurantCount": 2
}
```

If this returns an error, it means:
- DATABASE_URL or DATABASE_AUTH_TOKEN is missing/invalid
- The database schema hasn't been initialized yet

## Default Users (After Initialization)

Once initialized, you can login with:

1. **Admin Account**
   - Email: `admin@skano.menu`
   - Password: `admin123`
   - Role: SUPER_ADMIN

2. **Restaurant Owner 1**
   - Email: `resto@skano.menu`
   - Password: `owner123`
   - Name: Arben Krasniqi
   - Restaurant: "Arben's Restaurant"

3. **Restaurant Owner 2**
   - Email: `cafe@skano.menu`
   - Password: `owner123`
   - Name: Blerim Hoxha
   - Restaurant: "Blerim's Cafe"

## Checking if Restaurants Appear

After initialization, check the public discover page:

```bash
curl https://skano-menu.vercel.app/api/restaurants
```

This should return a list of restaurants with:
- "Arben's Restaurant" (slug: arbens-restaurant)
- "Blerim's Cafe" (slug: blems-cafe)

## Troubleshooting

### Error: "no such table: main.User"
- The database schema hasn't been created
- Make sure DATABASE_URL and DATABASE_AUTH_TOKEN are set
- The schema should be automatically created when you POST to /api/admin/initialize

### Error: "The provided database string is invalid"
- DATABASE_URL format is incorrect
- Should be: `libsql://[subdomain].turso.io` with a valid auth token

### Error: "Unauthorized" on initialize endpoint
- Only appears if INIT_TOKEN environment variable is set
- To disable token requirement, don't set INIT_TOKEN in Vercel

## Database Schema

The database includes tables for:
- `User` - System users (admins, managers)
- `Restaurant` - Restaurant profiles
- `MenuCategory` - Menu categories
- `MenuItem` - Individual menu items
- And supporting tables for feedbacks, loyalty cards, etc.

Migrations are stored in `prisma/migrations/`
