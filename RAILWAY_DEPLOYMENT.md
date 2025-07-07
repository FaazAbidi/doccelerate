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

### 1. Connect Your Repository
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Configure Services
Railway will automatically detect the `railway.toml` configuration and set up three services:
- **api** - FastAPI backend
- **web** - Next.js frontend  
- **celery-worker** - Background task processor

### 3. Set Environment Variables
1. Go to each service in Railway dashboard
2. Navigate to "Variables" tab
3. Add the required environment variables listed above

### 4. Add Database and Redis
1. Click "New" in your project
2. Add PostgreSQL database
3. Add Redis database
4. These will automatically populate `DATABASE_URL` and `REDIS_URL`

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
│  (Next.js)  │───▶│  (FastAPI)  │───▶│   Worker    │
│   Port 3000 │    │   Port 8000 │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ PostgreSQL  │    │    Redis    │
                   │ (Database)  │    │  (Broker)   │
                   └─────────────┘    └─────────────┘
```

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
   - Check celery-worker logs for task processing

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

The `railway.toml` includes environment-specific variables. You can override these per environment:

```toml
[environments.staging.variables]
NODE_ENV = "staging"
```

## Support

- [Railway Documentation](https://docs.railway.com/)
- [Railway Discord](https://discord.gg/railway)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs) 