# BuildPCB.ai Authentication System

This implementation provides a passwordless authentication flow using email and 6-digit verification codes.

## Components

### AuthOverlay

The main authentication component with two views:

1. **Email Entry**: Users enter their email address
2. **Code Verification**: Users enter a 6-digit code sent to their email

### AuthGuard

Wraps components that require authentication and shows the auth overlay when needed.

### AuthButton

A button component that automatically triggers authentication if the user is not logged in.

## Usage

### 1. Basic Auth Overlay

```tsx
import { AuthOverlay } from "@/components/auth";

function MyComponent() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <button onClick={() => setShowAuth(true)}>Login</button>
      <AuthOverlay
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          console.log("User authenticated!");
          setShowAuth(false);
        }}
      />
    </>
  );
}
```

### 2. Protected Pages

```tsx
import { AuthGuard } from "@/components/auth";

export default function ProtectedPage() {
  return (
    <AuthGuard>
      <div>This content requires authentication</div>
    </AuthGuard>
  );
}
```

### 3. Auth Button

```tsx
import { AuthButton } from "@/components/auth";

function Toolbar() {
  return (
    <AuthButton
      className="btn-primary"
      onClick={() => console.log("User is authenticated!")}
    >
      Save Project
    </AuthButton>
  );
}
```

### 4. Using Auth Context

```tsx
import { useAuth } from "@/hooks/useAuth";

function UserProfile() {
  const { isAuthenticated, logout, showAuthOverlay } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={showAuthOverlay}>Login</button>;
  }

  return (
    <div>
      <p>Welcome back!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Routes

- `/login` - Dedicated login page with white background
- `/dashboard` - Protected route that triggers auth if not logged in

## Features

- ✅ Responsive design using the project's responsive utilities
- ✅ Email validation
- ✅ 6-digit code input with auto-focus
- ✅ Keyboard navigation (Tab, Enter, Backspace)
- ✅ Loading states
- ✅ Error handling
- ✅ Backdrop blur effect
- ✅ Accessibility support
- ✅ DM Sans font integration

## Styling

The components use the exact specifications from your design:

- Email view: 331×289px container
- Code view: 331×346px container
- Proper border radius (20px)
- Correct colors (#A6A6A6 border, #FAFAFAF2 backgrounds)
- DM Sans font for terms text
- Responsive scaling using your responsive utility functions

## Demo

Visit `http://localhost:3001` to see the auth system in action:

- Click the blue "Login Required" button to trigger the auth overlay
- Visit `/dashboard` to see protected route behavior
- Visit `/login` for the dedicated login page
