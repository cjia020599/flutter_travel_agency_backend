# WebSocket Fix TODO - 🔧 ADDITIONAL BUILD FIX

## Status: Build fixed, ready for redeploy

**Changes**:
- Step 1-2: Imports/jwt ✅ server/routes.ts
- **New**: Step 3b - Added "ws" to externals in script/build.ts → prevents esbuild wrapper_default bug

## Steps:
- [x] Imports added to routes.ts
- [x] jwt.verify fixed
- [x] Build config fixed (ws external)
- [ ] Run `npx tsx script/build.ts` 
- [ ] Redeploy to Render

**Test build locally**: 
```
npx tsx script/build.ts
node dist/index.cjs
```

**Deploy**: Push changes & trigger Render rebuild.
