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

  const handleMarkBest = async (recordId) => {
    try {
      const res = await axios.put(`/events/students/${recordId}/best-image`);
      if (res.data.success) {
        Swal.fire({
          icon: "success",
          title: "Profile Updated",
          text: "Your primary photo has been changed.",
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
        refreshStudent(student._id);
      }
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to update photo", "error");
    }
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
  const allRecords = student.allRecords || [];
  
  // Flatten all images from all records
  const allPhotos = [];
  allRecords.forEach(rec => {
    // Add primary image
    if (rec.uploadedImage) {
      allPhotos.push({
        _id: rec._id,
        url: rec.uploadedImage,
        isBestImage: rec.isBestImage,
        eventName: rec.event?.name,
        date: rec.updatedAt,
        isPrimary: true
      });
    }
    // Add additional images from the array
    if (rec.images && rec.images.length > 0) {
      rec.images.forEach((img, idx) => {
        if (img.url !== rec.uploadedImage) {
          allPhotos.push({
            _id: `${rec._id}_${idx}`,
            url: img.url,
            isBestImage: false,
            eventName: rec.event?.name,
            date: rec.updatedAt,
            isPrimary: false,
            parentRecordId: rec._id
          });
        }
      });
    }
  });

  // Sort by Best first, then by date
  allPhotos.sort((a, b) => {
    if (a.isBestImage) return -1;
    if (b.isBestImage) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  /* ── Home View ── */
  const HomeView = () => (
    <div className="flex flex-col pb-20 w-full animate-in fade-in duration-500">
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12 text-center lg:text-left">
            <div className="relative group">
              {student.uploadedImage ? (
                <img
                  src={student.uploadedImage}
                  className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-lg object-cover border border-slate-200"
                  alt=""
                />
              ) : (
                <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-lg bg-slate-100 flex items-center justify-center text-5xl font-bold text-slate-300 border border-slate-200">
                  {student.firstName?.[0]}{student.lastName?.[0]}
                </div>
              )}
              {student.uploadedImage && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-lg border-2 border-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {student.firstName} {student.lastName}
                </h2>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-3">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                    ID: {student.studentId}
                  </span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider border border-blue-100">
                    Client Portal Active
                  </span>
                </div>
              </div>
              
              <p className="text-slate-500 text-lg max-w-xl leading-relaxed">
                Welcome to your student's personal dashboard. Here you can manage profile photos, track progress, and communicate with support.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto w-full px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailCard label="Access Code" value={student.uniqueCode} icon={<KeyRound className="w-5 h-5" />} color="text-blue-600" />
            <DetailCard label="Birthday" value={fmtDate(student.dob)} icon={<Calendar className="w-5 h-5" />} color="text-slate-700" />
          </div>
          <DetailCardFull label="Client Email Address" value={student.parentEmail} icon={<Mail className="w-6 h-6" />} />
          
          <div className="bg-[#155dfc]/5 border border-[#155dfc]/10 rounded-lg p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-[#155dfc] p-4 rounded-lg">
              <MessagesSquare className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="font-bold text-slate-900 text-xl">Need Assistance?</h4>
              <p className="text-slate-500 text-sm mt-1">Our support team is here to help with any questions or issues.</p>
            </div>
            <button 
              onClick={() => setView("tickets")}
              className="bg-white text-[#155dfc] font-bold px-6 py-3 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              Contact Support
            </button>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white rounded-lg border border-slate-200 p-6">
             <h5 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
               <ImageIcon className="w-4 h-4 text-blue-500" /> 
               Recent Photos
             </h5>
             <div className="grid grid-cols-2 gap-3">
               {photos.slice(0, 4).map(p => (
                 <img key={p._id} src={p.uploadedImage} className="aspect-square rounded-lg object-cover border border-slate-100" />
               ))}
               {photos.length > 4 && (
                 <button onClick={() => setView("photos")} className="aspect-square rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-400 group hover:bg-slate-100 transition-colors">
                   <span className="font-bold text-lg">+{photos.length - 4}</span>
                   <span className="text-[10px] font-bold uppercase tracking-widest">View All</span>
                 </button>
               )}
             </div>
             {photos.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No photos available yet</p>}
           </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Ticket className="w-4 h-4 text-orange-500" /> 
                Support Status
              </h5>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                 <span className="text-sm font-bold text-orange-700">Open Tickets</span>
                 <span className="bg-orange-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">{openCount}</span>
              </div>
            </div>

            {/* Login History */}
            {student.loginHistory && student.loginHistory.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Recent Logins
                </h5>
                <div className="space-y-3">
                  {student.loginHistory.slice(-3).reverse().map((log, idx) => (
                    <div key={idx} className="flex flex-col p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700">{log.email}</span>
                        <span className="text-slate-400">{new Date(log.time).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>IP: {log.ip}</span>
                        <span className="truncate max-w-[100px]" title={log.timezone}>{log.timezone}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );

  /* ── Photos View ── */
  const PhotosView = () => (
    <div className="flex flex-col flex-1 w-full px-6 py-8 pb-32 lg:pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="container mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Photo Collection</h3>
            <p className="text-slate-500 mt-1">Choose your favorite photo to represent your profile.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg">
            <span className="px-3 py-1.5 text-xs font-bold text-slate-400">Total: {allPhotos.length}</span>
          </div>
        </div>

        {allPhotos.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-lg p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium">Your photo collection is currently empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
            {allPhotos.map((photo) => (
              <div key={photo._id} className="group flex flex-col gap-4">
                <div 
                  className="relative aspect-square cursor-pointer" 
                  onClick={() => {
                    if (photo.isBestImage) return;
                    if (photo.isPrimary) {
                      handleMarkBest(photo._id);
                    } else {
                      Swal.fire({
                        title: 'Select as Best?',
                        text: "To set this as your profile photo, it will become the primary photo for this event.",
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, select it!',
                        confirmButtonColor: '#155dfc'
                      }).then((result) => {
                        if (result.isConfirmed) {
                          // For now, we only support marking primary ones as best easily.
                          // But we can just show a message.
                          Swal.fire('Note', 'Only primary photos can currently be set as Best. Our team is working on enabling this for additional photos.', 'info');
                        }
                      });
                    }
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.eventName || ""}
                    className={`w-full h-full rounded-lg object-cover transition-all duration-500 ${
                      photo.isBestImage ? "ring-2 ring-[#155dfc] scale-[0.98] border border-[#155dfc]" : "border border-slate-200 group-hover:scale-105"
                    }`}
                  />
                  
                  {photo.isBestImage ? (
                    <div className="absolute top-3 right-3 bg-[#155dfc] text-white p-2 rounded-lg border-2 border-white">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-white text-[#155dfc] text-xs font-black px-6 py-3 rounded-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                        {photo.isPrimary ? "SELECT AS BEST" : "VIEW PHOTO"}
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-2">
                  <p className={`text-sm font-bold truncate ${photo.isBestImage ? "text-[#155dfc]" : "text-slate-800"}`}>
                    {photo.eventName || "Event Photo"}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      {fmtDate(photo.date)}
                    </p>
                    {!photo.isPrimary && (
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">Additional</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Tickets List ── */
  const TicketsView = () => (
    <div className="flex flex-col flex-1 w-full px-6 py-8 pb-32 lg:pb-12 animate-in fade-in duration-500">
      <div className="container mx-auto w-full">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Support Tickets</h3>
            <p className="text-slate-500 mt-1">Track and manage your inquiries.</p>
          </div>
          <button onClick={() => setView("new-ticket")} className="bg-[#155dfc] text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> New Ticket
          </button>
        </div>

        {loadingTickets ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-[#155dfc] border-t-transparent rounded-full animate-spin" /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-24 bg-white border border-slate-200 rounded-lg">
            <MessagesSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No support tickets found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((t) => (
              <button key={t._id} onClick={() => { setSelectedTicket(t); setView("ticket-detail"); }} className="w-full text-left p-6 bg-white border border-slate-200 rounded-lg hover:border-[#155dfc] transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#155dfc]/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:bg-[#155dfc]/10" />
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS[t.status].bg} ${STATUS[t.status].text} border border-current opacity-70`}>
                     {t.status}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-extrabold text-slate-900 text-lg line-clamp-1 mb-2 relative z-10 group-hover:text-[#155dfc] transition-colors">{t.subject}</p>
                <div className="flex items-center gap-2 text-slate-500">
                  <p className="text-sm line-clamp-1 flex-1">{t.messages[t.messages.length - 1]?.message}</p>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 sticky top-0 h-screen z-50">
        <div className="p-8">
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-12 bg-[#155dfc] rounded-lg flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="block font-black text-slate-900 tracking-tighter text-xl">Client Portal</span>
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] -mt-1">v2.0 Premium</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-6 py-6 space-y-2">
          <SidebarLink active={view === "home"} onClick={() => setView("home")} icon={<User className="w-5 h-5" />} label="Overview" />
          <SidebarLink active={view === "photos"} onClick={() => setView("photos")} icon={<ImageIcon className="w-5 h-5" />} label="Photo Collection" />
          <SidebarLink active={view === "tickets" || view === "new-ticket" || view === "ticket-detail"} onClick={() => setView("tickets")} icon={<MessagesSquare className="w-5 h-5" />} label="Support Hub" badge={openCount} />
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-4 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all font-bold text-sm"
          >
            <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:border-red-100 transition-colors">
              <LogOut className="w-5 h-5" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Top Navbar for Desktop */}
        <header className="hidden lg:flex items-center justify-between px-10 py-5 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
          <div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
              {view === "home" ? "Portal Overview" : view === "photos" ? "Image Management" : view === "tickets" ? "Customer Support" : "Details"}
            </h2>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-sm font-extrabold text-slate-900">{student.firstName} {student.lastName}</p>
                <p className="text-[11px] text-slate-400 font-bold tracking-wider">REG: {student.studentId}</p>
             </div>
             <div className="relative">
               <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-20" />
               {student.uploadedImage ? (
                  <img src={student.uploadedImage} className="relative w-11 h-11 rounded-full object-cover border-2 border-white shadow-md" alt="" />
               ) : (
                  <div className="relative w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 border-2 border-white">{student.firstName?.[0]}</div>
               )}
             </div>
          </div>
        </header>

        {/* Bottom Navigation - Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex justify-around">
            <NavBtn active={view === "home"} onClick={() => setView("home")} icon={<User className="w-6 h-6" />} label="Profile" />
            <NavBtn active={view === "photos"} onClick={() => setView("photos")} icon={<ImageIcon className="w-6 h-6" />} label="Photos" />
            <NavBtn active={view === "tickets"} onClick={() => setView("tickets")} icon={<MessagesSquare className="w-6 h-6" />} label="Support" badge={openCount} />
            <button onClick={logout} className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Header for detail views */}
        {view !== "home" && view !== "tickets" && view !== "photos" && (
          <div className="lg:hidden p-4 bg-white border-b border-slate-100 flex items-center gap-4">
            <button onClick={() => setView(view === "ticket-detail" ? "tickets" : "tickets")} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 rotate-180 text-slate-600" /></button>
            <h2 className="font-bold text-slate-900 truncate">{view === "new-ticket" ? "Create Ticket" : selectedTicket?.subject}</h2>
          </div>
        )}

        {/* Content Area */}
        <main className={`flex-1 overflow-y-auto ${view === "home" ? "" : "lg:p-8"}`}>
          <div className="w-full">
            {view === "home" && <HomeView />}
            {view === "photos" && <PhotosView />}
            {view === "tickets" && <TicketsView />}
            {view === "new-ticket" && <NewTicketForm subject={subject} setSubject={setSubject} message={message} setMessage={setMessage} onSubmit={createTicket} loading={submitting} />}
            {view === "ticket-detail" && <TicketDetail selectedTicket={selectedTicket} replyText={replyText} setReplyText={setReplyText} onSubmit={replyTicket} loading={submitting} msgEnd={msgEnd} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all font-bold text-sm relative group ${
        active ? "bg-[#155dfc] text-white" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge > 0 && (
        <span className={`text-[10px] w-5 h-5 rounded-lg flex items-center justify-center font-bold ${active ? "bg-white text-[#155dfc]" : "bg-red-500 text-white"}`}>
          {badge}
        </span>
      )}

    </button>
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
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
      <div className="flex items-center gap-2 mb-2 text-slate-400">
        {icon} <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-bold text-sm ${color}`}>{value}</p>
    </div>
  );
}

function DetailCardFull({ label, value, icon }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
      <div className="bg-slate-50 p-3 rounded-lg text-slate-400">{icon}</div>
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
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-lg focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="e.g. Fee inquiry" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 ml-1">MESSAGE</label>
        <textarea required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-lg focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none" placeholder="Describe your issue..." />
      </div>
      <button type="submit" disabled={loading} className="w-full py-4 bg-[#155dfc] text-white font-bold rounded-lg shadow-lg shadow-blue-100 active:scale-[0.98] transition-all disabled:opacity-50">
        {loading ? "Submitting..." : "Send Ticket"}
      </button>
    </form>
  );
}

function TicketDetail({ selectedTicket, replyText, setReplyText, onSubmit, loading, msgEnd }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden lg:h-[600px]">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">{selectedTicket.subject}</h3>
          <p className="text-xs text-slate-500">
            Ticket ID: #{selectedTicket._id.slice(-6).toUpperCase()} • Status: <span className={selectedTicket.status === 'Open' ? 'text-green-600 font-bold' : 'text-slate-500 font-bold'}>{selectedTicket.status}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f8fafc]">
        {selectedTicket.messages.map((m, i) => {
          const isParent = m.sender?.role === "parent";
          return (
            <div key={i} className={`flex flex-col ${isParent ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isParent ? "You" : m.sender?.name || "Support Team"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(m.createdAt || selectedTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                isParent 
                  ? "bg-[#155dfc] text-white rounded-tr-sm" 
                  : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
              }`}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={msgEnd} />
      </div>

      {selectedTicket.status === "Open" ? (
        <div className="bg-white p-4 border-t border-slate-200">
          <form onSubmit={onSubmit} className="flex gap-3">
            <input 
              value={replyText} 
              onChange={(e) => setReplyText(e.target.value)} 
              className="flex-1 bg-slate-50 border border-slate-200 p-3.5 rounded-lg outline-none focus:border-[#155dfc] focus:ring-2 focus:ring-[#155dfc]/10 transition-all text-sm" 
              placeholder="Type your message here..." 
            />
            <button 
              disabled={loading || !replyText.trim()} 
              className="bg-[#155dfc] hover:bg-blue-600 text-white px-5 rounded-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-sm"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-4 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> This ticket is resolved and closed.
          </p>
        </div>
      )}
    </div>
  );
}