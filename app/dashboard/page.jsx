"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User, ImageIcon, LogOut, ShoppingBag, History, MessagesSquare, CheckCircle2, 
  ChevronRight, UploadCloud, Loader2, X, Plus, Printer, Mail, Trash2, 
  Send, Package, CreditCard, ArrowRight, ArrowLeft, Eye, BadgeCheck, Search,
  GraduationCap, Calendar, KeyRound, Ticket, Clock, Download, Activity,
  MapPin, MessageSquare
} from 'lucide-react';
import useAxios from "@/hooks/useAxios";
import Swal from "sweetalert2";
import NotificationBell from "@/components/NotificationBell";
import PhotoLightbox from "@/components/PhotoLightbox";

/* ─── tiny helpers ─────────────────────────────────────── */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "—";

const STATUS = {
  Open:               { bg: "bg-blue-50",   text: "text-blue-600",   dot: "bg-blue-500"   },
  'In Progress':      { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  'Assigned to Staff':{ bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  Closed:             { bg: "bg-slate-100", text: "text-slate-500",  dot: "bg-slate-400"  },
};

export default function DashboardPage() {
  const [student, setStudent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [view, setView] = useState("home"); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);

  // Order flow state
  const [orders, setOrders] = useState([]);
  const [packages, setPackages] = useState([]);
  const [orderStep, setOrderStep] = useState(1); // 1=select images, 2=choose package, 3=payment, 4=success
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Shipping address (collected at checkout)
  const [shipAddr, setShipAddr] = useState({
    fullName: '', phone: '', line1: '', line2: '',
    city: '', region: '', postalCode: '', country: 'Canada',
  });
  const [matchedZone, setMatchedZone] = useState(null); // { _id, name, charge }
  const [zoneChecking, setZoneChecking] = useState(false);
  const [zoneChecked, setZoneChecked] = useState(false); // flips true after first match attempt

  // Lightbox / slideshow state
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // Standalone fullscreen viewer for order-detail images (different photo
  // set than the home gallery, so it gets its own simple lightbox).
  const [orderLightboxUrl, setOrderLightboxUrl] = useState(null);

  // All children belonging to this parent (matched via parentEmail).
  // Used for the child-switcher dropdown in the header.
  const [children, setChildren] = useState([]);

  // Coupon / discount code
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, ... }
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  const router = useRouter();
  const axios = useAxios();
  const msgEnd = useRef(null);

  // Map a notification → which dashboard view to show. Used by both bell instances.
  const handleNotificationClick = (n) => {
    const link = n?.link || '';
    if (link.includes('order-history') || n?.type === 'order_status' || n?.relatedOrder) {
      setSelectedOrder(null);
      setView('order-history');
      return;
    }
    if (link.includes('tickets') || n?.type === 'ticket_created' || n?.type === 'ticket_reply') {
      setSelectedTicket(null);
      setView('tickets');
      return;
    }
    setView('home');
  };

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
      fetchOrders(cachedStudent._id);
      fetchPackages();
      // Then refresh from API to get latest images
      refreshStudent(cachedStudent._id);
      // Load every child this parent has so we can offer a switcher.
      fetchChildren();
    } else {
      router.push("/login");
    }
  }, []);

  const fetchChildren = async () => {
    try {
      const r = await axios.get('/auth/parent/children');
      if (r.data?.success) setChildren(r.data.data || []);
    } catch {}
  };

  const switchChild = (child) => {
    if (!child || child._id === student?._id) return;
    // Optimistically swap & re-fetch everything tied to that student.
    setStudent(child);
    localStorage.setItem('studentDetails', JSON.stringify(child));
    setSelectedOrder(null);
    setSelectedTicket(null);
    setView('home');
    fetchTickets(child._id);
    fetchOrders(child._id);
    refreshStudent(child._id);
  };

  useEffect(() => {
    if (view === "ticket-detail") msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket, view]);

  const fetchPackages = async () => {
    try {
      const res = await axios.get('/packages');
      if (res.data.success) setPackages(res.data.data);
    } catch {}
  };

  const fetchOrders = async (id) => {
    try {
      const res = await axios.get(`/orders/student/${id}`);
      if (res.data.success) setOrders(res.data.data);
    } catch {}
  };

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

  const [newTicketFiles, setNewTicketFiles] = useState([]);

  const createTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('studentId', student._id);
      fd.append('subject', subject);
      fd.append('message', message);
      for (const f of newTicketFiles) fd.append('files', f);
      const res = await axios.post("/tickets", fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setTickets((p) => [res.data.data, ...p]);
        setSubject(""); setMessage(""); setNewTicketFiles([]);
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

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await axios.post(`/events/students/${student._id}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        Swal.fire({ icon: 'success', title: 'Photo Uploaded', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
        refreshStudent(student._id);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // Debounced zone match — fires whenever the city / postal / country changes.
  useEffect(() => {
    if (orderStep !== 3) return;
    const { city, postalCode, country, region } = shipAddr;
    if (!city && !postalCode && !country) {
      setMatchedZone(null);
      setZoneChecked(false);
      return;
    }
    let cancelled = false;
    setZoneChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await axios.post('/shipping-zones/match', { city, postalCode, country, region });
        if (cancelled) return;
        if (res.data.success && res.data.matched) {
          setMatchedZone(res.data.zone);
        } else {
          setMatchedZone(null);
        }
        setZoneChecked(true);
      } catch {
        if (!cancelled) { setMatchedZone(null); setZoneChecked(true); }
      } finally {
        if (!cancelled) setZoneChecking(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [shipAddr.city, shipAddr.postalCode, shipAddr.country, shipAddr.region, orderStep]);

  const applyCoupon = async () => {
    if (!couponInput.trim() || !selectedPackage) return;
    setCouponBusy(true);
    setCouponError('');
    try {
      const subtotal = parseFloat(selectedPackage.price) || 0;
      const res = await axios.post('/coupons/validate', {
        code: couponInput.trim().toUpperCase(),
        subtotal,
      });
      if (res.data?.success) {
        setAppliedCoupon(res.data.data);
        setCouponInput('');
      }
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Invalid code');
      setAppliedCoupon(null);
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  // Re-validate the applied coupon whenever the subtotal changes (e.g. the
  // user backs out and picks a different package).
  useEffect(() => {
    if (!appliedCoupon || !selectedPackage) return;
    const subtotal = parseFloat(selectedPackage.price) || 0;
    (async () => {
      try {
        const r = await axios.post('/coupons/validate', { code: appliedCoupon.code, subtotal });
        if (r.data?.success) setAppliedCoupon(r.data.data);
      } catch {
        setAppliedCoupon(null);
        setCouponError('Coupon no longer applies to this package');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackage?._id]);

  const placeOrder = async () => {
    if (!selectedPackage || selectedImages.length === 0) return;
    // Light validation — at minimum a name + line1 + city for delivery, OR all blank for pickup.
    const anyAddr = Object.values(shipAddr).some(v => v && v.trim());
    if (anyAddr) {
      const required = ['fullName', 'line1', 'city'];
      for (const k of required) {
        if (!shipAddr[k]?.trim()) {
          return Swal.fire('Missing Address Info', 'Please fill in name, street and city — or clear the address fields for school pickup.', 'warning');
        }
      }
    }
    setPlacingOrder(true);
    try {
      const res = await axios.post('/orders', {
        studentId: student._id,
        packageId: selectedPackage._id,
        selectedImages,
        notes: orderNotes,
        shippingAddress: anyAddr ? shipAddr : undefined,
        couponCode: appliedCoupon?.code || undefined,
      });
      if (res.data.success) {
        setOrders(prev => [res.data.data, ...prev]);
        setOrderStep(4);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to place order', 'error');
    } finally { setPlacingOrder(false); }
  };

  const resetOrder = () => {
    setOrderStep(1);
    setSelectedImages([]);
    setSelectedPackage(null);
    setOrderNotes('');
  };

  const toggleImageSelection = (url) => {
    setSelectedImages(prev =>
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );
  };

  const [replyFiles, setReplyFiles] = useState([]);

  const replyTicket = async (e) => {
    e.preventDefault();
    if (!replyText.trim() && replyFiles.length === 0) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('message', replyText);
      for (const f of replyFiles) fd.append('files', f);
      const res = await axios.post(`/tickets/${selectedTicket._id}/reply`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        const up = res.data.data;
        setTickets((p) => p.map((t) => (t._id === up._id ? up : t)));
        setSelectedTicket(up);
        setReplyText("");
        setReplyFiles([]);
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
    <div className="flex flex-col pb-24 lg:pb-20 w-full animate-in fade-in duration-500">
      <div className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
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

      <div className="container mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-5 sm:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailCard label="Access Code" value={student.uniqueCode} icon={<KeyRound className="w-5 h-5" />} color="text-blue-600" />
            <DetailCard label="Birthday" value={fmtDate(student.dob)} icon={<Calendar className="w-5 h-5" />} color="text-slate-700" />
          </div>
          <DetailCardFull label="Client Email Address" value={student.parentEmail} icon={<Mail className="w-6 h-6" />} />

          {student.school?.orderDeadline && (() => {
            const deadline = new Date(student.school.orderDeadline);
            const now = new Date();
            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            const past = daysLeft < 0;
            const ship = student.school.shippingCharge || 0;
            return (
              <div className={`rounded-lg border p-5 flex items-start gap-4 ${past ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className={`p-2.5 rounded-lg shrink-0 ${past ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${past ? 'text-amber-700' : 'text-emerald-700'}`}>Order Deadline</p>
                  <p className="font-extrabold text-slate-900 text-lg mt-0.5">{fmtDate(deadline)}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {past
                      ? `Deadline passed — orders now include a $${ship.toFixed(2)} shipping & handling charge.`
                      : `${daysLeft === 0 ? 'Last day!' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`} to order without shipping fees.`}
                  </p>
                </div>
              </div>
            );
          })()}
          
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

          {/* Order Photos */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-lg shrink-0">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="font-bold text-slate-900">Order Your Photos</h4>
              <p className="text-slate-500 text-sm mt-0.5">Select your favourite photos and choose a print or digital package.</p>
            </div>
            <button onClick={() => { resetOrder(); setView('order'); }}
              className="bg-white text-indigo-700 font-bold px-6 py-3 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors whitespace-nowrap flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> Order Now
            </button>
          </div>

          {/* Purchase History — recent orders for this student */}
          {orders.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Purchase History</h4>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{orders.length}</span>
                </div>
                <button
                  onClick={() => { setSelectedOrder(null); setView('order-history'); }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {orders.slice(0, 4).map(o => (
                  <button
                    key={o._id}
                    onClick={() => { setSelectedOrder(o); setView('order-history'); }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {o.package?.name || o.singleProduct?.name || 'Order'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        #{o._id.slice(-8).toUpperCase()} · {new Date(o.createdAt).toLocaleDateString(undefined, { day:'numeric', month:'long', year:'numeric' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-900">${o.totalAmount?.toFixed(2)}</p>
                      <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1 ${
                        o.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        o.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                        o.status === 'Cancelled' ? 'bg-slate-100 text-slate-500' :
                        'bg-amber-100 text-amber-700'
                      }`}>{o.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="space-y-6">
           <div className="bg-white rounded-lg border border-slate-200 p-6">
             <h5 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
               <ImageIcon className="w-4 h-4 text-blue-500" /> 
               Recent Photos
             </h5>
             <div className="grid grid-cols-2 gap-3">
               {allPhotos.slice(0, 4).map((p, i) => (
                 <button
                   key={p._id}
                   type="button"
                   onClick={() => setLightboxIndex(i)}
                   className="aspect-square rounded-lg overflow-hidden border border-slate-100 cursor-zoom-in group"
                 >
                   <img src={p.url} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                 </button>
               ))}
               {allPhotos.length > 4 && (
                 <button onClick={() => setLightboxIndex(4)} className="aspect-square rounded-lg bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-400 group hover:bg-slate-100 transition-colors">
                   <span className="font-bold text-lg">+{allPhotos.length - 4}</span>
                   <span className="text-[10px] font-bold uppercase tracking-widest">View All</span>
                 </button>
               )}
             </div>
             {allPhotos.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No photos available yet</p>}
           </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Ticket className="w-4 h-4 text-orange-500" />
                Activity
              </h5>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <span className="text-sm font-bold text-orange-700">Open Tickets</span>
                  <span className="bg-orange-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">{openCount}</span>
                </div>
                <button onClick={() => setView('order-history')} className="w-full flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  <span className="text-sm font-bold text-indigo-700">My Orders</span>
                  <span className="bg-indigo-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">{orders.length}</span>
                </button>
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

  /* ── Order Flow ── */
  const ORDER_STATUS_COLORS = {
    Pending:    'bg-amber-100 text-amber-700',
    Processing: 'bg-blue-100 text-blue-700',
    Completed:  'bg-emerald-100 text-emerald-700',
    Cancelled:  'bg-slate-100 text-slate-500',
  };

  const OrderView = () => (
    <div className="flex flex-col flex-1 w-full pb-28 lg:pb-12 animate-in fade-in duration-500">
      <div className="w-full">
        {/* Modern Sticky Header for Order Flow */}
        {orderStep < 4 && (
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl lg:text-[22px] font-black text-slate-900 tracking-tight">Order Your Photos</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Step {orderStep} of 3</p>
              </div>
              <button onClick={() => setView('home')} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-100 rounded-xl text-slate-400 transition-all active:scale-90">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deadline banner */}
            {student.school?.orderDeadline && (() => {
              const deadline = new Date(student.school.orderDeadline);
              const past = new Date() > deadline;
              const ship = student.school.shippingCharge || 0;
              return (
                <div className={`mb-4 rounded-xl px-4 py-3 text-xs font-bold flex items-center justify-between gap-3 border shadow-sm ${past ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 opacity-70" />
                    {past
                      ? `Deadline passed — orders include $${ship.toFixed(2)} shipping`
                      : `Order by ${fmtDate(deadline)} to avoid shipping fees`}
                  </span>
                </div>
              );
            })()}

            {/* Progressive Steps Indicator */}
            <div className="flex items-center gap-2">
              {['Photos', 'Package', 'Review'].map((label, idx) => {
                const step = idx + 1;
                const done = orderStep > step;
                const active = orderStep === step;
                return (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border flex-1 justify-center ${
                      active 
                        ? 'bg-[#155dfc] text-white border-[#155dfc] shadow-lg shadow-blue-200' 
                        : done 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-slate-50 text-slate-400 border-slate-100 opacity-60'
                    }`}>
                      <span className={`w-4 h-4 rounded-md flex items-center justify-center ${active ? 'bg-white text-[#155dfc]' : done ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200'}`}>
                        {done ? <CheckCircle2 className="w-3 h-3" /> : <span>{step}</span>}
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-4 lg:p-8">

        {/* Step 1: Select Images */}
        {orderStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black text-slate-900">Choose Photos</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select the photos you want to include</p>
              </div>
            </div>

            {allPhotos.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[8px] p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-[8px] flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-500 font-bold">No photos available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 lg:gap-6">
                {allPhotos.map((photo, i) => {
                  const sel = selectedImages.includes(photo.url);
                  return (
                    <div
                      key={photo._id}
                      className={`group relative aspect-[3/4] rounded-[8px] overflow-hidden border-2 transition-all duration-300 bg-slate-100 ${
                        sel
                          ? 'border-[#155dfc] ring-8 ring-blue-500/5'
                          : 'border-transparent hover:border-slate-200 hover:-translate-y-1'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined' && window.innerWidth < 768) {
                            setLightboxIndex(i);
                          } else {
                            toggleImageSelection(photo.url);
                          }
                        }}
                        className="absolute inset-0 w-full h-full"
                      >
                        <img src={photo.url} alt="" className="w-full h-full object-cover" />
                      </button>

                      {/* Selection Indicator */}
                      <div className={`absolute top-3 left-3 z-10 transition-all transform ${sel ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                        <div className="bg-[#155dfc] text-white p-1 rounded-[8px]">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Hover/Mobile Select Toggle */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleImageSelection(photo.url); }}
                        className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-[8px] flex items-center justify-center transition-all ${
                          sel ? 'bg-white text-[#155dfc]' : 'bg-white/90 text-slate-400 hover:text-[#155dfc] md:opacity-0 md:group-hover:opacity-100'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>

                      {/* Zoom button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                        className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-[8px] bg-white/90 hover:bg-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-all text-slate-700"
                      >
                        <Eye className="w-5 h-5" />
                      </button>

                      <div className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${sel ? 'bg-blue-500/5' : 'group-hover:bg-black/5'}`} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sticky Selection Bar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[8px] p-4 flex items-center justify-between gap-4 z-50 animate-in slide-in-from-bottom-10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-[8px] flex items-center justify-center font-black text-lg transition-colors ${selectedImages.length > 0 ? 'bg-blue-100 text-[#155dfc]' : 'bg-slate-50 text-slate-300'}`}>
                  {selectedImages.length}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Photos Selected</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select at least one</p>
                </div>
              </div>
              <button 
                onClick={() => setOrderStep(2)} 
                disabled={selectedImages.length === 0}
                className="flex items-center gap-3 px-8 py-4 bg-[#155dfc] text-white font-black text-xs uppercase tracking-widest rounded-[8px] hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
              >
                Next Step <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Package */}
        {orderStep === 2 && (
          <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button onClick={() => setOrderStep(1)} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-[8px] text-slate-400 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h4 className="text-xl font-black text-slate-900">Select a Package</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Choose the best option for your memories</p>
              </div>
            </div>

            {packages.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[8px] p-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[8px] flex items-center justify-center mx-auto mb-6">
                  <Package className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-500 font-bold text-lg">No packages available at the moment.</p>
                <p className="text-slate-400 text-sm mt-1">Please check back later or contact support.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
                {packages.map(pkg => {
                  const sel = selectedPackage?._id === pkg._id;
                  return (
                    <button 
                      key={pkg._id} 
                      onClick={() => setSelectedPackage(pkg)}
                      className={`group relative flex flex-col text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden h-full ${
                        sel 
                          ? 'border-[#155dfc] bg-blue-50/30 ring-8 ring-blue-500/5' 
                          : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/10'
                      }`}
                    >
                      {sel && (
                        <div className="absolute top-4 right-4 z-10">
                          <div className="bg-[#155dfc] text-white p-1 rounded-lg shadow-lg">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                      )}

                      <div className="p-8 flex-1">
                        <div className="flex justify-between items-start mb-6">
                          <div className={`p-3 rounded-xl transition-colors ${sel ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                            <Package className="w-6 h-6" />
                          </div>
                        </div>
                        
                        <h5 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{pkg.name}</h5>
                        {pkg.description && <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed line-clamp-3">{pkg.description}</p>}
                        
                        <div className="space-y-4 mb-8">
                          {pkg.features?.map((f, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <div className={`mt-0.5 p-1 rounded-md transition-colors ${sel ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500'}`}>
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <span className="text-sm font-bold text-slate-700 leading-tight">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className={`px-8 py-6 border-t mt-auto flex items-center justify-between ${sel ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50/50 border-slate-50'}`}>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                          <p className="text-2xl font-black text-slate-900">${parseFloat(pkg.price).toFixed(2)}</p>
                        </div>
                        <div className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                          sel ? 'bg-[#155dfc] text-white shadow-xl shadow-blue-500/25' : 'bg-white text-slate-600 border border-slate-200'
                        }`}>
                          {sel ? 'Selected' : 'Choose'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-slate-100">
              <button onClick={() => setOrderStep(1)} className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-colors group">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Photos
              </button>
              <button 
                onClick={() => setOrderStep(3)} 
                disabled={!selectedPackage}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-12 py-4 bg-[#155dfc] text-white font-black text-sm uppercase tracking-widest rounded-[8px] hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
              >
                Review Order <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment Summary */}
        {orderStep === 3 && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-right-8 duration-500">
             <div className="flex items-center gap-4">
              <button onClick={() => setOrderStep(2)} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-[8px] text-slate-400 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h4 className="text-xl font-black text-slate-900">Review Your Order</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Please check everything before completing</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-8">
                {/* Package Selection Details */}
                <div className="bg-white border border-slate-100 rounded-[8px] p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-[#155dfc] rounded-[8px]">
                        <Package className="w-5 h-5" />
                      </div>
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Package Selection</h5>
                    </div>
                    <button onClick={() => setOrderStep(2)} className="text-xs font-bold text-[#155dfc] hover:underline">Change</button>
                  </div>
                  
                  <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[8px] border border-slate-100">
                    <div>
                      <p className="text-[22px] font-black text-slate-900 leading-tight">{selectedPackage?.name}</p>
                      <p className="text-sm font-medium text-slate-500 mt-1 max-w-md leading-relaxed">{selectedPackage?.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Price</p>
                      <p className="text-[22px] font-black text-[#155dfc]">${parseFloat(selectedPackage?.price || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Photo Gallery Summary */}
                <div className="bg-white border border-slate-100 rounded-[8px] p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-500 rounded-[8px]">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Selected Photos ({selectedImages.length})</h5>
                    </div>
                    <button onClick={() => setOrderStep(1)} className="text-xs font-bold text-[#155dfc] hover:underline">Edit Selection</button>
                  </div>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 sm:gap-4">
                    {selectedImages.map((url, i) => (
                      <div key={i} className="aspect-[3/4] rounded-[8px] border border-slate-100 overflow-hidden bg-slate-50 relative group">
                        <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="bg-white border border-slate-100 rounded-[8px] p-8">
                  <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 text-amber-500 rounded-[8px]">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Shipping Details</h5>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Leave blank for school collection</p>
                      </div>
                    </div>

                    {zoneChecking ? (
                      <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-[#155dfc]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checking Zone...</span>
                      </div>
                    ) : matchedZone ? (
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{matchedZone.name} — ${matchedZone.charge.toFixed(2)}</span>
                      </div>
                    ) : zoneChecked && !matchedZone && (
                      <div className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Manual Zone Processing</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input value={shipAddr.fullName} onChange={e => setShipAddr({ ...shipAddr, fullName: e.target.value })} placeholder="Enter your full name" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <input value={shipAddr.phone} onChange={e => setShipAddr({ ...shipAddr, phone: e.target.value })} placeholder="Mobile number" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all" />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Address</label>
                      <input value={shipAddr.line1} onChange={e => setShipAddr({ ...shipAddr, line1: e.target.value })} placeholder="Street address, P.O. box, company name" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all" />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apartment, suite, etc.</label>
                      <input value={shipAddr.line2} onChange={e => setShipAddr({ ...shipAddr, line2: e.target.value })} placeholder="Optional detail" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                      <input value={shipAddr.city} onChange={e => setShipAddr({ ...shipAddr, city: e.target.value })} placeholder="City name" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Postcode</label>
                      <input value={shipAddr.postalCode} onChange={e => setShipAddr({ ...shipAddr, postalCode: e.target.value })} placeholder="Zip or Postcode" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all font-mono uppercase" />
                    </div>
                  </div>
                </div>

                {/* Extras/Upsell Section */}
                {selectedPackage?.upsellProducts?.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[8px] p-8 text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white/20 rounded-[8px]">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <h5 className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Enhance Your Package</h5>
                    </div>
                    <p className="text-sm font-bold text-white/70 mb-6">Mention these add-ons in your instructions to get special pricing.</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {selectedPackage.upsellProducts.map(p => (
                        <div key={p._id} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-[8px] p-4 flex flex-col items-center text-center">
                          <img src={p.imageUrl || '/package-placeholder.png'} alt={p.name} className="w-16 h-16 object-cover rounded-[8px] mb-3" />
                          <p className="text-[11px] font-black line-clamp-1 mb-1">{p.name}</p>
                          <p className="text-lg font-black text-blue-200">${p.price?.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes/Instructions */}
                <div className="bg-white border border-slate-100 rounded-[8px] p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-50 text-slate-500 rounded-[8px]">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Special Instructions</h5>
                  </div>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={4} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[8px] text-sm outline-none focus:bg-white focus:border-[#155dfc] focus:ring-4 focus:ring-blue-50 transition-all resize-none shadow-inner" placeholder="Any specific delivery, printing, or add-on requests..." />
                </div>
              </div>

              {/* Order Summary Checkout Card */}
              <div className="lg:col-span-5">
                {(() => {
                  const subtotal = parseFloat(selectedPackage?.price || 0);
                  const deadline = student.school?.orderDeadline ? new Date(student.school.orderDeadline) : null;
                  const pastDeadline = deadline && new Date() > deadline;
                  const zoneShip = matchedZone ? Number(matchedZone.charge || 0) : 0;
                  const fallbackShip = pastDeadline ? Number(student.school?.shippingCharge || 0) : 0;
                  const shipping = zoneShip || fallbackShip;
                  const shippingLabel = matchedZone ? matchedZone.name : (pastDeadline && fallbackShip > 0 ? 'Late Order' : '');
                  const discount = appliedCoupon ? Number(appliedCoupon.discount || 0) : 0;
                  const total = Math.max(0, subtotal + shipping - discount);
                  return (
                    <div className="sticky top-32 space-y-6">
                      <div className="bg-slate-900 rounded-[8px] p-10 text-white overflow-hidden relative">
                        {/* Background Decoration */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20" />
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-20" />

                        <div className="relative z-10">
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-10">Order Summary</h4>

                          <div className="space-y-6 mb-10">
                            <div className="flex justify-between items-center text-slate-400">
                              <span className="text-sm font-bold uppercase tracking-wider">Subtotal</span>
                              <span className="text-xl font-black text-white">${subtotal.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-slate-400">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold uppercase tracking-wider">Shipping</span>
                                {shippingLabel && <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-1">{shippingLabel}</span>}
                              </div>
                              <span className="text-xl font-black text-white">${shipping.toFixed(2)}</span>
                            </div>

                            {discount > 0 && (
                              <div className="flex justify-between items-center text-emerald-400">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold uppercase tracking-wider">Discount</span>
                                  <span className="text-[10px] font-black bg-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest mt-1 self-start">{appliedCoupon.code}</span>
                                </div>
                                <span className="text-xl font-black">- ${discount.toFixed(2)}</span>
                              </div>
                            )}

                            <div className="h-px bg-white/10 my-8" />

                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Total Payable</p>
                                <p className="text-[22px] font-black text-white tracking-tighter">${total.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-[8px]">Secure Checkout</p>
                              </div>
                            </div>
                          </div>

                          {/* Promo Code */}
                          <div className="mb-10 group">
                            {appliedCoupon ? (
                              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Coupon Applied</p>
                                  <p className="text-sm font-bold text-white mt-0.5">{appliedCoupon.code}</p>
                                </div>
                                <button onClick={removeCoupon} className="text-[10px] font-black text-red-300 hover:text-red-200 uppercase tracking-wider">Remove</button>
                              </div>
                            ) : (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Have a Discount Code?</p>
                                <div className="flex gap-2">
                                  <input value={couponInput} onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} placeholder="ENTER CODE" className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-widest text-white outline-none focus:border-blue-500" />
                                  <button onClick={applyCoupon} disabled={!couponInput.trim() || couponBusy} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg disabled:opacity-40">{couponBusy ? '…' : 'Apply'}</button>
                                </div>
                                {couponError && <p className="text-[11px] font-bold text-red-300 mt-2">{couponError}</p>}
                              </div>
                            )}
                          </div>

                          <div className="bg-slate-800/50 rounded-[8px] p-4 mb-8 border border-slate-700/50">
                            <div className="flex gap-3">
                              <CreditCard className="w-5 h-5 text-blue-400 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-white uppercase">Demo Payment</p>
                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Place order now, pay later via cash or transfer.</p>
                              </div>
                            </div>
                          </div>

                          <button onClick={placeOrder} disabled={placingOrder} className="w-full py-5 bg-blue-600 text-white font-black rounded-[8px] hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3">
                            {placingOrder ? <><Loader2 className="w-5 h-5 animate-spin" /> PLACING ORDER...</> : <><BadgeCheck className="w-5 h-5" /> COMPLETE ORDER</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {orderStep === 4 && (
          <div className="max-w-xl mx-auto py-20 animate-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500 rounded-full blur-3xl opacity-10 animate-pulse" />
              <div className="relative bg-white border border-slate-200 rounded-[8px] p-12 text-center">
                <div className="w-24 h-24 rounded-[8px] bg-emerald-100 flex items-center justify-center mx-auto mb-8 transform rotate-3">
                  <BadgeCheck className="w-12 h-12 text-emerald-600" />
                </div>
                
                <h3 className="text-[22px] font-black text-slate-900 mb-4">Order Received!</h3>
                <p className="text-slate-500 text-lg leading-relaxed mb-10">We've received your photo order. Our team will review the details and contact you shortly to finalize payment and delivery.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { resetOrder(); setView('order-history'); }}
                    className="w-full py-4 bg-slate-100 text-slate-700 font-black rounded-[8px] hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"
                  >
                    View Status
                  </button>
                  <button 
                    onClick={() => { resetOrder(); setView('home'); }}
                    className="w-full py-4 bg-[#155dfc] text-white font-black rounded-[8px] hover:bg-blue-700 transition-all text-sm uppercase tracking-widest border border-blue-100"
                  >
                    Back Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

  /* ── Order History ── */
  const OrderHistoryView = () => (
    <div className="flex flex-col flex-1 w-full p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="w-full">
        {selectedOrder ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Detail Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Orders
                </button>
                <h2 className="text-[22px] font-black text-slate-900">Order Details</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">#{selectedOrder._id.toUpperCase()}</p>
              </div>
              <div className={`px-4 py-1.5 rounded-[8px] text-[10px] font-black uppercase tracking-widest ${ORDER_STATUS_COLORS[selectedOrder.status] || 'bg-slate-100 text-slate-500'}`}>
                {selectedOrder.status}
              </div>
            </div>

            <div className="space-y-6">
              {/* Package Info */}
              <div className="bg-white border border-slate-200 rounded-[8px] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-slate-400" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Package Details</h4>
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-[22px] font-black text-slate-900">{selectedOrder.package?.name || selectedOrder.singleProduct?.name || '—'}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedOrder.selectedImages?.length} photos included</p>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-slate-100 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">${(selectedOrder.itemAmount ?? selectedOrder.totalAmount ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping & Handling</span>
                    <span className="font-semibold">${(selectedOrder.shippingCharge ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 text-base font-black text-slate-900">
                    <span>Total</span>
                    <span className="text-[#155dfc]">${selectedOrder.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>
                <div className="pt-4 mt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Payment Status</span>
                  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-[8px]">{selectedOrder.paymentStatus}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-[8px] p-5">
                  <p className="text-[10px] font-black text-amber-600 uppercase mb-2">My Notes</p>
                  <p className="text-xs text-amber-900 leading-relaxed italic">"{selectedOrder.notes}"</p>
                </div>
              )}

              {/* Photos Grid - Full Width */}
              <div className="bg-white border border-slate-200 rounded-[8px] p-6">
                 <div className="flex items-center justify-between mb-6">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Photos ({selectedOrder.selectedImages?.length})</h4>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {selectedOrder.selectedImages?.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setOrderLightboxUrl(url)}
                        className="aspect-square rounded-[8px] border border-slate-200 overflow-hidden bg-slate-50 relative group cursor-zoom-in"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="p-2 bg-white rounded-full text-slate-900">
                            <Eye className="w-4 h-4" />
                          </span>
                        </div>
                      </button>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[8px] border border-slate-200">
              <div>
                <h3 className="text-[22px] font-black text-slate-900 tracking-tight">Order History</h3>
                <p className="text-slate-500 text-sm mt-1">Review and manage your previous photo packages.</p>
              </div>
              <button 
                onClick={() => { resetOrder(); setView('order'); }}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#155dfc] text-white font-bold rounded-[8px] text-sm hover:bg-blue-700 transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Place New Order
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[8px] p-16 text-center">
                <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h4 className="text-[22px] font-black text-slate-800">No Orders Yet</h4>
                <p className="text-sm text-slate-400 mt-2">You haven't placed any orders yet. Start by exploring our photo packages.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[8px] border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200">
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Details</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Photos</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                        <th className="py-4 px-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map(o => (
                        <tr 
                          key={o._id} 
                          onClick={() => setSelectedOrder(o)}
                          className="group hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[8px] bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                                <Package className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{o.package?.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">#{o._id.slice(-8).toUpperCase()} • {new Date(o.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex -space-x-2">
                              {o.selectedImages?.slice(0, 3).map((url, i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-sm">
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                              {o.selectedImages?.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
                                  +{o.selectedImages.length - 3}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-2.5 py-1 rounded-[8px] text-[9px] font-black uppercase tracking-widest ${ORDER_STATUS_COLORS[o.status] || 'bg-slate-100 text-slate-500'}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <p className="text-sm font-black text-slate-900">${o.totalAmount?.toFixed(2)}</p>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors inline-block" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Tickets List ── */
  const TicketsView = () => (
    <div className="flex flex-col flex-1 w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 pb-28 lg:pb-12 animate-in fade-in duration-500">
      <div className="container mx-auto w-full">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Support Tickets</h3>
            <p className="text-slate-500 mt-1">Track and manage your inquiries.</p>
          </div>
          <button onClick={() => setView("new-ticket")} className="bg-[#155dfc] text-white px-6 py-3 rounded-[8px] text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> New Ticket
          </button>
        </div>

        {loadingTickets ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-[#155dfc] border-t-transparent rounded-full animate-spin" /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-24 bg-white border border-slate-200 rounded-[8px]">
            <MessagesSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No support tickets found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((t) => (
              <button key={t._id} onClick={() => { setSelectedTicket(t); setView("ticket-detail"); }} className="w-full text-left p-6 bg-white border border-slate-200 rounded-[8px] hover:border-[#155dfc] transition-all group relative overflow-hidden">
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
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={allPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          // Only show selection controls while the user is in the order flow.
          selectedUrls={view === 'order' ? selectedImages : undefined}
          onToggleSelect={view === 'order' ? toggleImageSelection : undefined}
        />
      )}
      {/* Standalone fullscreen viewer (used in order-detail) */}
      {orderLightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setOrderLightboxUrl(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOrderLightboxUrl(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={orderLightboxUrl}
            alt=""
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 sticky top-0 h-screen z-50">
        <div className="p-8 border-b border-slate-100">
          <div className="flex justify-center">
            <img src="/ContactSheet-Example.jpg" alt="Media Portal" className="h-16 w-auto object-contain rounded-[8px]" />
          </div>
        </div>

        <nav className="flex-1 px-6 py-6 space-y-2">
          <SidebarLink active={view === "home"} onClick={() => setView("home")} icon={<User className="w-5 h-5" />} label="Overview" />
          <SidebarLink active={view === "order"} onClick={() => { resetOrder(); setView("order"); }} icon={<ShoppingBag className="w-5 h-5" />} label="Order Photos" />
          <SidebarLink active={view === "order-history"} onClick={() => { setSelectedOrder(null); setView("order-history"); }} icon={<History className="w-5 h-5" />} label="Order History" />
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
              {view === "home" ? "Portal Overview" : view === "order" ? "Order Photos" : view === "order-history" ? "My Orders" : view === "tickets" ? "Customer Support" : "Details"}
            </h2>
          </div>
          <div className="flex items-center gap-6">
             {/* Child switcher — only shows when this parent has more than one child */}
             {children.length > 1 && (
               <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                 <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Viewing</span>
                 <select
                   value={student._id}
                   onChange={e => switchChild(children.find(c => c._id === e.target.value))}
                   className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-1"
                 >
                   {children.map(c => (
                     <option key={c._id} value={c._id}>
                       {c.firstName} {c.lastName}
                     </option>
                   ))}
                 </select>
               </div>
             )}
             <NotificationBell onItemClick={handleNotificationClick} />
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
            <NavBtn active={view === "order"} onClick={() => { resetOrder(); setView("order"); }} icon={<ShoppingBag className="w-6 h-6" />} label="Order" />
            <NavBtn active={view === "order-history"} onClick={() => { setSelectedOrder(null); setView("order-history"); }} icon={<History className="w-6 h-6" />} label="History" />
            <NavBtn active={view === "tickets"} onClick={() => setView("tickets")} icon={<MessagesSquare className="w-6 h-6" />} label="Support" badge={openCount} />
            <button onClick={logout} className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Top Header — always visible (notifications + name) */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {student.uploadedImage ? (
              <img src={student.uploadedImage} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-200 shrink-0">
                {student.firstName?.[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900 truncate leading-tight">{student.firstName} {student.lastName}</p>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider truncate">REG: {student.studentId}</p>
            </div>
          </div>
          <NotificationBell />
        </div>

        {/* Mobile Header for detail views */}
        {view !== "home" && view !== "tickets" && (
          <div className="lg:hidden p-4 bg-white border-b border-slate-100 flex items-center gap-4">
            <button onClick={() => setView(view === "ticket-detail" ? "tickets" : "tickets")} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 rotate-180 text-slate-600" /></button>
            <h2 className="font-bold text-slate-900 truncate">{view === "new-ticket" ? "Create Ticket" : selectedTicket?.subject}</h2>
          </div>
        )}

        {/* Content Area */}
        <main className={`flex-1 overflow-y-auto pb-24 lg:pb-0 ${view === "home" ? "" : "p-3 sm:p-4 lg:p-8"}`}>
          <div className="w-full">
            {view === "home" && HomeView()}
            {view === "order" && OrderView()}
            {view === "order-history" && OrderHistoryView()}
            {view === "tickets" && TicketsView()}
            {view === "new-ticket" && <NewTicketForm subject={subject} setSubject={setSubject} message={message} setMessage={setMessage} files={newTicketFiles} setFiles={setNewTicketFiles} onSubmit={createTicket} loading={submitting} />}
            {view === "ticket-detail" && <TicketDetail selectedTicket={selectedTicket} replyText={replyText} setReplyText={setReplyText} replyFiles={replyFiles} setReplyFiles={setReplyFiles} onSubmit={replyTicket} loading={submitting} msgEnd={msgEnd} />}
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

function NewTicketForm({ subject, setSubject, message, setMessage, files, setFiles, onSubmit, loading }) {
  const fileRef = useRef(null);
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
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 ml-1">ATTACHMENTS (OPTIONAL)</label>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const arr = Array.from(e.target.files || []);
            setFiles(prev => [...prev, ...arr]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-2 text-sm font-bold"
        >
          <UploadCloud className="w-4 h-4" />
          Attach Files (images, PDFs, etc.)
        </button>
        {files && files.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg pl-2 pr-1 py-1 text-xs">
                <span className="font-mono truncate max-w-[180px] text-slate-700">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="submit" disabled={loading} className="w-full py-4 bg-[#155dfc] text-white font-bold rounded-lg shadow-lg shadow-blue-100 active:scale-[0.98] transition-all disabled:opacity-50">
        {loading ? "Submitting..." : "Send Ticket"}
      </button>
    </form>
  );
}

function TicketDetail({ selectedTicket, replyText, setReplyText, replyFiles, setReplyFiles, onSubmit, loading, msgEnd }) {
  const fileInputRef = useRef(null);

  const isImage = (mt) => (mt || '').startsWith('image/');
  const fmtBytes = (b) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden lg:h-[600px]">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">{selectedTicket.subject}</h3>
          <p className="text-xs text-slate-500">
            Ticket ID: #{selectedTicket._id.slice(-6).toUpperCase()} • Status: <span className={selectedTicket.status === 'Open' ? 'text-green-600 font-bold' : 'text-slate-500 font-bold'}>{selectedTicket.status}</span>
          </p>
        </div>
        {selectedTicket.assignedTo && (
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned to</p>
            <p className="text-xs font-bold text-slate-700">{selectedTicket.assignedTo.name}</p>
          </div>
        )}
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
                {m.message && <p className="whitespace-pre-wrap">{m.message}</p>}
                {/* Attachments */}
                {m.attachments && m.attachments.length > 0 && (
                  <div className={`grid grid-cols-2 gap-2 ${m.message ? 'mt-2' : ''}`}>
                    {m.attachments.map((att, ai) => (
                      isImage(att.mimeType) ? (
                        <a key={ai} href={att.url} target="_blank" rel="noreferrer" className="block">
                          <img src={att.url} alt={att.filename} className="w-full h-32 object-cover rounded-lg" />
                        </a>
                      ) : (
                        <a
                          key={ai}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isParent ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200'}`}
                          download={att.filename}
                        >
                          <Download className={`w-3.5 h-3.5 ${isParent ? '' : 'text-slate-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{att.filename}</p>
                            <p className={`text-[10px] ${isParent ? 'text-white/70' : 'text-slate-400'}`}>{fmtBytes(att.size)}</p>
                          </div>
                        </a>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={msgEnd} />
      </div>

      {selectedTicket.status !== "Closed" ? (
        <div className="bg-white p-4 border-t border-slate-200">
          {/* Selected attachments preview */}
          {replyFiles && replyFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-100">
              {replyFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg pl-2 pr-1 py-1 text-xs">
                  <span className="font-mono truncate max-w-[160px] text-slate-700">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setReplyFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const arr = Array.from(e.target.files || []);
                setReplyFiles(prev => [...prev, ...arr]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 transition-colors"
              title="Attach files"
            >
              <UploadCloud className="w-4 h-4" />
            </button>
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 p-3.5 rounded-lg outline-none focus:border-[#155dfc] focus:ring-2 focus:ring-[#155dfc]/10 transition-all text-sm"
              placeholder="Type your message here..."
            />
            <button
              disabled={loading || (!replyText.trim() && (!replyFiles || replyFiles.length === 0))}
              className="bg-[#155dfc] hover:bg-blue-600 text-white px-5 py-3.5 rounded-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-sm"
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