# Paystack Integration Guide for Learnpedia

This document is the implementation guide for the next stage of the subscription and payment flow. It is designed to help the team move from the current demo access model to a real one-time subscription flow using Paystack.

## Current status

The app already supports:

- Course access restrictions using access codes
- Module locking until prerequisite modules are completed and quiz pass requirements are satisfied
- A demo one-time subscription flag on the student user model
- A subscription-aware dashboard and course access flow

The remaining work is to replace the simulated subscription trigger with a real Paystack checkout and secure payment verification.

## Business requirement

We will offer one subscription tier only:

- One-time payment
- Gives the learner access to all courses and modules
- Still respects module completion and quiz pass requirements in the learning flow
- Does not bypass the quiz requirement for module progression

This means:

- payment unlocks course-level access globally
- module locking remains enforced by the existing prerequisite + quiz logic
- the learner still must pass quizzes to mark a module complete and continue further learning

## Recommended architecture

### 1. Frontend payment flow

Add a Paystack checkout action in the student profile page or a dedicated billing page.

Suggested flow:

1. User clicks "Activate one-time subscription"
2. Client opens Paystack popup or redirects to Paystack checkout
3. Paystack returns a reference/transaction payload after success
4. Frontend calls a backend endpoint to verify the payment
5. Backend confirms the transaction with Paystack
6. Backend updates the user's subscription state in the database
7. Frontend refreshes the authenticated user and dashboard

### 2. Backend verification flow

Use a server-side verification endpoint to confirm the payment result before granting access.

Responsibilities:

- Accept the Paystack reference
- Call Paystack verify endpoint
- Check status, amount, currency, and customer metadata
- Mark the user as having an active subscription
- Prevent duplicate payment activation

### 3. Database fields to keep

The user model should include at least:

- hasActiveSubscription: boolean
- subscriptionTier: "one-time" | "none"
- subscriptionPaidAt: timestamp
- reference: string (optional but helpful for audit)
- paymentStatus: "pending" | "success" | "failed" (optional)

These fields are already represented in the current project model pattern and should be persisted as part of the real user record once the database is connected.

## Implementation steps

### Step 1: Add environment variables

Create a local environment file using the project environment pattern.

Required values:

```env
PAYSTACK_SECRET_KEY=your_test_secret_key
PAYSTACK_PUBLIC_KEY=your_test_public_key
PAYSTACK_BASE_URL=https://api.paystack.co
CLIENT_URL=http://localhost:5173
```

Use test keys first. Never use production keys in development.

### Step 2: Add Paystack checkout on the client

Create a billing button or page that triggers Paystack.

Recommended implementation:

- use a Paystack inline popup or redirect checkout
- pass email, amount, currency, and metadata
- include the authenticated user ID or email in metadata
- keep the amount fixed to the one-time subscription price

Example metadata:

```json
{
  "userId": "user_123",
  "plan": "one-time",
  "source": "learnpedia"
}
```

### Step 3: Add backend verification endpoint

Create an endpoint such as:

```http
POST /api/payments/verify
```

Expected behavior:

1. Receive the Paystack reference from the frontend
2. Request verification from Paystack using the secret key
3. Confirm status is "success"
4. Validate amount and currency
5. Check user exists
6. Ensure the user does not already have an active subscription
7. Update the user record to active subscription
8. Return success response

### Step 4: Prevent duplicate access

A learner must not be able to activate the same subscription multiple times.

Rules:

- if user.hasActiveSubscription is true, do not create another activation
- if a reference already exists, ignore repeated requests
- if existing payment is already verified, return a safe success response

### Step 5: Unlock all courses for subscribers

Once the subscription is verified:

- set hasActiveSubscription = true
- set subscriptionTier = "one-time"
- set subscriptionPaidAt = current timestamp
- keep access permission logic such that all courses are visible and accessible by default

Important:

This does not bypass the quiz requirement. Students still need to pass the quiz attached to a module to complete it and unlock the next stage in the course flow.

### Step 6: Update frontend access logic

The current code already follows the right pattern by checking the subscription flag before deciding if a course is locked.

The next step is to make this logic server-backed and persistent:

- course dashboard should read the latest user subscription state from the server
- access should be calculated as:

```ts
const hasAccess = user.hasActiveSubscription || userHasUnlockedCourse
```

- course pages should still enforce prerequisite and quiz-pass locking

### Step 7: Add webhook support for production safety

Use webhooks in production for reliability.

Recommended flow:

- Paystack sends a webhook event after payment success
- Backend validates the event signature
- Backend writes the subscription status
- Backend stores the transaction reference for reconciliation

This reduces risk from a client-side-only verification flow.

## Suggested API structure

### Client-side endpoints

```http
POST /api/payments/init
POST /api/payments/verify
GET /api/payments/status
```

### Backend responsibilities

```ts
- initializePaystackTransaction()
- verifyPaystackTransaction(reference)
- activateOneTimeSubscription(userId)
- getUserSubscriptionStatus(userId)
```

## Cashflow and pricing

Current requirement:

- one payment tier only
- annual or one-time subscription as a single plan
- amount is fixed for the plan

Recommended practice:

- define subscription price in environment config or admin settings
- store the plan code or amount on the backend
- reject unexpected amounts during verification

Example:

```ts
const EXPECTED_AMOUNT = 15000; // 15,000 kobo = ₦150.00 or a chosen value
const EXPECTED_CURRENCY = "NGN";
```

## QA checklist

Before going live, confirm all of the following:

- [ ] test payment succeeds in Paystack test mode
- [ ] payment verification endpoint validates status and amount
- [ ] duplicate payments do not re-grant access
- [ ] user is unlocked across all courses after successful payment
- [ ] a user without subscription still needs access codes
- [ ] lock logic still blocks modules until prerequisite + quiz pass is satisfied
- [ ] expired or failed payments do not unlock access
- [ ] frontend refresh correctly reads the updated subscription state
- [ ] webhook flow works in production-like environment

## Recommended next tasks

1. Add the Paystack SDK or direct API helper
2. Create the payment initialization endpoint
3. Create the payment verification endpoint
4. Add the user subscription update logic
5. Update the dashboard and course access logic to read server-backed user state
6. Add tests for payment verification and subscription unlocking
7. Add webhook event handling for production reliability
8. Run end-to-end test payment in sandbox mode
9. Deploy to staging and test with live Paystack test keys

## Notes for the current project

This project currently uses a mock local storage/session pattern instead of a real database-backed auth layer. That makes it a good place to validate the flow quickly, but the final production implementation should ensure:

- user state persists in a reliable database
- payment verification occurs server-side only
- transaction details are stored for support and reconciliation
- access decisions are driven by the authenticated user state and not by frontend-only flags

## Final recommendation

Keep the learning logic exactly as it is:

- access code required for non-subscribers
- subscription unlocks everything
- prerequisites still required
- quiz pass still required

That gives you a clean and safe monetization model while preserving course integrity.

---

This guide should be used as the implementation checklist once the team is ready to move from the demo subscription flow into a production Paystack integration.
