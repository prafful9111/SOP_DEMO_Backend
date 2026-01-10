# FIXING THE "0 ROWS RETURNED" ISSUE

## Problem
Your Supabase table has **Row Level Security (RLS)** enabled but no policies, which blocks ALL reads.

## Solution: Disable RLS or Add a Policy

### Option 1: Disable RLS (Quick Fix for Development)

1. Go to your Supabase dashboard
2. Navigate to **Database** → **Tables** → `transcription_analysis`
3. Click on the table settings
4. **Disable RLS** (toggle it off)
5. Restart your backend server

### Option 2: Add a Read Policy (Better for Production)

1. In Supabase, go to **Authentication** → **Policies**
2. Select your `transcription_analysis` table
3. Click **"New Policy"**
4. Choose **"Enable read access for all users"** or create a custom policy:
   ```sql
   -- Allow anonymous reads
   CREATE POLICY "Allow anonymous select" ON transcription_analysis
   FOR SELECT
   TO anon
   USING (true);
   ```
5. Save and restart your backend server

## After Fixing

Restart your backend:
```bash
# Stop the server (Ctrl+C)
npm start
```

Then test:
```bash
# Test listing all records
curl http://localhost:3000/api/test/list-all

# Test getting specific record
curl http://localhost:3000/api/sop/6b3bbd3a-edce-4034-b14a-b8afa4c59f62
```

## Why This Happened

Supabase enables RLS by default for security. Without policies:
- ✅ Your Supabase key is valid
- ✅ The table exists
- ❌ RLS blocks all reads = "0 rows returned"
