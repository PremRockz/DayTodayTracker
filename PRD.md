# HomeBook -- Smart Household Management App

**Product Requirements Document (PRD)**

**Version:** 2.0\
**Platform:** Android (Phase 1), iOS (Phase 2)

# 1. Product Overview

HomeBook is a smart household management application that helps families
manage their daily household activities from a single place.

Instead of maintaining paper notebooks or multiple applications, users
can manage:

-   Milk purchases
-   Electricity bills
-   Grocery lists
-   Daily expenses
-   Water can deliveries
-   LPG bookings
-   Vehicle maintenance
-   Medicine reminders
-   Home inventory
-   Household documents
-   Notes
-   Subscriptions

Unlike traditional cloud-based applications, HomeBook stores the user's
data securely inside their own Google Drive App Data folder. The
application does not require a dedicated backend server, allowing users
to own and control their data.

# 2. Vision

Become the daily digital companion for every household while allowing
users to fully own their data.

# 3. Objectives

-   Replace traditional household notebooks
-   Track recurring household expenses
-   Never miss bill payments
-   Simplify grocery planning
-   Maintain household records digitally
-   Provide spending insights
-   Work completely offline
-   Automatically back up data to the user's Google Drive
-   Restore data on a new device with one tap

# 4. Key Features

### Dashboard

-   Household overview
-   Monthly spending
-   Upcoming reminders
-   Recent activities
-   Quick actions

### Milk Tracker

-   Daily milk entries
-   Quantity
-   Vendor
-   Cost calculation
-   Monthly reports

### Electricity Bill Tracker

-   Monthly EB entry
-   Units consumed
-   Amount
-   Payment status
-   Usage trends

### Water Can Tracker

-   Delivery history
-   Quantity
-   Vendor
-   Monthly expenses

### Grocery Checklist

-   Shopping lists
-   Categories
-   Purchased status
-   Repeat lists

### Expense Tracker

-   Income
-   Expenses
-   Categories
-   Payment methods
-   Monthly summaries

### Notes

-   Rich text notes
-   Categories
-   Search
-   Pin important notes

### Medicine Reminder

-   Medicine schedule
-   Notifications
-   Daily tracking

### Vehicle Maintenance

-   Fuel expenses
-   Insurance reminders
-   Service history
-   Pollution certificate reminders

### LPG Tracker

-   Booking history
-   Cylinder replacement dates
-   Cost tracking

### Subscription Manager

-   OTT subscriptions
-   Utility subscriptions
-   Renewal reminders

### Home Inventory

-   Appliances
-   Furniture
-   Warranty tracking
-   Purchase history

### Document Vault

-   Aadhaar
-   PAN
-   Insurance
-   Warranty cards
-   Bills
-   Receipts

### Reports

-   Monthly reports
-   Expense analysis
-   Spending charts
-   Export reports

### Notifications

-   Bill reminders
-   Medicine reminders
-   Subscription renewals
-   Vehicle reminders

# 5. Architecture

## Mobile

-   React Native
-   TypeScript

## Local Database

-   SQLite

## State Management

-   Zustand

## Local Storage

-   MMKV / Secure Storage

## Authentication

-   Google Sign-In

## Cloud Storage

-   Google Drive App Data Folder

## Notifications

-   Firebase Cloud Messaging (Future)
-   Local Notifications (MVP)

# 6. Data Storage Strategy

HomeBook does **not** use a custom backend server.

Every user's data is stored inside their own Google Drive.

    Mobile App

    ↓

    SQLite

    ↓

    Background Sync

    ↓

    Google Drive App Data Folder

The App Data folder is:

-   Hidden from normal Google Drive view
-   Accessible only by HomeBook
-   Private to the signed-in user
-   Automatically backed up under the user's Google account

# 7. Data Flow

## Create Entry

    User adds Expense

    ↓

    SQLite

    ↓

    Sync Queue

    ↓

    Google Drive

## Update Entry

    Update SQLite

    ↓

    Mark as Pending

    ↓

    Background Upload

    ↓

    Google Drive

