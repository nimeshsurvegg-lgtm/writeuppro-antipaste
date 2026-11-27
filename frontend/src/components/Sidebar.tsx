import React from 'react';
import {
  Folder, BookOpen, CheckSquare, Beaker, Sparkles, FileText,
  Award, Calendar, GraduationCap, Share2, Layers, Plus,
  BarChart2, Users, ChevronLeft, ChevronRight, X, LogOut,
  Sun, Moon, Shield, User as UserIcon, CheckCircle2
} from 'lucide-react';
import { User, StudentProfile, FacultyProfile } from '../types';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewAction?: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  highlight?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  onNewAction,
  onLogout,
  isDarkMode,
  onToggleTheme,
}) => {
  const role = currentUser.role;

  // Build role-specific navigation groups
  const navGroups: NavGroup[] = [];

  if (role === 'student') {
    navGroups.push(
      {
        title: 'Workspace',
        items: [
          { id: 'overview', label: 'My Workspace', icon: Folder },
          { id: 'subjects', label: 'My Subjects', icon: BookOpen },
        ],
      },
      {
        title: 'Assessments',
        items: [
          { id: 'assignments', label: 'Assignments', icon: CheckSquare },
          { id: 'experiments', label: 'Lab Experiments', icon: Beaker },
          { id: 'special_documents', label: 'Special Submissions', icon: Sparkles },
          { id: 'submissions', label: 'Submissions & Grades', icon: FileText },
        ],
      },
      {
        title: 'Academic Progress',
        items: [
          { id: 'performance', label: 'Subject Performance', icon: Award, highlight: true },
          { id: 'calendar', label: 'Academic Calendar', icon: Calendar },
          { id: 'portfolio', label: 'Student Portfolio', icon: GraduationCap },
        ],
      },
      {
        title: 'Administration',
        items: [
          { id: 'electives', label: 'Open Electives', icon: Share2 },
          { id: 'promotion', label: 'Year Promotion', icon: Layers },
        ],
      }
    );
  } else if (role === 'faculty') {
    navGroups.push(
      {
        title: 'Instructional',
        items: [
          { id: 'my_classes', label: 'My Classes', icon: Folder },
          { id: 'inbox', label: 'Submissions Inbox', icon: FileText },
        ],
      },
      {
        title: 'Authoring & Tools',
        items: [
          { id: 'create_task', label: 'Create Assessment', icon: Plus, highlight: true },
          { id: 'rubrics', label: 'Custom Rubrics', icon: Award },
        ],
      },
      {
        title: 'Schedules & Data',
        items: [
          { id: 'calendar', label: 'Academic Calendar', icon: Calendar },
          { id: 'analytics', label: 'Classroom Analytics', icon: BarChart2 },
        ],
      }
    );
  } else {
    // Administrator
    navGroups.push(
      {
        title: 'Academic Structure',
        items: [
          { id: 'academic_classes', label: 'Academic Classes', icon: Folder },
          { id: 'registrations', label: 'Registrations', icon: GraduationCap },
          { id: 'academic_structure', label: 'Syllabi & Subjects', icon: BookOpen },
        ],
      },
      {
        title: 'Operations',
        items: [
          { id: 'allotment_wizard', label: 'Allotment Wizard', icon: Layers, highlight: true },
          { id: 'batches', label: 'Laboratory Batches', icon: Users },
          { id: 'electives', label: 'Open Electives', icon: Share2 },
        ],
      },
      {
        title: 'Governance',
        items: [
          { id: 'promotions', label: 'Year Promotions', icon: Award },
        ],
      }
    );
  }

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    onClose(); // Close mobile drawer when an item is selected
  };

  const stuProfile = role === 'student' ? (currentUser.profile as StudentProfile) : null;
  const facProfile = role === 'faculty' ? (currentUser.profile as FacultyProfile) : null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen bg-white dark:bg-[#1D1814] border-r-2 border-[#1A1209] flex flex-col transition-all duration-200 select-none ${
          isCollapsed ? 'md:w-20' : 'md:w-64'
        } ${
          isOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className={`border-b-2 border-[#1A1209] flex items-center shrink-0 bg-[#F4EFE6] dark:bg-[#26201B] ${
          isCollapsed ? 'p-2 flex-col gap-2 justify-center' : 'p-4 justify-between gap-2'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-[#1A1209] text-[#FBF9F3] border-2 border-[#1A1209] shadow-[2px_2px_0px_#B84915] flex items-center justify-center font-black text-base shrink-0">
              W
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-[#1A1209] dark:text-[#F7F3E9] flex items-center gap-1 leading-tight truncate">
                  WriteUp <span className="text-[#B84915] dark:text-[#E0651E]">Pro</span>
                </span>
                <span className="text-[10px] font-mono text-[#786958] dark:text-[#A89886] block truncate">
                  IIET Portal v2.0
                </span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1 ${isCollapsed ? 'w-full justify-center' : ''}`}>
            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`hidden md:flex p-1.5 hover:bg-white dark:hover:bg-[#1D1814] border border-[#1A1209]/20 hover:border-[#1A1209] text-[#1A1209] dark:text-[#F7F3E9] transition ${
                isCollapsed ? 'w-full justify-center bg-white dark:bg-[#1D1814] shadow-[1.5px_1.5px_0px_#1A1209]' : ''
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-[#B84915]" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 hover:bg-white dark:hover:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9]"
              title="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Mini Profile Header */}
        <div className="p-3 border-b border-[#1A1209]/20 dark:border-[#D4C7B5]/20 bg-[#FAF6EE] dark:bg-[#16120E] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-[#1A365D] text-white font-bold flex items-center justify-center text-xs border border-[#1A1209] shrink-0">
              {currentUser.full_name ? currentUser.full_name.charAt(0) : 'U'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#1A1209] dark:text-white truncate leading-tight font-sans">
                  {currentUser.full_name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded-none text-[9px] font-mono font-bold uppercase bg-[#1A1209] text-white">
                    {currentUser.role}
                  </span>
                  {stuProfile && (
                    <span className="text-[10px] font-mono text-[#786958] dark:text-[#A89886] truncate">
                      {stuProfile.roll_number || stuProfile.year_level}
                    </span>
                  )}
                  {facProfile && (
                    <span className="text-[10px] font-mono text-[#786958] dark:text-[#A89886] truncate">
                      {facProfile.employee_id}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        {onNewAction && (
          <div className="p-3 border-b border-[#1A1209]/10 shrink-0">
            <button
              type="button"
              onClick={onNewAction}
              className={`w-full py-2 bg-[#B84915] hover:bg-[#963A0F] text-white font-mono font-bold text-xs flex items-center justify-center gap-2 border-2 border-[#1A1209] shadow-[2.5px_2.5px_0px_#1A1209] transition-all cursor-pointer ${
                isCollapsed ? 'px-2' : 'px-3'
              }`}
              title={
                role === 'student'
                  ? 'New Academic Manuscript'
                  : role === 'faculty'
                  ? 'New Assessment'
                  : 'New Promotion Window'
              }
            >
              <Plus className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <span className="truncate">
                  {role === 'student' ? 'NEW WRITEUP' : role === 'faculty' ? 'NEW TASK' : 'NEW WINDOW'}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 font-mono">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed ? (
                <span className="px-2.5 text-[9px] font-bold uppercase tracking-wider text-[#786958] dark:text-[#A89886] block mb-1">
                  {group.title}
                </span>
              ) : (
                <div className="h-2" />
              )}

              {group.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full text-left px-2.5 py-2 text-xs font-bold flex items-center gap-2.5 border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#1A365D] text-white border-[#1A1209] shadow-[2px_2px_0px_#1A1209]'
                        : item.highlight
                        ? 'bg-[#FFF9EE] dark:bg-[#2A231C] text-[#B84915] dark:text-[#F0823A] border-amber-300 dark:border-amber-800 hover:bg-[#F4EFE6]'
                        : 'bg-transparent text-[#1A1209] dark:text-[#D4C7B5] border-transparent hover:bg-[#F4EFE6] dark:hover:bg-[#26201B] hover:border-[#1A1209]/20'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-amber-300' : item.highlight ? 'text-[#B84915]' : 'text-[#786958] dark:text-[#A89886]'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!isCollapsed && item.badge !== undefined && (
                      <span className="px-1.5 py-0.2 bg-black/10 dark:bg-white/10 text-[9px] rounded-none">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t-2 border-[#1A1209] bg-[#F4EFE6] dark:bg-[#26201B] space-y-2 shrink-0 font-mono">
          {!isCollapsed && (
            <div className="flex items-center justify-between text-[10px] text-[#786958] dark:text-[#A89886] px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                AY 2026-27 Active
              </span>
              <span className="font-bold text-[#1A1209] dark:text-white">v2.0</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {/* Quick Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className={`neo-btn py-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-[#F7F3E9] text-[11px] font-bold flex items-center justify-center gap-1.5 border border-[#1A1209] cursor-pointer ${
                isCollapsed ? 'w-full' : 'flex-1'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              {!isCollapsed && <span>{isDarkMode ? 'LIGHT' : 'DARK'}</span>}
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className={`neo-btn py-1.5 bg-white dark:bg-[#1D1814] hover:bg-[#8B1A1A] hover:text-white text-[#1A1209] dark:text-[#F7F3E9] text-[11px] font-bold flex items-center justify-center gap-1.5 border border-[#1A1209] transition cursor-pointer ${
                isCollapsed ? 'w-full mt-1' : 'flex-1'
              }`}
              title="Logout session"
            >
              <LogOut className="w-3.5 h-3.5" />
              {!isCollapsed && <span>EXIT</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
