# Notification System Implementation

## Overview
- Realtime notifications via WebSocket for Flutter Web
- Triggers: bookings, ratings, low stock, status changes
- User-specific via rooms/filtering
- REST API for list/mark read
- Flutter UI: bell icon + badge + list drawer

Status: [ ] In Progress

## Steps (to be checked off)

### 1. DB Schema & Types [✅]
- Edit shared/schema.ts: add notifications table, Zod schemas
- Edit shared/routes.ts: add api.notifications paths/schemas

### 2. Storage Layer [✅]
- Edit server/storage.ts: CRUD for notifications (create, getUserNotifications, markRead)

### 3. API Routes [✅]
- Edit server/routes.ts: POST create (admin/vendor), GET list, PATCH read
- Setup WebSocket server (/ws/notifications): auth, rooms, emit on create/read

### 4. DB Migration [Manual - User]
- Run: npx drizzle-kit push

### 5. Server Restart & Test [Manual - User]
- npm run dev
- Test APIs/WS


### 4. DB Migration [Manual - User]
- Run: npx drizzle-kit push

### 5. Server Restart & Test [Manual - User]
- npm run dev
- Test APIs/WS

### 6. Flutter Web Integration [Provided Code]
- pub add web_socket_channel
- Notification bell, badge (unread count), list drawer

## Triggers to Auto-Implement Later
- [ ] On booking create: notify buyer + vendor
- [ ] On rating create: notify vendor
- [ ] Low car inventory
- [ ] Booking status change

**Next Step: Proceed with Step 1 (schemas). Confirm?**
