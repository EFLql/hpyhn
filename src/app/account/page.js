import { Suspense } from 'react'
import { AccountClientPage } from './AccountClientPage' // Import the new client component

export default function AccountPageWrapper() {
  return (
    <Suspense fallback={<div>Loading account settings...</div>}>
      <AccountClientPage />
    </Suspense>
  )
}