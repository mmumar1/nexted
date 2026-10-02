# How to Integrate Firebase Authentication for User Management

This guide explains how to replace the existing custom registration and login logic in your React project with Firebase Authentication, as referenced from the `client/src/pages/register.tsx` file in the AT-school codebase.

---

## 1. Set Up Firebase in Your Project

- **Install Firebase SDK:**

  ```bash
  npm install firebase
  ```

- **Initialize Firebase:**

  Create a file like `src/lib/firebase.ts`:

  ```ts
  import { initializeApp } from "firebase/app";
  import { getAuth } from "firebase/auth";

  const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // other config fields
  };

  const app = initializeApp(firebaseConfig);
  export const auth = getAuth(app);
  ```

---

## 2. Update Registration Logic

Replace your registration API call with Firebase's registration flow:

```ts
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

const onSubmit = async (data: InsertUser) => {
  setIsLoading(true);
  setError("");

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    // Optionally save the full name
    await updateProfile(userCredential.user, { displayName: data.fullName });
    toast({
      title: "Account created successfully!",
      description: "Please login to continue.",
    });
    setLocation("/login");
  } catch (err: any) {
    setError(err.message || "Registration failed. Please try again.");
  } finally {
    setIsLoading(false);
  }
};
```

---

## 3. Update Login Logic

```ts
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

const onSubmit = async (data) => {
  setIsLoading(true);
  setError("");
  try {
    await signInWithEmailAndPassword(auth, data.email, data.password);
    setLocation("/dashboard");
  } catch (err: any) {
    setError(err.message || "Login failed.");
  } finally {
    setIsLoading(false);
  }
};
```

---

## 4. User Management State

- Use `onAuthStateChanged` from Firebase to listen for authentication changes and manage the user's login state throughout your React app.
- For storing additional user profile info (like `fullName`), use Firestore linked with the authenticated user's UID.

---

## Summary
- Remove calls to your custom `/api/auth/register` and `/api/auth/login` endpoints, and swap in Firebase Auth methods.
- Handle user authentication state in your context/provider with Firebase listeners.
- Optionally, store user profile data in Firebase Firestore for richer user info management.

---

_Keep this file for quick reference when integrating Firebase Auth into your project!_