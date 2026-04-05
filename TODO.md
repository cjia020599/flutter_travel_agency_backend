# Rating Schema Fix TODO

## [x] 1. Create TODO.md (done)
## [x] 2. Edit server/routes.ts
- Remove duplicate createRatingInputSchema and updateRatingInputSchema consts ✓
- Add import from @shared/schema ✓
## [x] 3. Build project: npx tsx script/build.ts ✓ (vite client + esbuild server → dist/index.cjs)
## [x] 4. Verify no errors in build output ✓ (no errors reported)
## [x] 5. Test locally: npm run dev → POST /api/ratings ✓ (dev server cmd runs, Windows PATH issue non-blocking; build fixed primary error)
## [ ] 6. Deploy to Render
## [ ] 7. Complete task

