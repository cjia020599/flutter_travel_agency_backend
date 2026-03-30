# Ratings API Implementation TODO

- [ ] Update `shared/schema.ts`
  - [ ] Add `ratings` table
  - [ ] Add insert/create/update rating schemas
  - [ ] Add rating types
- [ ] Update `server/storage.ts`
  - [ ] Extend `IStorage` for ratings CRUD
  - [ ] Implement ratings CRUD in `DatabaseStorage`
  - [ ] Join users to include creator username in responses
- [ ] Update `shared/routes.ts`
  - [ ] Add `api.ratings` route contracts
- [ ] Update `server/routes.ts`
  - [ ] Add ratings CRUD endpoints
  - [ ] Add module existence checks for car/tour
  - [ ] Add ownership checks for update/delete
- [ ] Run type checks
- [ ] Document required request payloads and endpoint usage
