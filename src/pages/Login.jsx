import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { FiUser, FiLock, FiArrowRight, FiShield, FiEye, FiEyeOff } from "react-icons/fi";
import logoIcon from "../assets/bahara.logo.jpg";

export default function Login() {
  const [userIdInput, setUserIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { currentUser, role, login } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to respective dashboard
  useEffect(() => {
    if (currentUser && role) {
      if (role === "admin") {
        navigate("/dashboard", { replace: true });
      } else if (role === "employee") {
        navigate("/employee-dashboard", { replace: true });
      }
    }
  }, [currentUser, role, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userIdInput || !password) {
      toast.error("Please fill in both User ID and password");
      return;
    }

    setLoading(true);
    try {
      const res = await login(userIdInput, password);
      toast.success("Welcome back!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }});
      
      const targetRoute = res?.role === "employee" ? "/employee-dashboard" : "/dashboard";
      navigate(targetRoute, { replace: true });
    } catch (error) {
      console.error("Login Error:", error);
      if (error.message === "ACCOUNT_INACTIVE") {
        toast.error("Your employee account is currently inactive. Please contact administrator.");
      } else if (
        error.message === "INVALID_CREDENTIALS" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/api-key-not-valid" ||
        error.message?.includes("api-key-not-valid")
      ) {
        toast.error("Invalid User ID or password");
      } else {
        toast.error(error.message || "Failed to log in");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#091512] flex items-center justify-center p-4 relative overflow-hidden font-['Inter']">
      <Toaster />
      
      {/* Background Emerald & Champagne Decorative Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#059669] blur-[150px] opacity-25 rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#D4AF37] blur-[140px] opacity-10 rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#0F221E]/90 border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative z-10 backdrop-blur-xl"
      >
        {/* Branding Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-white/10 to-white/5 border border-[#D4AF37]/50 flex items-center justify-center shadow-xl mb-4 group overflow-hidden">
            <img src={logoIcon} alt="Bahara International Logo" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-['Poppins']">
            BAHARA INTERNATIONAL
          </h1>
          <p className="text-[#D4AF37] text-[11px] tracking-wider uppercase font-bold mt-1.5">
            Trusted Global Spice Export Partner
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
              User ID
            </label>
            <div className="relative flex items-center">
              <FiUser className="absolute left-4 text-emerald-400 text-lg pointer-events-none" />
              <input
                type="text"
                required
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="e.g. admin or employee ID"
                className="w-full bg-[#162E29] border border-white/10 focus:border-[#D4AF37] focus:bg-[#1A3832] rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium text-white placeholder-gray-400 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
              Password
            </label>
            <div className="relative flex items-center">
              <FiLock className="absolute left-4 text-emerald-400 text-lg pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#162E29] border border-white/10 focus:border-[#D4AF37] focus:bg-[#1A3832] rounded-2xl py-3.5 pl-12 pr-12 text-sm font-medium text-white placeholder-gray-400 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <FiEyeOff className="text-lg" /> : <FiEye className="text-lg" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-[#D4AF37] to-[#B89428] text-[#091512] font-bold py-4 rounded-2xl shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#091512] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Sign In
                <FiArrowRight className="text-lg group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Security Badge */}
        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-gray-400 text-xs font-medium">
          <FiShield className="text-[#D4AF37]" />
          Secured with Firebase Authentication
        </div>
      </motion.div>
    </div>
  );
}
