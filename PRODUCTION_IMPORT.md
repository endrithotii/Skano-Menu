# Production Data Import Guide

## Overview

The application now includes a complete production data import endpoint that brings in all users and restaurants from your legacy database.

**Data Included:**
- ✅ 50+ restaurant owners (MANAGER role)
- ✅ 50+ restaurants with full details
- ✅ Original bcrypt hashed passwords
- ✅ Email addresses, phone numbers, addresses

## Prerequisites

Before importing, make sure:
1. **Environment variables are set** in Vercel:
   - `DATABASE_URL` - Turso database connection string
   - `DATABASE_AUTH_TOKEN` - Turso authentication token

2. **Database is empty** (or you want to merge):
   - The endpoint checks for existing records
   - It will NOT overwrite existing data
   - You can safely call it multiple times

## Import Methods

### Option 1: Direct API Call (Recommended)

Import all production data with one API call:

```bash
curl -X POST https://skano-menu.vercel.app/api/admin/import-production
```

Expected response (on success):
```json
{
  "success": true,
  "message": "Production data imported",
  "usersCreated": 50,
  "restaurantsCreated": 50,
  "totalProduction": {
    "users": 50,
    "restaurants": 50
  }
}
```

### Option 2: With Authentication Token

If you've set `INIT_TOKEN` environment variable in Vercel:

```bash
curl -X POST https://skano-menu.vercel.app/api/admin/import-production \
  -H "x-init-token: YOUR_TOKEN_HERE"
```

### Option 3: Check Import Status

Before importing, check the endpoint:

```bash
curl https://skano-menu.vercel.app/api/admin/import-production
```

Response shows available data:
```json
{
  "message": "POST to import production data",
  "totalUsers": 50,
  "totalRestaurants": 50
}
```

## What Gets Imported

### Users
All restaurant owners from production are imported as MANAGER role:
- Email addresses (login credentials)
- Names
- Original bcrypt hashed passwords
- Business names

Example users after import:
- `kasstriott432@gmail.com` - Kastriot Ademi (Thronebar)
- `nderi_99@hotmail.com` - Bedri (Restorant Aroma)
- `hotelgardenrks@gmail.com` - Burbuqe Bajraktari (Hotel Garden)
- And 47 more...

### Restaurants
Each restaurant is linked to its owner with:
- Restaurant name
- Owner/manager
- Address
- Phone number
- Status: ACTIVE
- Slug (URL-friendly name)

## After Import

### Verify Import Success

Check if restaurants appear:

```bash
curl https://skano-menu.vercel.app/api/restaurants
```

Should return all imported restaurants.

### Test Login

Login with any production user:

```
Email: hotelgardenrks@gmail.com
Password: (use their password from production notes)
```

Or use a known password from the legacy system.

## Troubleshooting

### Error: "DATABASE_URL not set"
- Go to Vercel Project Settings
- Add environment variable: `DATABASE_URL`
- Set to your Turso database URL: `libsql://xxxx.turso.io`

### Error: "Unauthorized"
- Only appears if `INIT_TOKEN` is configured
- Pass correct token in header: `x-init-token: YOUR_TOKEN`

### Some users imported but restaurants missing
- User IDs might not match between systems
- Check response for error details
- Restaurants require valid owner user ID
- Review errors array in response

### Duplicate email error
- Database already has a user with that email
- Call endpoint again - it skips duplicates
- Or manually delete duplicates and retry

## Data Mapping

The import maps legacy data to new schema:

| Legacy Field | New Field | Notes |
|---|---|---|
| users.id | User ID mapping | Internal, not exposed |
| users.email | User.email | Login credential |
| users.name | User.name | Display name |
| users.password | User.password | Already hashed (bcrypt) |
| menus.owner | Restaurant.ownerId | Maps user |
| menus.title | Restaurant.name | Restaurant name |
| menus.id | (not used) | Created new IDs |

## Imported Restaurants List

All 50+ restaurants from production:
1. Thronebar (Kastriot Ademi)
2. Restorant Aroma (Bedri)
3. Bar 10der (Kujtim Selmanaj)
4. IN COFFEE & BAR (Donjet Ramadani)
5. Shpija e Vjeter (Flamur)
6. Serai (Sadat Ibrahimi)
7. La Strada (Fidan)
8. Creme de la Creme (Valon Majanci)
9. Lion (Safet Voca)
10. Lips Caffe Ulpiane (Arben)
... and 40+ more

## Imported Users Email Sample

```
kasstriott432@gmail.com
nderi_99@hotmail.com
bar10der2020@gmail.com
incoffeebar2013@gmail.com
shpija.e.vjeter@hotmail.com
sadat-ibrahimi@live.com
fidan0104@hotmail.com
fatlum.rafuna@gmail.com
azemhasani@hotmail.com
arben.zejn@gmail.com
... and 40+ more
```

## What's NOT Imported

These features require menu items and are handled separately:
- Menu items
- Categories
- Prices
- Descriptions
- Menu files/images
- Feedback
- Orders

These can be added through:
1. Manual entry in the admin dashboard
2. Future bulk import endpoints
3. Admin API endpoints (when created)

## Support

If import fails:
1. Check environment variables are set
2. Verify database connection with `/api/admin/test-db`
3. Check Vercel build logs for errors
4. Review error details in import response

For detailed error information, the endpoint returns an `errors` array with specific issues encountered during import.
