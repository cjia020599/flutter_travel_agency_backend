# LuminaTravel - Travel & Booking Admin System

## Project Overview
A full-stack Travel & Booking System admin dashboard built with Node.js/Express backend and React frontend. Manages Tours, Car Rentals, Locations, Attributes, and Users with role-based access control.

## Architecture
- **Frontend**: React + TypeScript, Vite, TanStack Query, Shadcn/UI, Tailwind CSS, Wouter routing
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Drizzle ORM)
- **Auth**: JWT tokens (jsonwebtoken + bcryptjs), stored in localStorage

## Key Features

### Authentication
- **POST /api/auth/register** - User registration with role selection (administrator/vendor/customer). Vendor role requires businessName field
- **POST /api/auth/login** - JWT-based login, returns token + user with role info
- JWT token sent in `Authorization: Bearer <token>` header on all protected requests

### User & Role Management
- Three roles: Administrator, Vendor, Customer
- **GET /api/user/profile** - Get current user profile (protected)
- **PUT /api/user/profile/update** - Update profile fields (protected)
- **GET /api/admin/roles** - List all roles with ID, name, code, date (protected)

### Vendor Commission Module
- Vendors have a linked VendorProfile with businessName, commissionType (default/percent/amount/disable), commissionValue

### Tours API
- CRUD: GET/POST /api/tours, GET/PUT/DELETE /api/tours/:id
- Soft delete via deletedAt timestamp
- Complex JSON fields: itinerary, faqs, include/exclude arrays, surroundings
- Pricing: price, salePrice, extraPrices, serviceFees, personTypes, discountByPeople

### Cars API
- CRUD: GET/POST /api/cars, GET/PUT/DELETE /api/cars/:id
- Soft delete via deletedAt timestamp
- Specs: passenger, gearShift, baggage, door
- Inventory: inventoryCount, minDayStay, minDayBeforeBooking

### Shared Modules
- **Locations**: Hierarchical (parentId), slug, status
- **Attributes**: Name + type (Travel Style, Car Feature, etc.)
- **Media**: filePath, fileType, authorId

## Database Schema (Drizzle ORM)
Tables: roles, users, vendor_profiles, locations, attributes, tours, cars, tour_attributes, car_attributes, bookings, media

## Frontend Pages
- `/login` - Login page
- `/register` - Register page with role selection
- `/` - Dashboard with stats
- `/tours` & `/tours/new` & `/tours/:id` - Tour management
- `/cars` & `/cars/new` & `/cars/:id` - Car management
- `/locations` - Locations list
- `/attributes` - Attributes list
- `/profile` - User profile (personal info + location + vendor info)
- `/admin/roles` - Roles management (admin only, shown in sidebar)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - JWT signing secret

## Run Commands
- `npm run dev` - Start development server (Express + Vite)
- `npm run db:push` - Push Drizzle schema to database
