import { authMiddleware } from '@clerk/nextjs/server'

export default authMiddleware({
  publicRoutes: [
    '/',
    '/study(.*)',
    '/articles(.*)',
    '/practice-questions(.*)',
    '/pricing',
    '/about',
    '/contact',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/subscribe',
    '/api/contact',
  ],
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
