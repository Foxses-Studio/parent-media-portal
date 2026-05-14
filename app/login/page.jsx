"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Calendar, Loader2, GraduationCap, Eye, EyeOff } from "lucide-react";
import useAxios from "@/hooks/useAxios";
import Swal from "sweetalert2";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", uniqueCode: "", dob: "" });
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const router = useRouter();
  const axios = useAxios();

  // Prefill the access code if the QR code (or any link) carried ?code=… .
  // Reading window.location directly (instead of useSearchParams) sidesteps
  // Next.js's Suspense-boundary requirement during SSG builds.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('code');
      if (!raw) return;
      const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normalized) {
        setForm((p) => (p.uniqueCode ? p : { ...p, uniqueCode: normalized }));
      }
    } catch {}
  }, []);

  const handleChange = (e) => {
    let val = e.target.value;
    // Access codes are 8-char alphanumeric (uppercase). Normalize so users
    // can type lowercase or mix case and it still works.
    if (e.target.name === 'uniqueCode') {
      val = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    setForm((p) => ({ ...p, [e.target.name]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      const res = await axios.post("/auth/parent-login", payload);
      if (res.data.success) {
        localStorage.setItem("parentToken", res.data.token);
        localStorage.setItem("studentDetails", JSON.stringify(res.data.student));
        router.push("/dashboard");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: err.response?.data?.message || "Invalid credentials. Please try again.",
        confirmButtonColor: "#155dfc",
        customClass: { popup: "rounded-lg text-sm" },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white sm:bg-[#f8fafc]">
      {/* Desktop Left Panel - Hidden on Mobile */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#155dfc] items-center justify-center p-12 overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#155dfc] to-[#0a45c7]" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#000]/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-lg">
          <img src="/ContactSheet-Example.jpg" alt="Media Portal" className="h-24 w-auto object-contain rounded-2xl mb-8 shadow-2xl" />
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-6">
            Everything you need <br />
            <span className="text-blue-200">in one place.</span>
          </h2>
          <p className="text-lg text-blue-100/80 leading-relaxed mb-8">
            Access your student's progress, photos, and support records with our simplified client portal. Secure, fast, and built for you.
          </p>
          
          <div className="grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
            <div>
              <p className="text-white font-bold text-2xl">100%</p>
              <p className="text-blue-100/60 text-sm">Secure Access</p>
            </div>
            <div>
              <p className="text-white font-bold text-2xl">24/7</p>
              <p className="text-blue-100/60 text-sm">Support Sync</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel / Mobile View */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px]">
          
          {/* Header Section - Shown only on Mobile/Small Desktop or styled specifically */}
          <div className="mb-10 flex flex-col items-start">
            <img src="/ContactSheet-Example.jpg" alt="Media Portal" className="w-20 h-auto object-contain rounded-lg mb-6 shadow-lg" />
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-2">Please enter your details to sign in to your portal</p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 ml-1">Client Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#155dfc] transition-colors" />
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@email.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[15px] focus:ring-4 focus:ring-[#155dfc]/5 focus:border-[#155dfc] transition-all outline-none text-slate-800 placeholder:text-slate-400 shadow-sm"
                />
              </div>
            </div>

            {/* Access Code Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 ml-1">Access Code</label>
              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#155dfc] transition-colors" />
                <input
                  type={showCode ? "text" : "password"}
                  name="uniqueCode"
                  required
                  maxLength={8}
                  minLength={8}
                  value={form.uniqueCode}
                  onChange={handleChange}
                  placeholder="8-character code"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-11 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-[15px] font-mono tracking-widest uppercase focus:ring-4 focus:ring-[#155dfc]/5 focus:border-[#155dfc] transition-all outline-none text-slate-800 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* DOB Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 ml-1">Student Date of Birth</label>
              <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#155dfc] transition-colors" />
                <input
                  type="date"
                  name="dob"
                  required
                  value={form.dob}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[15px] focus:ring-4 focus:ring-[#155dfc]/5 focus:border-[#155dfc] transition-all outline-none text-slate-800 shadow-sm"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#155dfc] hover:bg-[#0e4ecf] text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Minimal Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-slate-400">
              Need help? <a href="#" className="text-[#155dfc] font-medium hover:underline">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}