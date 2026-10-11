import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { RedirectIfAuthenticated, RequireAuth } from '@/auth/requireAuth'
import { AppShell } from '@/components/layout/appShell'
import { ForgotPasswordPage } from '@/pages/auth/forgotPassword'
import { LoginPage } from '@/pages/auth/login'
import { OAuthCallbackPage } from '@/pages/auth/oauthCallback'
import { RegisterPage } from '@/pages/auth/register'
import { ResetPasswordPage } from '@/pages/auth/resetPassword'
import { VerifyEmailPage } from '@/pages/auth/verifyEmail'
import { LandingPage } from '@/pages/landing'

const AccountPage = lazy(() => import('@/pages/account').then((m) => ({ default: m.AccountPage })))
const AnalyzePage = lazy(() => import('@/pages/analyze').then((m) => ({ default: m.AnalyzePage })))
const LoopPlannerPage = lazy(() => import('@/pages/loopPlanner').then((m) => ({ default: m.LoopPlannerPage })))
const NotFoundPage = lazy(() => import('@/pages/notFound').then((m) => ({ default: m.NotFoundPage })))
const RoutePlannerPage = lazy(() => import('@/pages/routePlanner').then((m) => ({ default: m.RoutePlannerPage })))
const SavedRouteDetailPage = lazy(() =>
  import('@/pages/savedRouteDetail').then((m) => ({ default: m.SavedRouteDetailPage })),
)
const SavedRoutesPage = lazy(() => import('@/pages/savedRoutes').then((m) => ({ default: m.SavedRoutesPage })))

export function AppRouter() {
  return (
    <Routes>
      {/* Public landing page. */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth screens, hidden from signed-in users. */}
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* The OAuth callback arrives without a session and creates it. */}
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      {/* Routing endpoints require a Bearer token, so the whole app sits behind login. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="loops" element={<LoopPlannerPage />} />
          <Route path="routes" element={<RoutePlannerPage />} />
          <Route path="analyze" element={<AnalyzePage />} />
          <Route path="saved" element={<SavedRoutesPage />} />
          <Route path="saved/:id" element={<SavedRouteDetailPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
