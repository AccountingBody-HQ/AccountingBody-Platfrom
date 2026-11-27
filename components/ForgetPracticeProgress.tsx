'use client'

// The cookie page's simple, free way to remove the practice and mock-exam
// progress kept on this device (lib/practice-store.ts). It removes only
// those keys; no request is made.

import { useState } from 'react'
import { clearPracticeData, deviceStorage, type StorageLike } from '@/lib/practice-store'

export const FORGET_BUTTON_TEXT = 'Forget my practice results on this device'
export const FORGET_DONE_TEXT = 'Your practice results on this device have been removed.'
export const FORGET_FAILED_TEXT = "This device's storage could not be changed. You can clear this website's data in your browser settings."

/** Clears the practice data and returns the line to show. */
export function forgetPracticeMessage(storage: StorageLike | null): string {
  return storage && clearPracticeData(storage) ? FORGET_DONE_TEXT : FORGET_FAILED_TEXT
}

export default function ForgetPracticeProgress() {
  const [message, setMessage] = useState('')
  return (
    <div className="-mt-6 mb-10">
      <button type="button" onClick={() => setMessage(forgetPracticeMessage(deviceStorage()))}
        className="inline-flex items-center h-10 px-5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-navy-300 transition-colors">
        {FORGET_BUTTON_TEXT}
      </button>
      <p className="text-xs text-slate-500 mt-3" aria-live="polite">{message}</p>
    </div>
  )
}
