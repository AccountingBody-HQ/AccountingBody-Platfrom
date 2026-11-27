'use client'

// The cookie page's simple, free ways to remove the practice and mock-exam
// progress kept on this device (lib/practice-store.ts), and to stop or start
// saving it. They change only those keys; no request is made.

import { useEffect, useState } from 'react'
import { clearPracticeData, deviceStorage, isPracticeSavingOff, setPracticeSavingOff, type StorageLike } from '@/lib/practice-store'

export const FORGET_BUTTON_TEXT = 'Forget my practice results on this device'
export const FORGET_DONE_TEXT = 'Your practice results on this device have been removed.'
export const FORGET_FAILED_TEXT = "This device's storage could not be changed. You can clear this website's data in your browser settings."
export const STOP_BUTTON_TEXT = 'Stop saving my practice results on this device'
export const START_BUTTON_TEXT = 'Start saving my practice results again'
export const STOP_DONE_TEXT = 'Your practice results will not be saved on this device, and the saved ones have been removed.'
export const START_DONE_TEXT = 'Your practice results will be saved on this device again.'

/** Clears the practice data and returns the line to show. */
export function forgetPracticeMessage(storage: StorageLike | null): string {
  return storage && clearPracticeData(storage) ? FORGET_DONE_TEXT : FORGET_FAILED_TEXT
}

/** Stops (off=true) or starts saving again and returns the line to show. */
export function savingChoiceMessage(storage: StorageLike | null, off: boolean): string {
  if (!storage || !setPracticeSavingOff(storage, off)) return FORGET_FAILED_TEXT
  return off ? STOP_DONE_TEXT : START_DONE_TEXT
}

export default function ForgetPracticeProgress() {
  const [message, setMessage] = useState('')
  // Read after mount; the server HTML shows "Stop saving…".
  const [off, setOff] = useState(false)
  useEffect(() => {
    const store = deviceStorage()
    setOff(!!store && isPracticeSavingOff(store))
  }, [])
  const toggle = () => {
    const store = deviceStorage()
    setMessage(savingChoiceMessage(store, !off))
    setOff(!!store && isPracticeSavingOff(store))
  }
  return (
    <div className="-mt-6 mb-10">
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => setMessage(forgetPracticeMessage(deviceStorage()))}
          className="inline-flex items-center h-10 px-5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-navy-300 transition-colors">
          {FORGET_BUTTON_TEXT}
        </button>
        <button type="button" onClick={toggle}
          className="inline-flex items-center h-10 px-5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-navy-300 transition-colors">
          {off ? START_BUTTON_TEXT : STOP_BUTTON_TEXT}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-3" aria-live="polite">{message}</p>
    </div>
  )
}
