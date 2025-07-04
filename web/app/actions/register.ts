'use server'

import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export async function registerUser(formData: FormData) {
  const rawFormData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  // Validate form data
  const result = registerSchema.safeParse(rawFormData)
  if (!result.success) {
    return {
      error: result.error.errors[0].message,
    }
  }

  const { name, email, password } = result.data
  const supabase = await createSupabaseServerClient()

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) {
      return {
        error: error.message,
      }
    }

    // Return success - the client will handle NextAuth sign in
    return {
      success: true,
      email,
      requiresConfirmation: data.user && !data.user.email_confirmed_at,
    }
  } catch (error) {
    return {
      error: 'An unexpected error occurred',
    }
  }
} 