interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="absolute top-0 left-0 w-screen h-screen flex flex-col">
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center pt-24 md:pt-32">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="mt-4 text-body-lg text-neutral">{message}</p>
      </main>
    </div>
  )
} 