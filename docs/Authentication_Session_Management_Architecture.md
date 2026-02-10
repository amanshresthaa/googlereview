# Authentication & Session Management Architecture

JWT-based authentication using NextAuth.js with Google OAuth, multi-tenant organization structure, encrypted token storage, and role-based access control. Key entry points: sign-in flow [1b], JWT callback bootstrap [2b], session validation [3a], API authentication [4b], and token refresh [5b].

## Trace 1: Google OAuth Sign-In Flow

Client-side authentication initiation through NextAuth.js Google provider

```
Google OAuth Sign-In Flow
├── Sign-in page (server component)
│   └── getSession() checks auth status <-- 1a
│       └── Redirect if already authenticated <-- page.tsx:20
├── Sign-in button (client component)
│   └── onClick handler <-- 1b
│       └── signIn("google", {callbackUrl})
│           └── NextAuth client initiates OAuth
├── NextAuth API route handler
│   └── POST /api/auth/[...nextauth] <-- 1c
│       └── NextAuth(req, ctx, authOptions())
│           └── Processes OAuth callback
├── Auth configuration
│   ├── GoogleProvider setup <-- 1d
│   │   ├── clientId & clientSecret <-- auth-options.ts:15
│   │   └── authorization params <-- auth-options.ts:22
│   │       └── scope configuration <-- 1e
│   │           └── business.manage permission
│   └── Callbacks (jwt, session) <-- auth-options.ts:38
│       └── [continues in trace 2]
└── OAuth flow completes
    └── User redirected with session
```

### Location Details
- **1a**: Sign-in page checks existing session - `/app/signin/page.tsx:19`
- **1b**: User initiates Google OAuth - `/app/signin/SignInClient.tsx:12`
- **1c**: NextAuth API route handler - `/app/api/auth/[...nextauth]/route.ts:10`
- **1d**: Google OAuth provider configuration - `/lib/auth-options.ts:14`
- **1e**: Request GBP API permissions - `/lib/auth-options.ts:28`

## Trace 2: JWT Callback: User & Organization Bootstrap

Server-side processing during OAuth callback to create/update user, organization, and store encrypted tokens

```
Google OAuth Callback Flow
└── NextAuth API route receives callback <-- route.ts:10
    └── authOptions().callbacks.jwt() <-- 2a
        ├── prisma.user.upsert() <-- 2b
        ├── Find existing membership <-- 2c
        ├── Create org if needed <-- auth-options.ts:59
        │   └── tx.organization.create() <-- 2d
        │       ├── Create membership (role: OWNER) <-- auth-options.ts:68
        │       └── Create default settings <-- auth-options.ts:72
        ├── Populate JWT claims <-- 2e
        │   ├── token.userId = user.id <-- auth-options.ts:88
        │   ├── token.orgId = orgId <-- auth-options.ts:89
        │   └── token.role = membership.role <-- auth-options.ts:90
        └── Store Google OAuth tokens <-- auth-options.ts:115
            └── prisma.googleConnection.upsert() <-- 2f
                ├── Encrypt refresh token <-- 2g
                │   └── encryptString(refreshToken) <-- auth-options.ts:123
                └── Encrypt access token <-- auth-options.ts:124
                    └── encryptString(accessToken) <-- auth-options.ts:125
```

### Location Details
- **2a**: JWT callback receives OAuth data - `/lib/auth-options.ts:42`
- **2b**: Upsert user record - `/lib/auth-options.ts:48`
- **2c**: Check for existing organization - `/lib/auth-options.ts:54`
- **2d**: Create new organization - `/lib/auth-options.ts:62`
- **2e**: Populate JWT token claims - `/lib/auth-options.ts:88`
- **2f**: Store encrypted OAuth tokens - `/lib/auth-options.ts:116`
- **2g**: Encrypt refresh token - `/lib/auth-options.ts:123`

## Trace 3: Session Retrieval & Validation

Server-side session resolution with E2E testing bypass and NextAuth fallback

