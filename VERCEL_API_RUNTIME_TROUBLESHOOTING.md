# Vercel API Runtime Failures

## Symptom

The site builds and loads, but API requests return `FUNCTION_INVOCATION_FAILED`. Local development may still work.

## Cause and fix

The serverless API runs in Node.js ESM. TypeScript path aliases such as `@shared/...` can type-check and build successfully but remain unresolved when the Vercel function loads. This caused the API function to crash, so unrelated endpoints (including courses) failed together.

In server-side files, import shared modules with explicit relative ESM paths and `.js` extensions, for example:

```ts
import { isSubscriptionActive } from "../shared/payment-plans.js";
import type { Course } from "../shared/schema.js";
```

Do not use `@shared/...` aliases in server runtime imports. Client-side aliases can continue using the Vite configuration.

## Before and after deployment

1. Run `npm run check` and `npm run build`.
2. Verify the server bundle has no unresolved `@shared/` imports.
3. After deployment, smoke-test `/api/courses` and an authenticated dashboard API route. A successful build alone does not verify that the serverless function starts.

If these routes still fail, inspect the Vercel Function runtime logs and check that the required production environment variables are configured.
