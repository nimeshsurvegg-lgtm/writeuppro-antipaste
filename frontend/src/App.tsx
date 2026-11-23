import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, Bell, LogOut, Shield, Award, GraduationCap, CheckCircle,
  AlertCircle, X, ChevronRight, Lock, User as UserIcon
} from 'lucide-react';
import { api, setAuthToken, removeAuthToken, getAuthToken } from './lib/api';
import { User, AppNotification } from './types';
import { StudentWorkspace } from './components/StudentWorkspace';
import { DocumentEditor } from './components/DocumentEditor';
import { FacultyWorkspace } from './components/FacultyWorkspace';
import { AdminWorkspace } from './components/AdminWorkspace';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [activeDocId, setActiveDocId] = useState<string | null | undefined>(undefined);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('student');
  const [password, setPassword] = useState('password');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [authLoading, setAuthLoading] = useState(false);

  // Initialize theme and current session
  useEffect(() => {
    const savedTheme = localStorage.getItem('writeuppro_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const token = getAuthToken();
    if (token) {
      loadCurrentUser();
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('writeuppro_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('writeuppro_theme', 'light');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const loadCurrentUser = async () => {
    try {
      const user = await api.auth.me();
      setCurrentUser(user);
      loadNotifications();
    } catch {
      removeAuthToken();
      setCurrentUser(null);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await api.notifications.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setAuthLoading(true);
      const res = await api.auth.login(username, password);
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      showToast(`Authenticated as ${res.user.full_name}`, 'success');
      loadNotifications();
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthLoading(true);
      const res = await api.auth.register({
        username,
        email,
        full_name: fullName,
        password,
        role,
      });
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      showToast('Registration successful! Welcome to WriteUp Pro.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickLogin = async (roleName: 'student' | 'faculty' | 'admin') => {
    setUsername(roleName);
    setPassword('password');
    try {
      setAuthLoading(true);
      const res = await api.auth.login(roleName, 'password');
      setAuthToken(res.access_token);
      setCurrentUser(res.user);
      setActiveDocId(undefined);
      showToast(`Authenticated as ${res.user.full_name}`, 'success');
      loadNotifications();
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setActiveDocId(undefined);
    showToast('Logged out successfully.', 'info');
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await api.notifications.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-200">
      {/* Toast Notification Container */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in slide-in-from-right duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-900/90 text-white border-emerald-700'
                : t.type === 'error'
                ? 'bg-rose-900/90 text-white border-rose-700'
                : 'bg-slate-900/90 text-white border-slate-700'
            }`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-white/60 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/20">
            W
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              WriteUp <span className="text-indigo-600 dark:text-indigo-400">Pro</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                Enterprise v2.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
              Imperial Institute Academic Writing & Integrity Management
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <>
              {/* Notifications Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Notifications</span>
                      <button
                        onClick={handleMarkNotificationsRead}
                        className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No notifications yet.</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl text-xs border ${
                              n.is_read
                                ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-500'
                                : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-slate-200 font-medium'
                            }`}
                          >
                            <p className="font-bold text-[11px] mb-0.5">{n.title}</p>
                            <p className="text-[10px] opacity-80 leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                  {currentUser.full_name.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {currentUser.full_name}
                  </p>
                  <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    {currentUser.role}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Theme Switcher */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1">
        {!currentUser ? (
          /* Authentication Screen with Jury Testing Panel */
          <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl">
            {/* Jury Quick Test Actions */}
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 mb-6">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 block mb-2">
                ⚡ Quick Role Evaluation (Password: password)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('student')}
                  className="px-2 py-2 bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-900 dark:text-indigo-200 rounded-xl font-bold text-xs shadow-sm border border-indigo-200 dark:border-indigo-700 transition-all text-center"
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('faculty')}
                  className="px-2 py-2 bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-900 dark:text-indigo-200 rounded-xl font-bold text-xs shadow-sm border border-indigo-200 dark:border-indigo-700 transition-all text-center"
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin')}
                  className="px-2 py-2 bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-900 dark:text-indigo-200 rounded-xl font-bold text-xs shadow-sm border border-indigo-200 dark:border-indigo-700 transition-all text-center"
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {isRegister ? 'Register Account' : 'Sign in to WriteUp Pro'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your credentials to access the academic workspace.
              </p>
            </div>

            <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Institutional Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@writeuppro.edu"
                      className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Account Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, faculty, or student"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 mt-2 transition-transform active:scale-[0.98]"
              >
                {authLoading ? 'Verifying...' : isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>
          </div>
        ) : activeDocId !== undefined ? (
          /* Document Authoring Editor */
          <DocumentEditor
            docId={activeDocId}
            currentUser={currentUser}
            onBack={() => setActiveDocId(undefined)}
            onSubmitted={() => setActiveDocId(undefined)}
            showToast={showToast}
          />
        ) : currentUser.role === 'student' ? (
          /* Student Workspace */
          <StudentWorkspace
            currentUser={currentUser}
            onOpenEditor={(id) => setActiveDocId(id)}
            showToast={showToast}
            onProfileUpdated={loadCurrentUser}
          />
        ) : currentUser.role === 'faculty' ? (
          /* Faculty Workspace */
          <FacultyWorkspace currentUser={currentUser} showToast={showToast} />
        ) : (
          /* Administrator Control Center */
          <AdminWorkspace currentUser={currentUser} showToast={showToast} />
        )}
      </main>
    </div>
  );
};
export default App;
