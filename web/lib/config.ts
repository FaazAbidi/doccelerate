/**
 * Configuration utility for the web application
 * This file manages environment variables and provides type-safe access to configuration values
 */

export const config = {
  // API Configuration
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  apiPrefix: '/api/v1',
  
  // App Configuration
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Doccelerate',
  
  // Supabase Configuration
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
  
  // Derived URLs
  get apiBaseUrl() {
    return `${this.apiUrl}${this.apiPrefix}`;
  },
  
  // API Endpoints
  endpoints: {
    health: '/health',
    users: '/users',
    documents: '/documents',
  },
  
  // UI Configuration
  ui: {
    itemsPerPage: 10,
  },
} as const;

export type Config = typeof config; 