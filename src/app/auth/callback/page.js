'use client'

export default function AuthCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-orange-500 font-medium">Processing authentication...</p>
      </div>
    </div>
  )
}