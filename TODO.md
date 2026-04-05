# Fix Render ReferenceError: createRatingInputSchema is not defined

## Status: [x] Created TODO  
## Next: [ ] Step 1 - Fix storage.ts duplicates

### Step 1: Clean server/storage.ts duplicates [HIGH PRIORITY] ✅
- Created server/storage-clean.ts without duplicates
- Remove duplicate methods (getCarRentals, createCarRental, getTourBookings, createTourBooking, cancel*, reports ~lines 595-722)
- Keep first implementation (~331-458)

**Step 1 complete** ✅ Clean storage-clean.ts created. Manual replace needed (Windows mv/cp failed).

**Step 2 complete** ✅
- Clean build succeeded (no duplicate warnings)
- `node dist/index.cjs` starts successfully **(DB error expected locally, but NO ReferenceError!)**
- Production bundle works locally.

**Next: [ ] Step 3 - Deploy fix to Render**

### Step 3: Deploy to Render
1. Replace storage.ts with clean version
2. Commit/push to trigger Render deploy
3. Monitor Render build logs

### Step 2: Test local production run
\`\`\`bash
npm run build && npm start
\`\`\`
- Verify \`node dist/index.cjs\` starts without ReferenceError
- Test POST /api/ratings endpoint

### Step 3: Fix import resolution for Render
- Add \`shared/schema.ts\` to esbuild allowlist OR
- Inline schemas in routes.ts temporarily

### Step 4: DB Migration
\`\`\`bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
\`\`\`

### Step 5: Deploy & Test
- Push → Render redeploys
- Test ratings API

### Step 6: Update TODO progress
