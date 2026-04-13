"use client";

import React, { useState } from "react";
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

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post("/auth/parent-login", form);
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
        customClass: { popup: "rounded-xl text-sm" },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] sm:bg-[#f1f5f9] p-0 sm:p-4">
      {/* Main Container */}
      <div className="w-full max-w-[440px] bg-white min-h-screen sm:min-h-0 sm:rounded-2xl sm:shadow-sm border-none sm:border sm:border-slate-200 overflow-hidden">
        
        {/* Header Section */}
        <div className="pt-12 pb-8 px-8 flex flex-col items-start">
          <div className="w-12 h-12 bg-[#155dfc]/10 rounded-xl flex items-center justify-center mb-6">
            <GraduationCap className="w-7 h-7 text-[#155dfc]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Parent Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to track your student's progress</p>
        </div>

        {/* Form Section */}
        <div className="px-8 pb-12">
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 ml-1">Parent Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#155dfc] transition-colors" />
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@email.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[15px] focus:ring-4 focus:ring-[#155dfc]/5 focus:border-[#155dfc] transition-all outline-none text-slate-800 placeholder:text-slate-400"
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
                  maxLength={6}
                  value={form.uniqueCode}
                  onChange={handleChange}
                  placeholder="6-digit code"
                  className="w-full pl-11 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-[15px] font-mono tracking-widest focus:ring-4 focus:ring-[#155dfc]/5 focus:border-[#155dfc] transition-all outline-none text-slate-800"
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
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[15px] focus:ring-4 focus:ring-[#155dfc]/5 focus:border-[#155dfc] transition-all outline-none text-slate-800"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#155dfc] hover:bg-[#0e4ecf] text-white font-semibold py-4 rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
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