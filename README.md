# Doccelerate - Supabase + Prisma Integration

A modern document acceleration platform built with FastAPI (Python) and Next.js (TypeScript), connected to Supabase using Prisma ORM.

## 🚀 Features

- **FastAPI Backend** - High-performance Python API with automatic OpenAPI documentation
- **Next.js Frontend** - Modern React framework with TypeScript support
- **Supabase Database** - PostgreSQL database with real-time capabilities
- **Prisma ORM** - Type-safe database access for both Python and TypeScript
- **Shared Database Schema** - Synchronized types across frontend and backend

## 🛠️ Setup

### Prerequisites

- Python 3.13+
- Node.js 18+
- uv (Python package manager)
- npm (Node.js package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd doccelerate
   ```

2. **Set up environment variables**
   ```bash
   cp .env.sample .env
   # Edit .env with your actual Supabase credentials
   ```

3. **Install dependencies**
   ```bash
   # Install API dependencies
   cd api && uv sync
   
   # Install Web dependencies
   cd ../web && npm install
   ```

4. **Set up Prisma**
   ```bash
   # Sync database schema and generate clients
   make db-sync
   ```

## 🗄️ Database Management

The project includes convenient Makefile commands for managing your Supabase database:

```bash
# Pull latest schema from Supabase (both API and Web)
make db-pull

# Generate Prisma clients (both API and Web)
make db-generate

# Full sync: pull schema + generate clients
make db-sync

# Individual commands
make db-pull-api      # Pull schema for API only
make db-pull-web      # Pull schema for Web only
make db-generate-api  # Generate API client only
make db-generate-web  # Generate Web client only
```

## 🏃 Running the Application

### Development Mode

```bash
# Start both API and Web concurrently
make up

# Or start individually
make api  # Starts API on http://localhost:8000
make web  # Starts Web on http://localhost:3000
```

### API Endpoints

- **Health Check**: `GET /api/v1/health`
- **Users**: `GET /api/v1/users`
- **API Documentation**: `GET /api/v1/docs`

### Web Pages

- **Home**: `http://localhost:3000`
- **Users**: `http://localhost:3000/users`

## 📁 Project Structure

```
doccelerate/
├── api/                     # FastAPI backend
│   ├── app/
│   │   ├── database.py     # Prisma database configuration
│   │   ├── endpoints/      # API route handlers
│   │   └── schemas/        # Pydantic models
│   ├── prisma/
│   │   └── schema.prisma   # Database schema (Python)
│   └── main.py            # FastAPI app entry point
├── web/                    # Next.js frontend
│   ├── app/
│   │   ├── users/         # Users page
│   │   └── page.tsx       # Home page
│   ├── lib/
│   │   ├── prisma.ts      # Prisma client configuration
│   │   └── generated/     # Generated Prisma client
│   └── prisma/
│       └── schema.prisma  # Database schema (TypeScript)
├── .env                   # Environment variables
└── Makefile              # Development commands
```

## 🔧 Configuration

### Environment Variables

The application uses the following environment variables:

```env
# Database Configuration
DATABASE_URL="postgresql://..."     # Supabase connection pooling URL
DIRECT_URL="postgresql://..."       # Direct database connection

# API Configuration
API_PREFIX="/api/v1"
ALLOWED_ORIGINS=["http://localhost:3000"]

# Web Configuration
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_APP_NAME="Doccelerate"
```

### Prisma Configuration

Both API and Web use Prisma with:
- **Multi-schema support** for `public` and `auth` schemas
- **Type-safe database access**
- **Automatic client generation**
- **Connection pooling** via Supabase

## 📚 Usage Examples

### API Usage (Python)

```python
from app.database import prisma

# Fetch users
profiles = await prisma.profile.find_many(
    take=10,
    order_by={'created_at': 'desc'}
)

# Create user
profile = await prisma.profile.create(
    data={
        'email': 'user@example.com',
        'full_name': 'John Doe'
    }
)
```

### Web Usage (TypeScript)

```typescript
import { prisma } from '@/lib/prisma'

// Fetch users (Server Component)
const profiles = await prisma.profile.findMany({
  take: 10,
  orderBy: { created_at: 'desc' }
})

// Use in component
export default function UsersPage() {
  return (
    <div>
      {profiles.map(profile => (
        <div key={profile.id}>
          <h2>{profile.full_name}</h2>
          <p>{profile.email}</p>
        </div>
      ))}
    </div>
  )
}
```

## 🔄 Database Schema Updates

When your Supabase schema changes:

1. **Pull the latest schema**:
   ```bash
   make db-pull
   ```

2. **Generate new clients**:
   ```bash
   make db-generate
   ```

3. **Or do both at once**:
   ```bash
   make db-sync
   ```

## 🚀 Deployment

### API Deployment

The API is ready for deployment on platforms like:
- **Vercel** (recommended)
- **Railway**
- **Heroku**
- **AWS Lambda**

### Web Deployment

The Next.js app is ready for deployment on:
- **Vercel** (recommended)
- **Netlify**
- **AWS Amplify**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `make db-sync` to ensure schema is up to date
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 