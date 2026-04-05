# Fix Car/Tour Edit Issue (Backend Persistence)
Status: ✅ Plan Approved - Implementing

## Current Progress
- [x] 1. Created detailed edit plan after full file analysis
- [x] 2. Fix Zod schemas in shared/routes.ts (price → z.coerce.number())
- [x] 3. Improve storage.updateCar/updateTour error handling + logging  
- [x] 4. Add logging to PUT route handlers in server/routes.ts
- [ ] 5. Test full edit flow (Network tab + DB verification + server logs)
- [ ] 6. Clean up logging after verification

**Next**: Run `npm run dev`, edit car/tour, check console + Network tab

## Root Cause
Frontend sends price as string ("45.00"), Zod allows string, Drizzle/DB expects decimal → silent constraint failure → unchanged data returned.

## Test Commands
```bash
# Check DB after edit
psql -d travel_agency -c "SELECT id, title, price FROM cars WHERE id = 1;"
psql -d travel_agency -c "SELECT id, title, price FROM tours WHERE id = 1;"

# Server logs during edit
npm run dev
# Then edit car/tour → watch console for "PUT input:" / "Update result:"
```

## Success Criteria
✅ Network PUT request succeeds (200)
✅ Response contains NEW price/title values  
✅ DB row reflects changes
✅ Frontend shows updated list/profile
✅ No Zod validation errors

