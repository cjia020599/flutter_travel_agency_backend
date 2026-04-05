# Ratings CRUD Implementation
Status: New Task

## Plan Steps
1. [x] Add storage methods (server/storage.ts): getRatings, createRating, updateRating, deleteRating
2. [x] Add API routes (shared/routes.ts)
3. [x] Implement server/routes.ts handlers (create/update/delete + existing check)
4. [x] Create client/src/hooks/use-ratings.ts
5. [ ] Create client/src/pages/ratings/RatingsList.tsx + RatingForm.tsx 
6. [ ] Add ratings display to car/tour detail pages
7. [ ] Test full flow

**Next**: Ratings admin pages

## Schema Ready
- ratings table exists (userId, moduleType/car|tour, moduleId, stars 1-5, comment)
- Zod schemas ready (createRatingInputSchema, updateRatingInputSchema)

**Start**: Storage methods first

