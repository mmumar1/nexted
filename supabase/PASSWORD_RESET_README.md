# Learnpedia Password Reset

The password-reset flow is already implemented with Supabase Auth.

## Implemented frontend routes

```text
/forgot-password
/reset-password
```

The login page links to `/forgot-password`. That page calls:

```ts
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```

The recovery page calls:

```ts
supabase.auth.updateUser({ password });
```

No password-reset endpoint is required in Express. Supabase Auth is the backend password-reset service.

## Dummy local configuration

The frontend already uses these variables from the root `.env.local`:

```env
VITE_SUPABASE_URL=https://dummy-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=dummy-anon-public-key
```

Replace the dummy values with the real values from:

```text
Supabase Dashboard -> Project Settings -> API
```

Never add a service-role key to a `VITE_` variable.

## Supabase configuration required later

Open:

```text
Authentication -> URL Configuration
```

Set the local Site URL:

```text
http://localhost:5000
```

Add these Redirect URLs:

```text
http://localhost:5000/reset-password
https://your-production-domain.com/reset-password
```

Replace `https://your-production-domain.com` with the real Vercel domain before production deployment.

## Email template

Open:

```text
Authentication -> Email Templates -> Reset Password
```

The reset email must include:

```text
{{ .ConfirmationURL }}
```

A simple template can be:

```html
<h2>Reset your Learnpedia password</h2>
<p>Click the link below to choose a new password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>This link expires and can only be used once.</p>
```

## Testing checklist

1. Start the app:

   ```powershell
   npm run dev
   ```

2. Open `http://localhost:5000/forgot-password`.
3. Enter the email of an existing Supabase Auth user.
4. Open the reset email.
5. Confirm it redirects to `/reset-password`.
6. Enter a password with at least 8 characters.
7. Confirm the app redirects to `/login`.
8. Sign in with the new password.

## Common problems

### Invalid or expired link

Confirm that the exact reset URL is listed in Supabase Redirect URLs. Also request a new email because recovery links are short-lived.

### Email never arrives

Check spam and confirm Email Auth is enabled. Supabase's default email service is suitable for development but has sending limits. Configure a custom SMTP provider for production.

### Redirects to the wrong domain

The frontend builds the redirect from `window.location.origin`. Add every environment's origin to Supabase, including local development, Vercel preview, and the production domain.

### Password changed but login fails

Confirm the user exists in **Authentication -> Users** and use the same email address. Passwords are stored and checked by Supabase Auth, not `public.profiles`.
