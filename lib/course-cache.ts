// Refreshes the public course caches after a course write that succeeded
// (the tags are set in lib/coursesNew.ts). Call it only after the write.
//
// 'courses' covers the course list and every cached course and lesson page
// (each also carries 'course:<slug>'), so one tag is enough.
//
// Never throws: the write is already done, so a refresh that fails must not
// turn a success into an error. The caches then expire on their own (1 hour).

import { revalidateTag } from 'next/cache'
import { reportServerError } from './report-error'

export function refreshCourseCaches(): void {
  try {
    revalidateTag('courses')
  } catch (error) {
    console.error('course cache refresh failed')
    reportServerError('admin course cache refresh failed', error, { area: 'admin' })
  }
}
