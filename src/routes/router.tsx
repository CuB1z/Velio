import { Route, Routes } from 'react-router-dom'

import { RedirectIfAuthenticated, RequireAuth } from '@/auth/requireAuth'
import { AppShell } from '@/components/layout/appShell'
import { AccountPage } from '@/pages/account'
import { AnalyzePage } from '@/pages/analyze'
import { ForgotPasswordPage } from '@/pages/auth/forgotPassword'
import { LoginPage } from '@/pages/auth/login'
import { OAuthCallbackPage } from '@/pages/auth/oauthCallback'
import { RegisterPage } from '@/pages/auth/register'
import { ResetPasswordPage } from '@/pages/auth/resetPassword'
import { VerifyEmailPage } from '@/pages/auth/verifyEmail'
import { LandingPage } from '@/pages/landing'
import { LoopPlannerPage } from '@/pages/loopPlanner'
import { NotFoundPage } from '@/pages/notFound'
import { RoutePlannerPage } from '@/pages/routePlanner'
import { SavedRouteDetailPage } from '@/pages/savedRouteDetail'
import { SavedRoutesPage } from '@/pages/savedRoutes'

export function AppRouter() {
  return (
    <Routes>
      {/* Portada pública. Con sesión abierta redirige al planificador. */}
      <Route path="/" element={<LandingPage />} />

      {/* Acceso: quien ya tiene sesión no debería ver estas pantallas. */}
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* La vuelta de OAuth entra sin sesión y la crea. */}
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      {/* Los endpoints de cálculo exigen Bearer: la app va entera tras el login. */}
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
