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

  const showToast = (message: any, type: 'success' | 'error' | 'info' = 'success') => {
    let msgStr = 'Operation completed';
    if (typeof message === 'string') {
      msgStr = message;
    } else if (message?.message) {
      msgStr = String(message.message);
    } else if (message?.detail) {
      msgStr = typeof message.detail === 'string' ? message.detail : JSON.stringify(message.detail);
    } else if (message !== null && typeof message === 'object') {
      msgStr = JSON.stringify(message);
    } else {
      msgStr = String(message);
    }
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message: msgStr, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
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
    <div className="min-h-screen bg-[#FBF9F3] dark:bg-[#14110E] text-[#1A1209] dark:text-[#F7F3E9] font-sans flex flex-col transition-colors duration-200">
      {/* Toast Notification Container */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 border-2 border-[#1A1209] shadow-[3.5px_3.5px_0px_#1A1209] text-xs font-mono font-bold flex items-center justify-between gap-3 animate-in slide-in-from-right duration-150 ${
              t.type === 'success'
                ? 'bg-[#1F5A2E] text-white'
                : t.type === 'error'
                ? 'bg-[#8B1A1A] text-white'
                : 'bg-[#1A1209] text-white'
            }`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-white/70 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1D1814]/95 backdrop-blur-sm border-b-2 border-[#1A1209] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1A1209] text-[#FBF9F3] border-2 border-[#1A1209] shadow-[2.5px_2.5px_0px_#B84915] flex items-center justify-center font-black text-lg select-none">
            W
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#1A1209] dark:text-[#F7F3E9] flex items-center gap-2">
              WriteUp <span className="text-[#B84915] dark:text-[#E0651E]">Pro</span>
              <span className="stamp-badge bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9]">
                Enterprise v2.0
              </span>
            </h1>
            <p className="text-[11px] font-medium text-[#786958] dark:text-[#A89886] hidden sm:block">
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
                  className="neo-btn p-2 bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9] relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#8B1A1A] border border-[#1A1209] rounded-none" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[5px_5px_0px_#1A1209] p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-[#1A1209] mb-2 font-mono">
                      <span className="text-xs font-bold text-[#1A1209] dark:text-[#F7F3E9] uppercase tracking-wider">
                        DISPATCH LOG // {notifications.length}
                      </span>
                      <button
                        onClick={handleMarkNotificationsRead}
                        className="text-[10px] font-bold text-[#B84915] dark:text-[#E0651E] hover:underline uppercase"
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs font-mono text-[#786958] text-center py-4">No new dispatches.</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 text-xs border border-[#1A1209] ${
                              n.is_read
                                ? 'bg-[#F4EFE6] dark:bg-[#26201B] text-[#786958]'
                                : 'bg-[#FFF9EE] dark:bg-[#332B24] border-[#1A1209] text-[#1A1209] dark:text-[#F7F3E9] font-medium'
                            }`}
                          >
                            <p className="font-bold text-[11px] mb-0.5 font-mono">{n.title}</p>
                            <p className="text-[10px] leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 pl-3 border-l-2 border-[#1A1209]">
                <div className="w-8 h-8 bg-[#1A365D] text-white font-bold flex items-center justify-center text-xs border border-[#1A1209]">
                  {currentUser.full_name.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-[#1A1209] dark:text-white leading-tight">
                    {currentUser.full_name}
                  </p>
                  <span className="stamp-badge py-0 text-[9px] bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#D4C7B5]">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="neo-btn p-2 bg-[#F4EFE6] dark:bg-[#26201B] hover:bg-[#8B1A1A] hover:text-white text-[#1A1209] dark:text-[#F7F3E9] transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Theme Switcher */}
          <button
            onClick={toggleDarkMode}
            className="neo-btn p-2 bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9]"
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
          <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209]">
            {/* Jury Quick Test Actions */}
            <div className="bg-[#F4EFE6] dark:bg-[#26201B] border-2 border-[#1A1209] p-3.5 mb-6 shadow-[3px_3px_0px_#1A1209]">
              <span className="font-mono text-[10px] font-bold tracking-widest text-[#B84915] uppercase block mb-2">
                ⚡ Quick Role Evaluation (Password: password)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('student')}
                  className="neo-btn py-2 px-2 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] text-xs hover:bg-[#B84915] hover:text-white"
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('faculty')}
                  className="neo-btn py-2 px-2 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] text-xs hover:bg-[#B84915] hover:text-white"
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin')}
                  className="neo-btn py-2 px-2 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] text-xs hover:bg-[#B84915] hover:text-white"
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="text-center mb-6">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#786958] dark:text-[#A89886] block mb-1">
                INSTITUTIONAL GATEWAY // AUTHORIZED ACCESS
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[#1A1209] dark:text-white">
                {isRegister ? 'Register Academic Account' : 'Sign in to WriteUp Pro'}
              </h2>
              <p className="text-xs text-[#5C4D3C] dark:text-[#B8A99A] mt-1 font-mono">
                Enter your credentials to access the academic writing workspace.
              </p>
            </div>

            <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                      Full Name:
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] text-[#1A1209] dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#B84915]"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                      Institutional Email:
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@iiet.ac.in"
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] text-[#1A1209] dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#B84915]"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                      Account Role:
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] text-[#1A1209] dark:text-white font-mono font-bold focus:outline-none"
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                  Username:
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, faculty, or student"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] text-[#1A1209] dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#B84915]"
                />
              </div>

              <div>
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1A1209] dark:text-[#D4C7B5] block mb-1">
                  Password:
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FFFAF1] dark:bg-[#26201B] border-2 border-[#1A1209] text-[#1A1209] dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#B84915]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="neo-btn w-full py-3 bg-[#B84915] hover:bg-[#A03D0E] text-[#FBF9F3] text-xs mt-3 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>{authLoading ? 'VERIFYING CREDENTIALS...' : isRegister ? 'CREATE ACADEMIC ACCOUNT' : 'ENTER WORKSPACE'}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </form>

            <div className="text-center mt-6 pt-4 border-t border-[#1A1209]/20 font-mono">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs font-bold text-[#B84915] dark:text-[#E0651E] hover:underline"
              >
                {isRegister ? '← Already registered? Sign in here' : "Need an account? Register new profile →"}
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
