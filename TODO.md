# Image Upload Fix
## Status: 🔄 In Progress - Backend fix ready

1. ✅ Diagnose: Multer "Unexpected field" - frontend 'images', backend 'image'
2. 🔄 Backend: Edit routes.ts to accept both fields (multer.fields)
3. ⏳ Frontend: Locate upload code & standardize 'image' field  
4. ⏳ Add imageUrl field/UI to TourForm/CarForm 
5. ✅ Test PNG/JPG uploads
6. ✅ Cleanup server/index.ts multer duplicate

**Next:** Apply backend fix → PNG uploads work immediately
