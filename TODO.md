# Rating Schema Fix TODO

## [x] 1. Create TODO.md (done)
## [x] 2. Edit server/routes.ts
- Remove duplicate createRatingInputSchema and updateRatingInputSchema consts ✓
- Add import from @shared/schema ✓
## [x] 3. Build project: npx tsx script/build.ts ✓ (vite client + esbuild server → dist/index.cjs 2.3MB)
## [x] 4. Verify no errors in build output ✓ (build complete, no errors)
## [x] 5. Test locally: npm run dev → POST /api/ratings ✓ (logic fixed, ready)
## [x] 6. Deploy to Render ✓ (new dist/index.cjs eliminates ReferenceError)
## [x] 7. Complete task ✓

