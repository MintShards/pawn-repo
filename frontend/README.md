# Pawn Shop Management Frontend

React frontend application for the pawn shop management system, built with ShadCN UI components.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Update `.env` with your backend API URL:
```
REACT_APP_API_URL=http://localhost:8000
```

### 3. Start Development Server
```bash
npm start
```

The application will be available at http://localhost:3000

## Features

### ✅ Implemented
- **Professional Login Interface** with ShadCN UI components
- **PIN-based Authentication** (2-digit User ID + 4-digit PIN)
- **Form Validation** using Zod schema validation
- **JWT Token Management** with automatic token verification
- **Protected Routes** with authentication guards
- **Responsive Design** optimized for desktop and tablet
- **Professional Styling** with Tailwind CSS and ShadCN design system
- **Error Handling** with user-friendly error messages
- **Loading States** for better UX during authentication

### 🚧 Next Steps
- Customer management interface
- Pawn transaction management
- Payment processing
- Receipt generation
- Dashboard analytics
- Mobile optimization

## Authentication

### Demo Credentials
**Admin User:**
- User ID: `69`
- PIN: `6969`

**Staff User:**
- User ID: `02`
- PIN: `1234`

### Authentication Flow
1. User enters 2-digit User ID and 4-digit PIN
2. Frontend validates input format with Zod schema
3. Credentials sent to `/api/v1/auth/jwt/login` endpoint
4. JWT token stored in localStorage as `pawn_shop_token`
5. Protected routes require valid token for access
6. Automatic token verification on app initialization

## Project Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.jsx          # Login form with validation
│   │   └── ProtectedRoute.jsx     # Route protection wrapper
│   └── ui/                        # ShadCN UI components
│       ├── button.jsx
│       ├── input.jsx
│       ├── card.jsx
│       ├── form.jsx
│       ├── label.jsx
│       └── alert.jsx
├── context/
│   └── AuthContext.jsx            # Authentication state management
├── pages/
│   ├── LoginPage.jsx              # Login page component
│   └── DashboardPage.jsx          # Main dashboard (placeholder)
├── services/
│   └── authService.js             # API authentication service
├── lib/
│   └── utils.js                   # Utility functions
└── App.js                         # Main app with routing
```

## Technology Stack

- **React 19.1.1** - Frontend framework
- **React Router Dom 6.21.3** - Client-side routing
- **React Hook Form 7.49.3** - Form handling
- **Zod 3.22.4** - Schema validation
- **ShadCN UI** - Component library
- **Tailwind CSS 3.4.1** - Styling framework
- **Radix UI** - Headless UI components

## Development Commands

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Backend Integration

The frontend is configured to work with the FastAPI backend:

### API Endpoints Used
- `POST /api/v1/auth/jwt/login` - User authentication
- `GET /api/v1/auth/jwt/verify` - Token verification
- `GET /api/v1/user/me` - Get current user data

### Error Handling
- Network errors with user-friendly messages
- Invalid credentials with specific error display
- Token expiration with automatic logout
- API validation errors with form field highlighting

## Security Features

- **Input Validation** - Client-side validation with Zod schemas
- **Secure Token Storage** - JWT tokens in localStorage
- **Route Protection** - Automatic redirect for unauthenticated users
- **Token Verification** - Automatic token validation on app load
- **Error Boundary** - Graceful error handling throughout the app

## Getting Started with Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)
