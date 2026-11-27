import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2, ChevronLeft,
  ChevronRight, Filter, BookOpen, Beaker, FileText, FolderGit2, Bell, RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

interface CalendarEvent {
  id: string;
  task_id?: string;
  title: string;
  event_type: 'Assignment' | 'Experiment' | 'Special Document' | 'Announcement' | string;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  class_name?: string;
  start: string;
  due_date?: string;
  is_extended?: boolean;
  original_due_date?: string;
  extension_reason?: string;
  submission_status?: string;
  is_submitted?: boolean;
  is_evaluated?: boolean;
  marks_awarded?: number;
  max_marks?: number;
  category?: string;
}

export const CalendarView: React.FC<{ role?: 'student' | 'faculty' | 'admin' }> = ({ role = 'student' }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('agenda');

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.academic.getCalendar();
      setEvents(res || []);
    } catch (err: any) {
      console.error('Failed to load academic calendar:', err);
      setError('Unable to load academic events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (selectedType === 'ALL') return true;
    return e.event_type.toLowerCase() === selectedType.toLowerCase();
  });

  const getEventBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'assignment':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <FileText className="w-3 h-3" /> Assignment
          </span>
        );
      case 'experiment':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Beaker className="w-3 h-3" /> Experiment
          </span>
        );
      case 'special document':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <FolderGit2 className="w-3 h-3" /> Special Document
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Bell className="w-3 h-3" /> Announcement
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Unified Academic & Deadline Calendar
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Synchronized assignment due dates, laboratory experiment milestones, and academic deadlines.
          </p>
        </div>

        {/* View toggles & filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-md transition ${viewMode === 'agenda' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Agenda
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md transition ${viewMode === 'month' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Calendar View
            </button>
          </div>

          <button
            onClick={fetchCalendar}
            className="p-1.5 text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {['ALL', 'Assignment', 'Experiment', 'Special Document', 'Announcement'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
              selectedType === type
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {type === 'ALL' ? 'All Deadlines & Milestones' : `${type}s`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Loading academic schedule...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <CalendarIcon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Upcoming Deadlines</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1">
            There are currently no assignments or experiment deadlines scheduled for this filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((evt) => {
            const dueDate = evt.due_date ? new Date(evt.due_date) : null;
            const isPast = dueDate ? dueDate.getTime() < Date.now() : false;

            return (
              <div
                key={evt.id}
                className={`p-4 rounded-xl border transition bg-white dark:bg-neutral-900 ${
                  evt.is_extended
                    ? 'border-amber-300 dark:border-amber-800 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800'
                } hover:shadow-md`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getEventBadge(evt.event_type)}
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                        {evt.title}
                      </h4>
                      {evt.is_extended && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Deadline Extended
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                      {evt.subject_name && (
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {evt.subject_name} ({evt.subject_code})
                        </span>
                      )}
                      {evt.faculty_name && <span>Faculty: {evt.faculty_name}</span>}
                      {evt.class_name && <span>Class: {evt.class_name}</span>}
                    </div>

                    {evt.extension_reason && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                        Extension Reason: {evt.extension_reason} (Original: {evt.original_due_date ? new Date(evt.original_due_date).toLocaleString() : 'N/A'})
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-100 dark:border-neutral-800">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Due Date & Time</span>
                      <span className={`text-xs font-bold ${isPast ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                        {dueDate ? dueDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Deadline'}
                      </span>
                    </div>

                    {evt.submission_status && (
                      <div className="mt-1">
                        {evt.is_submitted ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Submitted
                          </span>
                        ) : isPast ? (
                          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Overdue
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
