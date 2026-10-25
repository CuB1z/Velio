import { lazy, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { RedirectIfAuthenticated, RequireAuth } from '@/auth/requireAuth'
import { AppShell } from '@/components/layout/appShell'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@/i18n'
import { swapLang } from '@/lib/paths'
import { ForgotPasswordPage } from '@/pages/auth/forgotPassword'
import { LoginPage } from '@/pages/auth/login'
import { OAuthCallbackPage } from '@/pages/auth/oauthCallback'
import { RegisterPage } from '@/pages/auth/register'
import { ResetPasswordPage } from '@/pages/auth/resetPassword'
import { VerifyEmailPage } from '@/pages/auth/verifyEmail'
import { LandingPage } from '@/pages/landing'
import { PrivacyPage } from '@/pages/legal/privacy'
import { TermsPage } from '@/pages/legal/terms'

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
      {LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE).map((lang) => (
        <Route key={lang} path={lang} element={<LanguageRoute lang={lang} />}>
          {appRoutes()}
        </Route>
      ))}
      <Route path={`${DEFAULT_LANGUAGE}/*`} element={<DefaultPrefixRedirect />} />
      <Route element={<LanguageRoute lang={DEFAULT_LANGUAGE} />}>{appRoutes()}</Route>
    </Routes>
  )
}

function appRoutes() {
  return (
    <>
      {/* Public landing page. */}
      <Route index element={<LandingPage />} />
      <Route path="privacy" element={<PrivacyPage />} />
      <Route path="terms" element={<TermsPage />} />

      {/* Auth screens, hidden from signed-in users. */}
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* The OAuth callback arrives without a session and creates it. */}
      <Route path="oauth/callback" element={<OAuthCallbackPage />} />

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
    </>
  )
}

function LanguageRoute({ lang }: { lang: Language }) {
  const { i18n } = useTranslation()

  useLayoutEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
  }, [i18n, lang])

  return <Outlet />
}

function DefaultPrefixRedirect() {
  const { pathname, search, hash, state } = useLocation()

  return <Navigate to={`${swapLang(pathname, DEFAULT_LANGUAGE)}${search}${hash}`} replace state={state} />
}
