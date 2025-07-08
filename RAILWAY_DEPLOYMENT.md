# Railway Deployment Guide

This guide will help you deploy the Doccelerate application to Railway, including the FastAPI backend, Next.js frontend, and Celery worker.

## Prerequisites

1. [Railway account](https://railway.app/)
2. [Railway CLI](https://docs.railway.com/develop/cli) installed
3. Your code pushed to a Git repository (GitHub, GitLab, etc.)

## Required Services

Before deploying, you'll need to provision these services in Railway:

### 1. PostgreSQL Database
```bash
railway add postgresql
```

### 2. Redis
```bash
railway add redis
```

## Environment Variables

Set up the following environment variables in your Railway project:

### Required Variables
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon public key  
- `SUPABASE_KEY` - Your Supabase service role key
- `OPENAI_API_KEY` - Your OpenAI API key
- `NEXTAUTH_SECRET` - Random secret for NextAuth (generate with `openssl rand -base64 32`)
- `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret

### Auto-configured Variables
These are automatically set by Railway when you add the services:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

## Deployment Steps

### 1. Create a New Project
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Empty Project"

### 2. Deploy Each Service Separately

#### 2.1 Deploy API Service
1. Click "New" → "GitHub Repo"
2. Select your repository
3. Set **Root Directory** to `api`
4. Railway will detect Python and use the `api/railway.toml` configuration
5. Name the service "api"

#### 2.2 Deploy Web Service
1. Click "New" → "GitHub Repo" 
2. Select the same repository
3. Set **Root Directory** to `web`
4. Railway will detect Node.js and use the `web/railway.toml` configuration  
5. Name the service "web"

#### 2.3 Deploy Celery Worker (Decoupled)
1. Click "New" → "GitHub Repo"
2. Select the same repository  
3. Set **Root Directory** to `api`
4. **Option A - Python Script** (Recommended):
   - Override start command: `uv run python worker.py`
5. **Option B - Shell Script** (With more logging):
   - Override start command: `./start_worker.sh`
6. **Option C - Direct Celery** (Traditional):
   - Override start command: `uv run celery -A app.tasks.celery_app worker --loglevel=info`
7. Add environment variable: `C_FORCE_ROOT=1`
8. Name the service "celery-worker"

**Note**: The worker runs completely independently from the API service.

### 3. Add Database and Redis
1. Click "New" in your project
2. Add PostgreSQL database
3. Add Redis database
4. These will automatically populate `DATABASE_URL` and `REDIS_URL`

### 4. Set Environment Variables
Add these variables to **all services** (api, web, celery-worker):

#### Shared Variables:
- `DATABASE_URL` - (Auto-set by PostgreSQL service)
- `REDIS_URL` - (Auto-set by Redis service)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `SUPABASE_KEY`
- `OPENAI_API_KEY`

#### Web Service Only:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` - Set to your web service domain
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL` - Set to your api service domain
- `NEXT_PUBLIC_SUPABASE_URL` - Same as `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Same as `SUPABASE_ANON_KEY`

#### Celery Worker Only:
- `C_FORCE_ROOT=1`

### 5. Configure GitHub OAuth
1. Go to GitHub Developer Settings
2. Create a new OAuth App with:
   - **Homepage URL**: `https://your-web-service.railway.app`
   - **Callback URL**: `https://your-web-service.railway.app/api/auth/callback/github`
3. Copy Client ID and Secret to Railway environment variables

### 6. Deploy
Railway will automatically deploy when you push to your main branch. You can also trigger manual deployments from the dashboard.

## Service Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Web      │    │     API     │    │   Celery    │
│  (Next.js)  │───▶│  (FastAPI)  │    │   Worker    │
│   Port 3000 │    │   Port 8000 │    │ (Decoupled) │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ PostgreSQL  │    │    Redis    │
                   │ (Database)  │    │ (Broker +   │
                   │             │    │  Backend)   │
                   └─────────────┘    └─────────────┘
```

**Decoupled Architecture Benefits:**
- ✅ **API and Worker are independent** - API doesn't start/manage Celery
- ✅ **Better reliability** - Worker crashes don't affect API
- ✅ **Easier scaling** - Scale API and Worker separately  
- ✅ **Cleaner logs** - Separate log streams for debugging

## Troubleshooting

### Build Issues

**Prisma Client Issues:**
```bash
# If Prisma client fails to generate, ensure both api and web have:
npx prisma generate
```

**UV/Python Issues:**
```bash
# Make sure uv is properly installed in the build process
uv sync --frozen
```

### Runtime Issues

**Celery Worker Not Processing Tasks:**
- Check that `REDIS_URL` is set correctly
- Verify `C_FORCE_ROOT=1` is set for the celery-worker service
- Check celery-worker logs in Railway dashboard

**NextAuth Errors:**
- Ensure `NEXTAUTH_URL` matches your web service domain
- Verify `NEXTAUTH_SECRET` is set and secure
- Check GitHub OAuth callback URL configuration

**Database Connection Issues:**
- Verify `DATABASE_URL` is automatically set by Railway
- Check if database service is running
- Ensure Prisma migrations are applied

### Logs and Monitoring

Access logs for each service in the Railway dashboard:
1. Go to your project
2. Click on a service
3. Navigate to "Logs" tab

## Local Development (Decoupled)

For local development with decoupled services:

### Option 1: Run Services Separately
```bash
# Terminal 1 - API
make api

# Terminal 2 - Web  
make web

# Terminal 3 - Celery Worker
make celery-worker
```

### Option 2: Run All Together
```bash
# Run API, Web, and Worker concurrently
make up-all
```

### Option 3: API + Web Only (no background tasks)
```bash
# Run just API and Web
make up
```

## Post-Deployment Setup

1. **Run Database Migrations:**
   ```bash
   railway run npx prisma db push
   ```

2. **Verify Services:**
   - API health check: `https://your-api-service.railway.app/api/v1/health/`
   - Web application: `https://your-web-service.railway.app`

3. **Test Celery Tasks:**
   - Create a query through the web interface
   - Check celery-worker logs for task processing in Railway dashboard

## Scaling

Railway automatically handles scaling based on usage. For high-traffic applications:

1. **Horizontal Scaling:** Railway can automatically scale your services
2. **Resource Limits:** Monitor resource usage in the dashboard
3. **Database:** Consider upgrading PostgreSQL plan for larger datasets

## Custom Domain

To use a custom domain:
1. Go to service settings in Railway
2. Add your domain in "Domains" section
3. Configure DNS records as instructed

## Environment-Specific Configuration

Each service has its own `railway.toml` file:
- `api/railway.toml` - FastAPI backend configuration
- `web/railway.toml` - Next.js frontend configuration

You can override variables per environment in Railway dashboard under the "Variables" tab.

## Support

- [Railway Documentation](https://docs.railway.com/)
- [Railway Discord](https://discord.gg/railway)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs) 