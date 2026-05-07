'use client';

import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { io as ioClient } from 'socket.io-client';
import { axiosInstance } from '@/hooks/useAxios';

const playDing = () => {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [
      { f: 880, t: now, d: 0.13 },
      { f: 1320, t: now + 0.12, d: 0.18 },
    ].forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + d + 0.05);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {}
};

const getSocketBase = () => {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  return api.replace(/\/?api\/?$/, '');
};

export default function NotificationBell({ className = '', onItemClick }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const wrapRef = useRef(null);
  const soundEnabledRef = useRef(false);

  const fetchUnread = async () => {
    try {
      const { data } = await axiosInstance.get('/notifications/unread-count');
      if (data?.success) setUnread(data.unreadCount || 0);
    } catch {}
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/notifications?limit=30');
      if (data?.success) {
        setItems(data.data || []);
        setUnread(data.unreadCount || 0);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchUnread(); }, []);

  // Realtime socket
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('parentToken');
    if (!token) return;

    const socket = ioClient(`${getSocketBase()}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('notification:new', (n) => {
      setUnread((u) => u + 1);
      setPulsing(true);
      setTimeout(() => setPulsing(false), 1200);
      if (soundEnabledRef.current) playDing();
      setItems((prev) => [
        { ...n, read: false, _id: n._id || `live-${Date.now()}` },
        ...prev,
      ].slice(0, 30));
    });

    socket.on('connect_error', (e) => console.warn('[notif socket]', e.message));

    return () => { socket.disconnect(); };
  }, []);

  // Enable sound after first user gesture (browser autoplay policy).
  useEffect(() => {
    const enable = () => {
      soundEnabledRef.current = true;
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
    window.addEventListener('pointerdown', enable);
    window.addEventListener('keydown', enable);
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
  }, []);

  useEffect(() => {
    if (open) fetchList();
  }, [open]);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markOne = async (id) => {
    try {
      await axiosInstance.put(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {}
  };

  const markAll = async () => {
    try {
      await axiosInstance.put('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {}
  };

  const fmtTime = (t) => {
    const d = new Date(t);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors ${pulsing ? 'animate-pulse text-blue-600' : ''}`}
        aria-label="Notifications"
      >
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] text-[10px] font-bold leading-[16px] px-1 bg-red-500 text-white rounded-full border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        <Bell className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="font-semibold text-slate-800 text-sm">Notifications</div>
            {items.some((n) => !n.read) && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">No notifications yet</div>
            )}
            {!loading &&
              items.map((n) => (
                <div
                  key={n._id}
                  onClick={() => {
                    if (!n.read) markOne(n._id);
                    if (typeof onItemClick === 'function') onItemClick(n);
                    setOpen(false);
                  }}
                  className={`flex gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                    !n.read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      !n.read ? 'bg-blue-500' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{n.title}</div>
                    {n.message && (
                      <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                      {fmtTime(n.createdAt)}
                    </div>
                  </div>
                  {!n.read && (
                    <Check className="w-4 h-4 text-slate-400 self-start shrink-0" />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