```
Session Retrieval & Validation Flow
├── Protected App Layout
│   ├── getSession() called <-- 3d
│   └── Redirect if invalid <-- 3e
│
├── Session Resolution (lib/session.ts)
│   ├── getSession() entry point <-- 3a
│   │   ├── tryGetE2ESession() first <-- 3b
│   │   │   ├── Check E2E_TEST_SECRET <-- session.ts:55
│   │   │   ├── Verify HMAC signature <-- session.ts:57
│   │   │   └── Parse signed cookie <-- session.ts:61
│   │   └── getServerSession(authOptions()) <-- session.ts:2
│   │       └── NextAuth JWT validation
│   │           └── session callback <-- 3c
│   │               ├── Extract token.userId <-- auth-options.ts:193
│   │               ├── Extract token.orgId <-- auth-options.ts:195
│   │               └── Extract token.role <-- auth-options.ts:196
│   └── Return Session object <-- auth-options.ts:197
│       ├── user: { id, name, email, image }
│       ├── orgId: string
│       └── role: string
```

### Location Details
- **3a**: Session resolution with E2E bypass - `/lib/session.ts:75`
- **3b**: E2E test session bypass - `/lib/session.ts:46`
- **3c**: Session callback enrichment - `/lib/auth-options.ts:191`
- **3d**: Protected layout validates session - `/app/(app)/layout.tsx:7`
- **3e**: Redirect unauthenticated users - `/app/(app)/layout.tsx:8`

## Trace 4: API Route Authentication Pattern

Standard authentication flow for API endpoints using session validation

```
API Route Authentication Pattern
│
├── API Endpoint (reviews/route.ts)
│   ├── GET handler <-- route.ts:23
│   │   ├── requireApiSession() call <-- 4a
│   │   └── validate session exists <-- 4d
│   └── use session.orgId for query <-- 4e
│
└── Session Validation (session.ts)
    ├── requireApiSession() entry <-- 4b
    │   ├── getSession() call <-- 4c
    │   │   ├── tryGetE2ESession() <-- session.ts:46
    │   │   └── getServerSession(authOptions()) <-- session.ts:75
    │   │       └── JWT token validation
    │   │           └── session callback <-- auth-options.ts:191
    │   └── validate user.id & orgId exist <-- session.ts:80
    └── return session or null <-- session.ts:83
```

### Location Details
- **4a**: API route requests session - `/app/api/reviews/route.ts:24`
- **4b**: Session validation helper - `/lib/session.ts:78`
- **4c**: Retrieve current session - `/lib/session.ts:79`
- **4d**: Return 401 if unauthenticated - `/app/api/reviews/route.ts:25`
- **4e**: Scope query to user's organization - `/app/api/reviews/route.ts:49`

## Trace 5: Google Token Storage & Refresh

Encrypted token management for background Google API access with automatic refresh

```
Google Token Storage & Refresh Flow
├── Background Job Needs API Access
│   └── getAccessTokenForOrg(orgId) <-- 5a
│       ├── Fetch GoogleConnection from DB <-- 5b
│       ├── Check if cached token valid <-- 5c
│       │   └── If valid (>2min), decrypt & return <-- oauth.ts:21
│       │       └── decryptString(accessTokenEnc) <-- oauth.ts:22
│       └── If expired, refresh flow
│           ├── Decrypt refresh token <-- 5d
│           ├── refreshAccessToken(token) <-- 5e
│           │   └── POST to Google OAuth <-- 5f
│           │       └── oauth2.googleapis.com/token
│           └── Encrypt & store new token <-- 5g
│               └── prisma.googleConnection.update() <-- oauth.ts:39
└── Token used for GBP API calls
    └── Reviews sync, reply posting, etc.
```

### Location Details
- **5a**: Get access token for organization - `/lib/google/oauth.ts:11`
- **5b**: Fetch encrypted token record - `/lib/google/oauth.ts:13`
- **5c**: Check token cache validity - `/lib/google/oauth.ts:19`
- **5d**: Decrypt refresh token - `/lib/google/oauth.ts:27`
- **5e**: Call Google token refresh - `/lib/google/oauth.ts:38`
- **5f**: POST to Google OAuth endpoint - `/lib/google/oauth.ts:60`
- **5g**: Store refreshed token - `/lib/google/oauth.ts:42`

## Trace 6: E2E Test Authentication Bypass

Non-production authentication mechanism for end-to-end tests using signed cookies

