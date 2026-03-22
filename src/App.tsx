import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import DayView from './components/DayView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import { StravaCallback } from './components/StravaCallback';

export default function App() {
  const { user, needsOnboarding, loading, refresh } = useAuth();

  // Full-screen loading spinner
  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" aria-busy="true">
        <div className="w-12 h-12 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
      </main>
    );
  }

  // Not authenticated
  if (!user) {
    return <AuthScreen />;
  }

  // Authenticated but no profile yet
  if (needsOnboarding) {
    return <Onboarding onComplete={refresh} />;
  }

  // Authenticated + has profile
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DayView />} />
        <Route path="/history" element={<HistoryView />} />
        <Route path="/settings" element={<SettingsView onSignOut={refresh} />} />
        <Route path="/callback" element={<StravaCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
