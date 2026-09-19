# Vercel Deployment Setup Checklist

## Pre-Deployment (Do This First)

### 1. Create Turso Database
```bash
# Visit https://turso.tech and create account
# Create new database named: skano-menu-prod
# Copy these values from Turso dashboard:
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=<your-token-here>
```

### 2. Generate JWT Secret
```bash
# Generate a secure random string for JWT_SECRET
openssl rand -base64 32
# Output example: abc123def456...
JWT_SECRET=<paste-the-output-here>
```

## Vercel Configuration

### Step 1: Connect GitHub Repository
1. Go to https://vercel.com/new
2. Import `endrithotii/skano-menu` repository
3. Framework: **Next.js** (auto-detected)
4. Project name: `skano-menu` (or similar)

### Step 2: Environment Variables
In Vercel Project Settings → Environment Variables, add:

```
DATABASE_URL                = libsql://your-database.turso.io
DATABASE_AUTH_TOKEN         = <your-turso-auth-token>
NODE_ENV                    = production
JWT_SECRET                  = <your-generated-jwt-secret>
```

**Important:** These must be added BEFORE deployment, or first deploy will fail.

### Step 3: Deploy
- Click "Deploy" button
- Wait for build to complete (should take ~3 minutes)
- Check deployment logs for any errors

## Post-Deployment

### Step 1: Run Database Migrations
After successful deployment, migrations automatically run via Prisma (included in build step).

### Step 2: Verify Deployment
Click the deployment URL and test:
- [ ] Homepage loads without errors
- [ ] `/register` page accessible
- [ ] `/login` page accessible
- [ ] Admin panel route `/dashboard` accessible

### Step 3: Seed Demo Data (Optional)
To populate demo data in production:

```bash
# From your local machine, with DATABASE_URL set to Turso:
npm run seed
```

## Troubleshooting

### Build Fails: "Cannot find DATABASE_URL"
- ✓ Ensure DATABASE_URL is set in Vercel Environment Variables
- ✓ Redeploy after setting variables

### Build Fails: "libsql not found"
- ✓ Dependencies weren't installed properly
- ✓ Check node_modules has @libsql/client and @prisma/adapter-libsql
- ✓ Redeploy with `npm ci` clean install

### Database Connection Fails
- ✓ Check DATABASE_URL format: `libsql://name.turso.io`
- ✓ Verify DATABASE_AUTH_TOKEN is correct in Turso dashboard
- ✓ Check Turso database is active (not paused)

### Seed Command Not Found
- ✓ `npm run seed` is defined in package.json scripts
- ✓ Run from project root directory
- ✓ Ensure NODE_ENV is not production (seed uses test data)

## Rollback Plan

If issues occur:
1. **Keep old production server running** - DNS still points to Laravel app
2. **Vercel is just staging** - Users aren't using it yet
3. **To revert:** Just don't update DNS; keep pointing to old domain

## Domain Migration (Later)

When ready to go live:
1. Verify all features work on Vercel deployment
2. Update DNS to point to Vercel
3. Keep old server as backup for 24 hours
4. Monitor Vercel logs for errors

## Performance Monitoring

After deployment:
- Check Vercel Dashboard → Deployments → Logs
- Monitor: Database query times, function execution
- Check error logs for any runtime issues
- Verify QR codes generate correctly
- Test staff authentication

## Success Indicators

✓ Build completes without errors
✓ All pages load (no 500 errors)
✓ Database queries respond < 500ms
✓ Can create test users and restaurants
✓ QR codes generate and scan correctly
✓ Mobile responsive layouts work
