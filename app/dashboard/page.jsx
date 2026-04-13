"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut, User, Calendar, Mail, KeyRound, ImageIcon,
  MessagesSquare, Send, Plus, ChevronRight,
  GraduationCap, Ticket, Clock, CheckCircle2,
} from "lucide-react";
import useAxios from "@/hooks/useAxios";
import Swal from "sweetalert2";

/* ─── tiny helpers ─────────────────────────────────────── */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "—";

const STATUS = {
  Open:   { bg: "bg-blue-50",  text: "text-blue-600",  dot: "bg-blue-500" },
  Closed: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
};

export default function DashboardPage() {
  const [student, setStudent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [view, setView] = useState("home"); 
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const axios = useAxios();
  const msgEnd = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("parentToken");
    if (!token) { router.push("/login"); return; }

    // Load from localStorage immediately so UI appears fast
    const raw = localStorage.getItem("studentDetails");
    let cachedStudent = null;
    if (raw) {
      try { cachedStudent = JSON.parse(raw); } catch {}
    }

    if (cachedStudent) {
      setStudent(cachedStudent);
      fetchTickets(cachedStudent._id);
      // Then refresh from API to get latest images
      refreshStudent(cachedStudent._id);
    } else {
      router.push("/login");
    }
  }, []);

  useEffect(() => {
    if (view === "ticket-detail") msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket, view]);

  const fetchTickets = async (id) => {
    setLoadingTickets(true);
    try {
      const res = await axios.get(`/tickets/student/${id}`);
      if (res.data.success) setTickets(res.data.data);
    } catch {}
    finally { setLoadingTickets(false); }
  };

  // Refresh student data from API to get latest uploaded images
  const refreshStudent = async (studentId) => {
    try {
      const res = await axios.get(`/auth/student/${studentId}`);
      if (res.data.success) {
        const fresh = res.data.student;
        setStudent(fresh);
        localStorage.setItem("studentDetails", JSON.stringify(fresh));
      }
    } catch (e) {
      console.error("[Profile refresh] Failed:", e.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("parentToken");
    localStorage.removeItem("studentDetails");
    router.push("/login");
  };

  const createTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post("/tickets", { studentId: student._id, subject, message });
      if (res.data.success) {
        setTickets((p) => [res.data.data, ...p]);
        setSubject(""); setMessage("");
        setView("tickets");
        Swal.fire({ icon: "success", title: "Ticket Created", timer: 1500, showConfirmButton: false });
      }
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed", "error");
    } finally { setSubmitting(false); }
  };

  const replyTicket = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`/tickets/${selectedTicket._id}/reply`, { message: replyText });
      if (res.data.success) {
        const up = res.data.data;
        setTickets((p) => p.map((t) => (t._id === up._id ? up : t)));
        setSelectedTicket(up);
        setReplyText("");
      }
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed", "error");
    } finally { setSubmitting(false); }
  };

  if (!student) return <div className="h-screen flex items-center justify-center bg-white"><div className="w-8 h-8 border-4 border-[#155dfc] border-t-transparent rounded-full animate-spin" /></div>;

  const openCount = tickets.filter((t) => t.status === "Open").length;

  /* ── Home View ── */
  const HomeView = () => {
    const allRecords = student.allRecords || [];
    const photos = allRecords.filter(r => r.uploadedImage);
    return (
    <div className="flex flex-col pb-20 max-w-2xl mx-auto w-full">
      {/* Profile Header */}
      <div className="bg-white px-6 pt-10 pb-8 border-b border-slate-100">
        <div className="flex items-center gap-5">
          {student.uploadedImage ? (
            <img
              src={student.uploadedImage}
              className="w-24 h-24 rounded-3xl object-cover border-2 border-slate-100 shadow-md"
              alt=""
            />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400">
              {student.firstName?.[0]}{student.lastName?.[0]}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{student.firstName} {student.lastName}</h2>
            <p className="text-slate-500 text-sm mt-1">ID: {student.studentId}</p>
            {student.uploadedImage && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100">
                ✓ Photo on file
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Photo Gallery (if multiple photos exist) */}
      {photos.length > 0 && (
        <div className="px-6 pt-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <p className="text-sm font-bold text-slate-800">My Photos</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                {photos.length} photo{photos.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-4 flex gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {photos.map((rec) => (
                <div key={rec._id} className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <img
                      src={rec.uploadedImage}
                      alt={rec.event?.name || ""}
                      className="w-28 h-28 rounded-2xl object-cover shadow-sm border border-slate-100"
                    />
                    {rec.isBestImage && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow">
                        ★ BEST
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 max-w-[104px] truncate text-center">
                    {rec.event?.name || "Event"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profile Details */}
      <div className="px-6 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <DetailCard label="Access Code" value={student.uniqueCode} icon={<KeyRound className="w-4 h-4" />} color="text-blue-600" />
          <DetailCard label="Birthday" value={fmtDate(student.dob)} icon={<Calendar className="w-4 h-4" />} color="text-slate-600" />
        </div>
        <DetailCardFull label="Parent Email Address" value={student.parentEmail} icon={<Mail className="w-4 h-4" />} />

        {/* Support Link */}
        <button
          onClick={() => setView("tickets")}
          className="w-full bg-[#155dfc] p-5 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4 text-white">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <MessagesSquare className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold">Support Center</p>
              <p className="text-blue-100 text-xs">{openCount} active ticket{openCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <ChevronRight className="text-white/60 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
    );
  };

  /* ── Tickets List ── */
  const TicketsView = () => (
    <div className="flex flex-col flex-1 max-w-2xl mx-auto w-full px-6 pt-8 pb-24">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-slate-900">My Tickets</h3>
        <button onClick={() => setView("new-ticket")} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {loadingTickets ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#155dfc] border-t-transparent rounded-full animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl">
          <p className="text-slate-400 text-sm">No support tickets found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <button key={t._id} onClick={() => { setSelectedTicket(t); setView("ticket-detail"); }} className="w-full text-left p-5 bg-white border border-slate-100 rounded-2xl hover:border-blue-100 transition-colors shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${STATUS[t.status].bg} ${STATUS[t.status].text}`}>
                   {t.status}
                </span>
                <span className="text-[11px] text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="font-bold text-slate-800 line-clamp-1 mb-1">{t.subject}</p>
              <p className="text-xs text-slate-500 line-clamp-1">{t.messages[t.messages.length - 1]?.message}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Bottom Navigation */}
      {(view === "home" || view === "tickets") && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-10 py-3 flex justify-around z-50">
          <NavBtn active={view === "home"} onClick={() => setView("home")} icon={<User className="w-6 h-6" />} label="Profile" />
          <NavBtn active={view === "tickets"} onClick={() => setView("tickets")} icon={<MessagesSquare className="w-6 h-6" />} label="Support" badge={openCount} />
          <button onClick={logout} className="flex flex-col items-center gap-1 text-slate-400"><LogOut className="w-6 h-6" /><span className="text-[10px] font-bold">Logout</span></button>
        </div>
      )}

      {/* Header for detail views */}
      {view !== "home" && view !== "tickets" && (
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <button onClick={() => setView(view === "ticket-detail" ? "tickets" : "tickets")} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 rotate-180 text-slate-600" /></button>
          <h2 className="font-bold text-slate-900 truncate">{view === "new-ticket" ? "Create Ticket" : selectedTicket?.subject}</h2>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {view === "home" && <HomeView />}
        {view === "tickets" && <TicketsView />}
        {view === "new-ticket" && <NewTicketForm subject={subject} setSubject={setSubject} message={message} setMessage={setMessage} onSubmit={createTicket} loading={submitting} />}
        {view === "ticket-detail" && <TicketDetail selectedTicket={selectedTicket} replyText={replyText} setReplyText={setReplyText} onSubmit={replyTicket} loading={submitting} msgEnd={msgEnd} />}
      </div>
    </div>
  );
}

/* ─── Shared Components ────────────────────────── */

function NavBtn({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? "text-[#155dfc]" : "text-slate-400"}`}>
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
      {badge > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{badge}</span>}
      {active && <div className="w-1 h-1 bg-[#155dfc] rounded-full mt-1" />}
    </button>
  );
}

function DetailCard({ label, value, icon, color }) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-2 mb-2 text-slate-400">
        {icon} <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-bold text-sm ${color}`}>{value}</p>
    </div>
  );
}

function DetailCardFull({ label, value, icon }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
      <div className="bg-slate-50 p-3 rounded-xl text-slate-400">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function NewTicketForm({ subject, setSubject, message, setMessage, onSubmit, loading }) {
  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto w-full p-6 space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 ml-1">SUBJECT</label>
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="e.g. Fee inquiry" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 ml-1">MESSAGE</label>
        <textarea required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none" placeholder="Describe your issue..." />
      </div>
      <button type="submit" disabled={loading} className="w-full py-4 bg-[#155dfc] text-white font-bold rounded-2xl shadow-lg shadow-blue-100 active:scale-[0.98] transition-all disabled:opacity-50">
        {loading ? "Submitting..." : "Send Ticket"}
      </button>
    </form>
  );
}

function TicketDetail({ selectedTicket, replyText, setReplyText, onSubmit, loading, msgEnd }) {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {selectedTicket.messages.map((m, i) => {
          const isParent = m.sender?.role === "parent";
          return (
            <div key={i} className={`flex ${isParent ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${isParent ? "bg-[#155dfc] text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"}`}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={msgEnd} />
      </div>
      {selectedTicket.status === "Open" && (
        <form onSubmit={onSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-3">
          <input value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl outline-none focus:border-blue-300" placeholder="Type reply..." />
          <button disabled={loading || !replyText.trim()} className="bg-[#155dfc] text-white p-3 rounded-xl active:scale-90 transition-all disabled:opacity-50"><Send className="w-5 h-5" /></button>
        </form>
      )}
    </div>
  );
}