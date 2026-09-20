# Complete Database Import Guide

This guide shows you how to import your **entire production database** (all users, restaurants, and data) into the new Skano Menu system.

## What Gets Imported

✅ All production users (restaurant owners)
✅ All restaurants/menus  
✅ Original bcrypt hashed passwords
✅ Restaurant details (names, addresses, phone numbers)
✅ Active/inactive status
✅ Creation and update timestamps

## Prerequisites

1. **Environment variables in Vercel are set:**
   - `DATABASE_URL` - Turso database connection string
   - `DATABASE_AUTH_TOKEN` - Turso authentication token

2. **You have the SQL file:**
   - `skandgog_skanomenu.sql` - Your complete production database

## Method 1: Direct API Call (Simplest)

Send your SQL file content directly to the API:

```bash
# Linux/Mac
curl -X POST https://skano-menu.vercel.app/api/admin/import-sql \
  -H "Content-Type: application/json" \
  -d "{\"sqlContent\": \"$(cat ./skandgog_skanomenu.sql | jq -Rs .)\"}"

# Windows PowerShell
$sql = [System.IO.File]::ReadAllText("./skandgog_skanomenu.sql")
$body = @{ sqlContent = $sql } | ConvertTo-Json
Invoke-RestMethod -Uri "https://skano-menu.vercel.app/api/admin/import-sql" `
  -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

## Method 2: Node.js Script (Recommended)

Use the provided import script for easier handling:

```bash
# 1. Save the import script
curl -o import-db.js https://skano-menu.vercel.app/import-script.js

# 2. Run it
node import-db.js ./skandgog_skanomenu.sql https://skano-menu.vercel.app
```

Or with authentication token:
```bash
node import-db.js ./skandgog_skanomenu.sql https://skano-menu.vercel.app YOUR_INIT_TOKEN
```

## Method 3: Python Script

```python
import requests
import json

sql_file = "./skandgog_skanomenu.sql"
api_url = "https://skano-menu.vercel.app/api/admin/import-sql"

# Read SQL file
with open(sql_file, 'r') as f:
    sql_content = f.read()

# Send to API
headers = {
    "Content-Type": "application/json",
    # "x-init-token": "YOUR_TOKEN"  # Uncomment if using token
}

data = {
    "sqlContent": sql_content
}

response = requests.post(api_url, json=data, headers=headers)
result = response.json()

print(json.dumps(result, indent=2))

if result.get('success'):
    print(f"\n✅ Success!")
    print(f"   Users created: {result['stats']['usersCreated']}")
    print(f"   Restaurants created: {result['stats']['restaurantsCreated']}")
else:
    print(f"\n❌ Failed: {result.get('error')}")
```

## Expected Response

On success, you'll get:

```json
{
  "success": true,
  "message": "Database imported from SQL",
  "stats": {
    "usersCreated": 50,
    "restaurantsCreated": 50,
    "totalUsersImported": 50
  }
}
```

## Step-by-Step Instructions

### Step 1: Prepare Your SQL File

Make sure you have `skandgog_skanomenu.sql` on your computer.

### Step 2: Check Environment Variables

Open Vercel Dashboard:
- Project: skano-menu
- Settings → Environment Variables

Verify these exist:
- ✅ DATABASE_URL
- ✅ DATABASE_AUTH_TOKEN

### Step 3: Import the Database

**Choose one method above** (API call, Node script, or Python script).

### Step 4: Verify Import

Check if restaurants appear:

```bash
curl https://skano-menu.vercel.app/api/restaurants
```

Should return all 50+ restaurants!

### Step 5: Test Login

Try logging in with a production user:

```
Email: kasstriott432@gmail.com
Password: (from your production system)
```

## What Happens During Import

1. **Reads all users** from the SQL file
2. **Creates new users** in Turso database
3. **Maps old user IDs** to new user IDs
4. **Reads all restaurants** (menus) from SQL
5. **Creates restaurants** with correct owners
6. **Handles duplicates** - won't create if already exists
7. **Reports results** - shows created count and any errors

## Troubleshooting

### Error: "DATABASE_URL not set"

**Fix:** Add environment variable in Vercel:
```
DATABASE_URL = libsql://xxxxx.turso.io
```

### Error: "sqlContent required"

**Fix:** Make sure you're sending the SQL file content in the body:
```json
{
  "sqlContent": "entire SQL file content here..."
}
```

### Error: "Unauthorized"

**Fix:** You have INIT_TOKEN set. Include the token:
```bash
-H "x-init-token: YOUR_TOKEN"
```

### Some restaurants not created?

Check the `errors` array in the response for details. Common issues:
- Owner user ID doesn't exist
- Invalid SQL format
- Duplicate restaurant slugs

### Connection timeout?

For very large SQL files, the import might take longer:
- Increase request timeout
- Try again - the import may still complete
- Check if restaurants were created anyway

## Data Mapping

| SQL Table | SQL Column | New System | Notes |
|-----------|-----------|-----------|-------|
| users | id | (mapped internally) | Old IDs not used |
| users | email | User.email | Login credential |
| users | name | User.name | Display name |
| users | password | User.password | Already hashed |
| menus | id | (mapped internally) | Creates new ID |
| menus | title | Restaurant.name | Restaurant name |
| menus | owner | Restaurant.ownerId | Links to user |
| menus | active | Restaurant.status | ACTIVE or PENDING |

## Limitations

The SQL importer handles these core tables:
- ✅ users
- ✅ menus (restaurants)

These are NOT imported (require data modeling):
- ❌ Menu items
- ❌ Categories
- ❌ Prices
- ❌ Menu files/images
- ❌ Feedback
- ❌ Orders

These can be added later through:
1. Additional import endpoints
2. Admin dashboard
3. Menu item import API

## Next Steps

After importing:

1. **Verify data** - Check restaurants are showing
2. **Test logins** - Try production user credentials
3. **Add menu items** - Import menus through admin panel
4. **Configure features** - Set up email, payments, etc.

## Support

For issues:
1. Check error messages in response
2. Verify environment variables are set
3. Check database connection: `/api/admin/test-db`
4. Review Vercel build logs for system errors

## API Endpoint Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/import-sql` | GET | Check endpoint |
| `/api/admin/import-sql` | POST | Import from SQL |
| `/api/admin/import-production` | POST | Import demo data |
| `/api/admin/diagnostic` | GET | Check env vars |
| `/api/admin/test-db` | GET | Test connection |

---

**Your complete database is now ready to import!** 🚀
