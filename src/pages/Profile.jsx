import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { FiMail, FiPhone, FiShield, FiKey, FiLock } from "react-icons/fi";

export default function Profile() {
  const { currentUser, userProfile, role, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const name = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "User";
  const phone = userProfile?.phone || "Not provided";
  const email = userProfile?.email || currentUser?.email || "";
  const status = userProfile?.status || "active";

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      toast.success("Password updated successfully!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }});
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to update password. You may need to re-authenticate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10 font-['Inter']">
      <Toaster />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">My Profile</h1>
        <p className="text-gray-500 mt-1 font-medium">Manage your personal credentials and security settings</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-5 bg-[#111] text-white rounded-[32px] p-8 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] blur-[70px] opacity-20 rounded-full" />
          
          {userProfile?.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt={name}
              className="w-24 h-24 rounded-3xl object-cover border-2 border-[#D4AF37] mb-4 shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-bold text-4xl mb-4 shadow-xl">
              {name.charAt(0).toUpperCase()}
            </div>
          )}


          <h2 className="text-2xl font-bold text-white font-['Poppins']">{name}</h2>
          <span className="mt-1 px-3 py-1 bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold uppercase tracking-wider rounded-full border border-[#D4AF37]/30">
            {role === "admin" ? "Administrator" : "Sales Employee"}
          </span>

          <div className="w-full mt-8 space-y-4 text-left border-t border-white/10 pt-6">
            <div className="flex items-center gap-3 text-sm">
              <FiMail className="text-[#D4AF37] text-lg shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Email</span>
                <span className="font-semibold text-gray-200">{email}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <FiPhone className="text-[#D4AF37] text-lg shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Phone</span>
                <span className="font-semibold text-gray-200">{phone}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <FiShield className="text-[#D4AF37] text-lg shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Account Status</span>
                <span className="font-semibold text-green-400 capitalize">{status}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Change Password Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-7 bg-white rounded-[32px] p-8 border border-gray-100 premium-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gray-50 text-[#D4AF37] flex items-center justify-center text-xl font-bold">
              <FiKey />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Change Password</h3>
              <p className="text-xs text-gray-400 font-medium">Update your Firebase account login password</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                New Password
              </label>
              <div className="relative flex items-center">
                <FiLock className="absolute left-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <div className="relative flex items-center">
                <FiLock className="absolute left-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#111] text-[#D4AF37] hover:bg-[#222] py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
