# BLACKBOX Mind — Technical Architecture v2.0

> **Private Beta** · React Native (Expo) · Supabase · Gemini 3.1

BLACKBOX is a strategic AI journaling platform that turns your thoughts, recordings, and daily reflections into actionable intelligence. Users register memories, which the AI analyzes in depth, then opens a therapy-style conversation to help process and act on insights.

---

## Table of Contents

- [What's New in v2.0](#whats-new-in-v20)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Feature Tiers: FREE vs PRO](#feature-tiers-free-vs-pro)
- [Directory Structure](#directory-structure)
- [Screens & Navigation](#screens--navigation)
- [Edge Functions (Backend-for-Frontend)](#edge-functions-backend-for-frontend)
- [Database Schema](#database-schema)
- [AI Layer](#ai-layer)
- [Security Model](#security-model)
- [Push Notifications](#push-notifications)
- [Subscription & Monetization](#subscription--monetization)
- [Local Development Setup](#local-development-setup)
- [Key Environment Variables](#key-environment-variables)
- [Deployment](#deployment)

---

## What's New in v2.0

| Feature | Details |
|---------|---------|
| **🧠 Therapy Chat Post-Entry** | After every memory analysis, BLACKBOX opens a real-time strategic session — pre-seeded with the full AI diagnosis — instead of showing a dead-end Alert |
| **👑 FREE / PRO Tier System** | 5 entries/month FREE. PRO unlocks unlimited entries, voice, chat, and weekly reports |
| **💰 Annual Plan** | $29.99/mo · $305.90/yr (–15%) via RevenueCat |
| **🤖 Gemini 3.1 Flash-Lite** | Upgraded from deprecated 2.0-flash. Faster, cheaper, with reasoning capabilities |
| **🔐 Edge Function Security** | All AI calls go through Supabase Edge Functions — no API keys on the client |
| **📣 V2 What's New Modal** | Auto-shows to existing users on first launch after update |
| **🔔 Engagement Notifications** | 9 AM challenge + 9 PM reflection scheduled automatically |
| **🛡️ Resilient Biometrics** | Progressive fallback: Face ID → Device PIN → Sign-out (after 1, 3, 5 failures) |
| **🎤 Mic Permission UX** | On denial, native Alert links directly to device Settings |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile Framework** | React Native 0.81.5 via Expo SDK 54 |
| **Language** | TypeScript 5.3 |
| **Navigation** | React Navigation 6 (Native Stack) |
| **Backend / DB** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| **Authentication** | Supabase Auth (Email/Password, Google OAuth, Apple OAuth) |
| **Biometrics** | `expo-local-authentication` (Face ID / Fingerprint) |
| **AI Model** | Google Gemini 3.1 Flash-Lite (via Edge Functions) |
| **Subscriptions** | RevenueCat (`react-native-purchases`) |
| **Notifications** | `expo-notifications` (local scheduled) |
| **Audio** | `expo-av` (recording), Supabase Storage (upload) |
| **Animations** | `react-native-reanimated` 4.1 |
| **Icons** | `lucide-react-native` |
| **Build system** | EAS Build (Expo Application Services) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (React Native)                │
│                                                         │
│  Screens → Hooks → Services → supabase.functions.invoke │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTPS + JWT
┌──────────────────────────▼──────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)              │
│                                                         │
│  analyze-entry ──┐                                      │
│  ai-chat ────────┼──► Gemini 3.1 Flash-Lite API         │
│  transcribe-audio┘     (GEMINI_API_KEY — server only)   │
│                                                         │
│  _shared/retry.ts  (exponential backoff + jitter)       │
└──────────────────────────┬──────────────────────────────┘
                           │  Supabase JS Client
┌──────────────────────────▼──────────────────────────────┐
│                  SUPABASE PLATFORM                       │
│                                                         │
│  PostgreSQL ── entries, profiles, chat_threads,         │
│                chat_messages, cached_insights,           │
│                goals, invitations                        │
│                                                         │
│  Auth ── Email · Google · Apple OAuth                   │
│  Storage ── diaries/ (audio files)                      │
└─────────────────────────────────────────────────────────┘
```

**Design pattern:** Backend-for-Frontend (BFF). The mobile client is a pure consumer — it never calls AI APIs directly. All sensitive logic runs in Edge Functions authenticated via Supabase JWT.

---

## Feature Tiers: FREE vs PRO

| Feature | FREE | PRO |
|---------|------|-----|
| Monthly entries | **5 / month** | ♾️ Unlimited |
| AI analysis per entry | ✅ Full analysis | ✅ Full analysis |
| Post-entry therapy chat | ✅ Available | ✅ Available |
| ChatHub (manual sessions) | ❌ Blocked → Paywall | ✅ Unlimited |
| Voice recording & transcription | ❌ Blocked → Alert | ✅ Included |
| Weekly strategic reports | ❌ Blocked → Paywall | ✅ Included |
| Goals | ✅ Up to 3 | ✅ Unlimited |
| History | ✅ Full | ✅ Full |
| Biometric lock | ✅ | ✅ |

### Gate Implementation

```
useSubscription() hook
  ├── isPro    ← profile.is_pro (loaded in AuthContext)
  ├── monthlyEntryCount ← SupabaseService.getMonthlyEntryCount()
  └── entryLimitReached ← !isPro && count >= 5
```

Every gated screen shows a **Paywall CTA** — never a dead end.

---

## Directory Structure

```
blackboxapp/
├── src/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   ├── SignUpScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   │
│   ├── components/
│   │   ├── AILoadingOverlay.tsx     # Fullscreen loading state for AI calls
│   │   ├── ActionList.tsx           # Renders active loops / action items
│   │   ├── BiasWarningCard.tsx      # Cognitive bias detection UI
│   │   ├── LockScreen.tsx           # Biometric auth with progressive fallback
│   │   ├── VoiceVisualizer.tsx      # Real-time audio waveform
│   │   ├── WellnessActionCard.tsx   # Wellness recommendation UI
│   │   └── WhatsNewModal.tsx        # V2 announcement bottom sheet
│   │
│   ├── context/
│   │   ├── AuthContext.tsx          # User, profile (is_pro), auth state
│   │   └── TabContext.tsx
│   │
│   ├── hooks/
│   │   └── useSubscription.ts      # isPro, monthlyEntryCount, entryLimitReached
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── TabNavigator.tsx
│   │   └── types.ts                 # RootStackParamList (typed)
│   │
│   ├── screens/
│   │   ├── DashboardScreen.tsx      # Command center with stats & WhatsNewModal
│   │   ├── HomeScreen.tsx           # Memory timeline + daily AI insight
│   │   ├── NewEntryScreen.tsx       # Entry creation → therapy chat navigation
│   │   ├── ChatScreen.tsx           # Therapy or standard chat (isTherapyMode)
│   │   ├── ChatHubScreen.tsx        # Manage all chat threads (PRO)
│   │   ├── WeeklyReportScreen.tsx   # 7-day strategic report (PRO)
│   │   ├── EntryDetailScreen.tsx    # Full entry + action items
│   │   ├── PaywallScreen.tsx        # Plan selector: monthly / annual
│   │   ├── SettingsScreen.tsx       # Goals, pending loops, hub
│   │   ├── OnboardingScreen.tsx
│   │   └── QuickCaptureScreen.tsx   # Fast voice-first entry
│   │
│   └── services/
│       ├── SupabaseService.ts       # All DB operations + getMonthlyEntryCount()
│       ├── ChatService.ts           # Calls ai-chat Edge Function (+ therapyMode)
│       ├── ai.ts                    # Calls analyze-entry Edge Function
│       ├── voice.ts                 # Recording + mic permission UX
│       ├── BioAuthService.ts        # Face ID / PIN wrapper
│       ├── RevenueCatService.ts     # Subscription purchase flow
│       ├── notificationService.ts  # Local notifications (9AM + 9PM)
│       └── RetryHelper.ts          # Client-side retry (mirrors Edge Function retry)
│
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   └── retry.ts             # withRetry() + fetchWithStatus() — shared
│       ├── analyze-entry/
│       │   └── index.ts             # Entry analysis → JSON diagnostic
│       ├── ai-chat/
│       │   └── index.ts             # Chat + therapy mode prompts
│       └── transcribe-audio/
│           └── index.ts             # Audio → text transcription
│
├── assets/                          # logo.png, splash, icons
├── database.sql                     # Schema DDL
├── app.json                         # Expo app config
├── eas.json                         # EAS build profiles
└── .env.example                     # Required environment variables
```

---

## Screens & Navigation

### Navigation Stack (`RootStackParamList`)

```typescript
Login | SignUp | Onboarding           // Auth flow
Dashboard                             // Main command center
Home                                  // Memory timeline
NewEntry { transcription? }           // Create memory → therapy chat
Chat {                                // AI conversation
  threadId, category, title,
  isTherapyMode?,                     // Post-entry therapy session
  entryContext?                       // Full entry analysis for AI context
}
ChatHub                               // Thread list (PRO)
WeeklyReport { reportEndDate? }       // 7-day report (PRO)
EntryDetail { entryId }               // Full entry view
Settings { initialViewMode? }         // Goals & loops hub
Paywall                               // Plan selector
QuickCapture                          // Fast entry
```

### Post-Entry Therapy Chat Flow

```
NewEntryScreen.handleSave()
  1. Upload audio (if recorded)
  2. aiService.generateDailySummary() → Edge Function analyze-entry
  3. SupabaseService.createEntry() → saves to DB
  4. NotificationService.scheduleStrategicFollowup() → HIGH loops
  5. SupabaseService.createChatThread() → new thread for this session
  6. SupabaseService.saveChatMessage() → pre-seeds AI first message:
       🧠 Mood + score
       💡 Strategic insight
       🔄 Wellness recommendation
       ⚡ Active loops list
       → "¿Qué parte de tu situación quieres explorar ahora?"
  7. navigation.replace('Chat', { isTherapyMode: true, entryContext })
     → User can now continue the conversation naturally
```

---

## Edge Functions (Backend-for-Frontend)

All functions run on Deno in Supabase; all require a valid Supabase JWT.

### `analyze-entry`
**Model:** `gemini-3.1-flash-lite`

**Input:**
```json
{ "content": "...", "userId": "uuid", "historicalContext": "..." }
```

**Output (typed JSON):**
```json
{
  "title": "AI-generated title",
  "summary": "Clinical summary",
  "mood_label": "Ansioso",
  "sentiment_score": -0.4,
  "strategic_insight": { "detected_bias": "...", "recommendation": "..." },
  "wellness_recommendation": { "type": "ACTION", "title": "...", "description": "..." },
  "action_items": [{ "task": "...", "priority": "HIGH", "category": "BUSINESS" }],
  "category": "PERSONAL | BUSINESS | DEVELOPMENT | WELLNESS"
}
```

### `ai-chat`
**Model:** `gemini-3.1-flash-lite`

**Two modes via `therapyMode` flag:**

| Parameter | Standard Mode | Therapy Mode |
|-----------|--------------|--------------|
| `temperature` | 0.7 | 0.85 |
| `maxOutputTokens` | 1,500 | 600 |
| System prompt | Ex-McKinsey consultant | Empathetic coach + Socratic questioning |
| Entry context | ❌ | ✅ Full (original text, mood, insight, loops) |

**Input:**
```json
{
  "userMessage": "...",
  "chatHistory": [...],
  "userId": "uuid",
  "userName": "...",
  "category": "BUSINESS",
  "therapyMode": true,
  "entryContext": {
    "originalText": "...",
    "summary": "...",
    "moodLabel": "Ansioso",
    "sentimentScore": -0.4,
    "strategicInsight": "...",
    "wellnessRecommendation": "...",
    "actionItems": [...]
  }
}
```

### `transcribe-audio`
**Model:** `gemini-3.1-flash-lite`

Receives Base64-encoded audio, returns transcribed text. Called from `VoiceService` after recording stops.

### `_shared/retry.ts`

Shared utility for all Edge Functions:
```typescript
withRetry(fn, { maxAttempts: 3, baseDelayMs: 600 })
// Exponential backoff with jitter
// Retries on 429 (rate limit) and 5xx errors
```

---

## Database Schema

### Core Tables

```sql
-- Users extended profile
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  full_name text,
  email text,
  is_pro boolean DEFAULT false,        -- ← THE gate for all PRO features
  avatar_url text,
  accepted_terms_at timestamptz,
  accepted_privacy_at timestamptz,
  updated_at timestamptz
)

-- Memory entries with AI analysis
entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  title text,
  content text,
  original_text text,
  audio_url text,
  category text,                        -- PERSONAL | BUSINESS | DEVELOPMENT | WELLNESS
  mood_label text,
  sentiment_score float,
  summary text,
  strategic_insight jsonb,
  wellness_recommendation jsonb,
  action_items jsonb[],
  ai_analysis jsonb,                    -- Consolidated JSONB (backup/forward compat)
  created_at timestamptz DEFAULT now()
)

-- Strategic goals
goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  title text,
  description text,
  category text,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
)

-- Chat infrastructure
chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  title text,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES chat_threads(id),
  role text,                            -- 'user' | 'model'
  content text,
  created_at timestamptz DEFAULT now()
)

-- AI response cache (avoids re-calling Gemini for same content)
cached_insights (
  user_id uuid,
  insight_type text,                    -- 'daily' | 'weekly'
  fingerprint text,                     -- content hash for cache key
  content jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, insight_type, fingerprint)
)

-- Beta access control
invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,                     -- Format: BB-XXXXXX
  email text,
  invited_by text,
  used_by uuid REFERENCES profiles(id),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

---

## AI Layer

### Cost Model (Gemini 3.1 Flash-Lite)

| Tier | Price |
|------|-------|
| Input tokens | $0.25 / 1M |
| Output tokens | $1.50 / 1M |

**Cost per PRO user/month** (typical usage):
| Operation | Count | Cost |
|-----------|-------|------|
| Entry analysis | 20 × (2K in + 600 out) | $0.028 |
| Therapy chat | 60 msgs × (1K in + 400 out) | $0.051 |
| Weekly reports | 4 × (3K in + 800 out) | $0.008 |
| Voice transcription | 8 × 1.5K in | $0.003 |
| **Total** | | **~$0.09/month** |

**Business margin at $29.99/mo PRO (post-store cut): ~99%**

### Cache Strategy

To avoid redundant AI calls, `SupabaseService` checks `cached_insights` before invoking any Edge Function. Cache key = `insight_type + fingerprint` where fingerprint = `${entryCount}_${latestEntryId}`.

---

## Security Model

### What is protected

| Attack Surface | Mitigation |
|---------------|-----------|
| Gemini API key exposure | Never in client. Stored as Supabase secret `GEMINI_API_KEY`. |
| Unauthenticated Edge Function calls | All functions check `Authorization: Bearer <JWT>` header |
| SQL injection | Supabase client uses parameterized queries exclusively |
| Audio data leakage | Audio stored in Supabase Storage with user-scoped paths (`userId/timestamp.m4a`) |
| PRO feature bypass | `profile.is_pro` is a server-side PostgreSQL column — never derived from client state |
| Git credential exposure | `.env` and Firebase service keys in `.gitignore`. Past leaks purged via `git filter-repo`. |

### Authentication Flow

```
User opens app
  → AuthContext checks Supabase session
  → If active: load profile (is_pro, full_name) from `profiles` table
  → If biometric lock enabled: show LockScreen
      → Attempt Face ID/Fingerprint (expo-local-authentication)
      → Failure 1: retry
      → Failure 3: offer Device PIN fallback
      → Failure 5: offer Sign-out emergency escape
```

---

## Push Notifications

Implemented via `expo-notifications` (local scheduled — no push server required).

| ID | Time | Title | Body | Trigger |
|----|------|-------|------|---------|
| `MORNING_CHALLENGE` | 9:00 AM daily | "⚡ BLACKBOX te desafía" | "¿Qué está bloqueando tu progreso hoy? 30 segundos." | Daily |
| `EVENING_REFLECTION` | 9:00 PM daily | "Momento de reflexión 🌙" | "Ingresa tus pensamientos... 1 minuto." | Daily |
| `STRATEGIC_FOLLOWUP` | +72h from entry | "DIAGNÓSTICO DE PROCRASTINACIÓN" | Task-specific message | TimeInterval |

> **Note:** Local notifications work on physical devices in both Expo Go (Android) and production builds (iOS + Android). Remote push requires an EAS production build with APNs/FCM configuration.

---

## Subscription & Monetization

### Plans

| Plan | Price | Store cut (yr 1 / renewal) | Net/month |
|------|-------|---------------------------|-----------|
| Monthly | $29.99/mo | 30% / 15% | $20.99 / $25.49 |
| Annual | $305.90/yr (~$25.49/mo) | 30% / 15% | $17.84 / $21.67 |

Annual = $29.99 × 12 × 0.85 (15% discount applied).

### RevenueCat Integration

```typescript
// RevenueCatService.ts
Purchases.configure({ apiKey: REVENUECAT_API_KEY });

// PaywallScreen.tsx — purchase flow
const offerings = await Purchases.getOfferings();
const pkg = offerings.current.availablePackages
  .find(p => p.packageType === 'ANNUAL' | 'MONTHLY');
await Purchases.purchasePackage(pkg);
// → on success: profile.is_pro set via webhook or manual update
```

> ⚠️ RevenueCat API keys are currently placeholder values (`goog_example_*`). Replace before App Store submission.

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g expo`
- Supabase CLI: `brew install supabase/tap/supabase`
- EAS CLI: `npm install -g eas-cli`

### Steps

```bash
# 1. Clone
git clone https://github.com/torosilva/blackboxapp.git
cd blackboxapp

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

# 4. Start development server
npx expo start

# 5. Run on device
# Android: scan QR in Expo Go app
# iOS: scan QR in Camera app (Expo Go)
```

### Edge Functions (local dev)

```bash
# Link to your Supabase project
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
npx supabase secrets set GEMINI_API_KEY=your_key

# Deploy all functions
npx supabase functions deploy analyze-entry
npx supabase functions deploy ai-chat
npx supabase functions deploy transcribe-audio
```

---

## Key Environment Variables

```bash
# .env (client — EXPO_PUBLIC_ prefix = safe to bundle)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase Edge Function Secrets (server-side only — never in client)
GEMINI_API_KEY=AIza...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
```

---

## Deployment

### EAS Build Profiles (`eas.json`)

| Profile | Platform | Use |
|---------|---------|-----|
| `development` | Android | Local testing with dev client |
| `preview` | Android | Internal TestFlight/APK for testers |
| `production` | iOS + Android | App Store / Play Store submission |

```bash
# Build for internal testing
eas build --platform android --profile preview

# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Changelog

### v2.0.0 (April 2026)
- Therapy chat post-entry (replaces Alert dead-end)
- FREE/PRO tier gates across all screens
- Annual plan ($305.90/yr, –15%)
- Gemini 3.1 Flash-Lite upgrade (all Edge Functions)
- WhatsNew V2 modal for existing beta users
- Engagement notifications: 9 AM + 9 PM daily
- Progressive biometric fallback (Face ID → PIN → Sign-out)
- Mic permission UX with Settings deep-link
- Edge Function retry logic (exponential backoff + jitter)
- All AI keys moved server-side (purged from git history)

### v1.x (January–March 2026)
- Initial beta: entry creation, AI analysis, weekly reports
- Supabase migration from Firebase
- ChatHub and thread management
- Biometric lock screen
- Goal tracking system
- RevenueCat integration (placeholder keys)
- EAS build configuration

---

*Built with ❤️ — BLACKBOX Mind, 2026*
