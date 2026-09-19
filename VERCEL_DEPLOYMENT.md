# Vercel Deployment Guide

## Database Setup for Vercel

This application uses SQLite via Turso (libsql) for the database layer. Follow these steps to deploy to Vercel:

### Step 1: Create a Turso Database

1. Sign up at https://turso.tech
2. Create a new database (e.g., "skano-menu-prod")
3. Get your database URL and auth token from the Turso dashboard

### Step 2: Configure Vercel Environment Variables

In your Vercel project settings, add these environment variables:

```
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=<your-turso-auth-token>
NODE_ENV=production
JWT_SECRET=<generate-a-secure-random-string>
```

### Step 3: Deploy and Migrate

1. Push code to GitHub (migration files included in `prisma/migrations/`)
2. Vercel will automatically run `npm run build` which includes:
   - `prisma generate` - generates Prisma client
   - `next build` - builds the Next.js app

3. After deployment, run migrations via Turso:
```bash
turso db shell your-database-name < prisma/migrations/20260919020204_init/migration.sql
```

Or use the Vercel Functions API to trigger a migration endpoint.

### Step 4: Seed Database (Optional)

To populate demo data:
```bash
DATABASE_URL="libsql://your-database.turso.io" DATABASE_AUTH_TOKEN="<token>" npm run seed
```

## Database Migration from MySQL

To migrate data from the existing MySQL database:

1. Export data from MySQL:
```bash
mysqldump -u user -p database > backup.sql
```

2. Use the migration script:
```bash
node scripts/migrate-mysql-to-sqlite.js backup.sql
```

3. Verify data in Turso dashboard
4. Deploy to Vercel

## Rollback Plan

If issues occur:
1. Keep the old MySQL database running
2. DNS points to the new deployment
3. Can immediately revert DNS to old Laravel app
4. Database snapshots saved in Turso

## Performance Monitoring

Monitor in Vercel dashboard:
- Build times
- Runtime logs for database errors
- Function execution times

## Testing Checklist

- [ ] Admin login (admin@skano.menu / admin123)
- [ ] Restaurant owner login  
- [ ] Create/edit menu items
- [ ] View restaurant pages
- [ ] QR code scanning
- [ ] Feedback submission
- [ ] Staff management
- [ ] Mobile responsiveness