```
E2E Test Authentication Flow
├── POST /api/test/login <-- 6a
│   ├── Validate E2E_TEST_SECRET bearer <-- 6b
│   ├── Bootstrap test data <-- 6c
│   │   ├── Upsert user & org <-- route.ts:46
│   │   ├── Create location <-- route.ts:83
│   │   └── Seed review with draft <-- route.ts:110
│   ├── Encode session to base64url <-- 6d
│   ├── Sign with HMAC-SHA256 <-- route.ts:156
│   └── Set __e2e_session cookie <-- 6e
│
└── Session Resolution (lib/session.ts)
    ├── getSession() <-- session.ts:74
    │   └── tryGetE2ESession() <-- session.ts:46
    │       ├── allowE2E() safety check <-- 6g
    │       ├── Read __e2e_session cookie <-- session.ts:50
    │       ├── verifyCookie() HMAC check <-- 6f
    │       └── Parse & return session <-- session.ts:61
    └── Falls back to NextAuth if no E2E <-- session.ts:75
```

### Location Details
- **6a**: E2E login endpoint - `/app/api/test/login/route.ts:34`
- **6b**: Validate E2E_TEST_SECRET - `/app/api/test/login/route.ts:36`
- **6c**: Create test user and org - `/app/api/test/login/route.ts:46`
- **6d**: Create signed session payload - `/app/api/test/login/route.ts:147`
- **6e**: Set E2E session cookie - `/app/api/test/login/route.ts:160`
- **6f**: Verify E2E cookie signature - `/lib/session.ts:57`
- **6g**: E2E safety check - `/lib/session.ts:21`

## Trace 7: Role-Based Access Control & Team Invites

Organization membership roles and invitation system for multi-user access

```
Team Invite & Role-Based Access Control
├── API Request: POST /api/team/invite <-- route.ts:14
│   ├── Check actor's membership <-- 7a
│   ├── Enforce OWNER role check <-- 7b
│   │   └── Return 403 if not OWNER <-- route.ts:23
│   ├── Generate secure invite token <-- 7c
│   └── Persist invite with hash <-- 7d
│       └── SHA-256(token) + email + role + expiry <-- route.ts:33
├── Database Schema
│   ├── Membership model <-- 7e
│   │   └── orgId + userId + role <-- schema.prisma:86
│   └── Invite model <-- schema.prisma:239
│       └── tokenHash + email + expiresAt <-- schema.prisma:245
└── Session Type Extensions
    └── NextAuth Session interface <-- 7f
        └── orgId + role fields <-- next-auth.d.ts:5
```

### Location Details
- **7a**: Check inviter's role - `/app/api/team/invite/route.ts:18`
- **7b**: Enforce OWNER-only permission - `/app/api/team/invite/route.ts:22`
- **7c**: Generate invite token - `/app/api/team/invite/route.ts:32`
- **7d**: Store hashed invite token - `/app/api/team/invite/route.ts:36`
- **7e**: Membership model definition - `/prisma/schema.prisma:83`
- **7f**: Session includes organization - `/types/next-auth.d.ts:5`

## Trace 8: Cron Job Authentication

Bearer token authentication for scheduled background workers

```
Cron Job Authentication Flow
├── Vercel Cron invokes GET /api/cron/worker
│   └── handle(req) <-- route.ts:9
│       ├── Check DISABLE_CRON flag <-- route.ts:12
│       ├── Extract auth header <-- 8a
│       ├── Build expected Bearer token <-- 8b
│       ├── Compare & reject if mismatch <-- 8c
│       ├── scheduleReviewSyncJobs() <-- route.ts:23
│       └── runWorkerOnce() <-- route.ts:29
│
└── Environment Configuration
    └── env() validates required vars <-- env.ts:39
        └── CRON_SECRET: z.string().min(1) <-- 8d
```

### Location Details
- **8a**: Extract authorization header - `/app/api/cron/worker/route.ts:17`
- **8b**: Compare against CRON_SECRET - `/app/api/cron/worker/route.ts:18`
- **8c**: Reject unauthorized cron requests - `/app/api/cron/worker/route.ts:19`
- **8d**: CRON_SECRET validation - `/lib/env.ts:27`