## Restore

    Install App

    ↓

    Google Login

    ↓

    Download Backup

    ↓

    Restore SQLite

    ↓

    Ready

# 8. Offline First

The application always works offline.

All operations are stored in SQLite.

When internet becomes available:

-   Detect connection
-   Sync pending changes
-   Upload latest database
-   Resolve conflicts
-   Update sync status

# 9. Sync Strategy

Maintain a Sync Queue.

Each operation contains:

-   Record ID
-   Operation Type
-   Timestamp
-   Sync Status

Possible statuses:

-   Pending
-   Syncing
-   Synced
-   Failed

# 10. Security

Authentication

-   Google OAuth

Local Security

-   Encrypted SQLite
-   Secure Storage
-   Biometric Lock
-   App PIN

Cloud Security

-   Encrypted backup before upload
-   HTTPS
-   Private Google Drive App Data folder

# 11. Technology Stack

## Mobile

-   React Native
-   TypeScript

## UI

-   React Navigation
-   React Native Paper / Tamagui (TBD)

## State

-   Zustand

## Local Database

-   SQLite

## Forms

-   React Hook Form
-   Zod

## Charts

-   react-native-gifted-charts

## Authentication

-   Google Sign-In

## Cloud Backup

-   Google Drive API

## Notifications

-   Notifee

# 12. Folder Structure

    src/

    assets/

    components/

    constants/

    database/

    features/

    navigation/

    services/

    hooks/

    screens/

    store/

    theme/

    types/

    utils/

Feature Example

    features/

    milk/

    expense/

    grocery/

    dashboard/

    notes/

    electricity/

    vehicle/

    documents/

    reports/

    settings/

# 13. SQLite Tables

Users

Milk Entries

Expense Entries

Electricity Bills

Water Can

Groceries

Notes

Medicine

Vehicle

Inventory

Subscriptions

Documents

Settings

Sync Queue

# 14. MVP Scope

Authentication

Dashboard

Milk Tracker

Expense Tracker

Electricity Bill Tracker

Grocery Checklist

Notes

Reports

Offline Storage

Google Drive Backup

Restore

Local Notifications

# 15. Future Releases

## Phase 2

-   Water Can
-   LPG
-   Vehicle Maintenance
-   Medicine Reminder
-   Home Inventory
-   Document Vault
-   Subscription Manager

## Phase 3

-   OCR Receipt Scanner
-   Voice Entry
-   AI Expense Insights
-   Budget Prediction
-   Smart Recommendations
-   Widgets
-   Multi-language Support

# 16. Features Not Included in MVP

To keep the application backend-free, the following features are
postponed:

-   Family Sharing
-   Shared Household
-   Multi-user collaboration
-   Real-time synchronization between different users
-   Remote push notifications
-   Admin Portal

These features require a centralized backend and may be introduced in a
future premium version.

# 17. User Journey

    Install App

    ↓

    Google Sign-In

    ↓

    Create Local Database

    ↓

    Create Google Drive App Folder

    ↓

    Dashboard

    ↓

    Manage Household

    ↓

    Automatic Background Backup

    ↓

    Restore Anytime on Another Device

# 18. Success Metrics

-   Daily Active Users (DAU)
-   Monthly Active Users (MAU)
-   Backup Success Rate
-   Restore Success Rate
-   Monthly Expense Entries
-   Grocery Lists Created
-   Bill Payment Reminder Completion
-   Crash-Free Sessions (\>99%)

# 19. Future Migration Strategy

The architecture is designed to be backend-independent.

If collaborative features become necessary, HomeBook can later integrate
a backend (such as NestJS or Firebase) without replacing the SQLite data
model. Existing users can migrate seamlessly while retaining local-first
behavior.

# 20. Guiding Principles

-   Offline-first
-   User owns their data
-   No mandatory backend
-   Fast and lightweight
-   Privacy by design
-   Automatic backup
-   Simple household management
-   Scalable architecture for future collaboration
