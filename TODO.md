# Fix createRatingInputSchema ReferenceError in Production

Status: ✅ Approved by user

## Information Gathered:
- shared/schema.ts: Schemas defined/exported correctly
- server/routes.ts: Imports "@shared/schema" correctly  
- tsconfig.json: Path alias "@shared/*" → "./shared/*"
- script/build.ts: Esbuild missing alias config → resolution failure in bundle
- Render deploys fail at runtime due to undefined createRatingInputSchema

## [x] Step 1: Edit script/build.ts  
Add esbuild alias config matching tsconfig paths

## [ ] Step 2: Rebuild  
npm run build → Verify dist/index.cjs generated

## [ ] Step 3: Test local production server  
set NODE_ENV=production && node dist/index.cjs  
→ Expect "serving on port 5000" without ReferenceError

## [ ] Step 4: Deploy & Verify  
Push changes → Render deploy succeeds
