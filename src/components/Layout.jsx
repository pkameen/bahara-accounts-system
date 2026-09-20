import { useState } from "react"; 
import { useLocation, Outlet, useNavigate, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import { FiMenu, FiSearch, FiBell, FiChevronDown, FiUser, FiLogOut } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import PwaBanner, { OnlineOfflineBadge, InstallAppButton } from "./PwaBanner";

export default function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, role, logout } = useAuth();
  
  // Format page title
  const pageTitle = location.pathname.substring(1).replace("-", " ") || "Dashboard";
  const userName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "User";
  const roleLabel = role === "admin" ? "Admin" : "Employee";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-[#FCFCFC] overflow-hidden font-['Inter'] safe-area-inset">
      {/* Sidebar with mobile control */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
        {/* PWA System Banners (Offline & SW updates) */}
        <PwaBanner />

        {/* Premium Top Navbar */}
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 lg:px-10 z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-3 sm:gap-5">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-2xl text-[#111] hover:text-[#D4AF37] transition-colors p-1">
              <FiMenu />
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#111] capitalize font-['Poppins'] tracking-tight truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 lg:gap-8">
            <div className="hidden md:flex items-center bg-gray-50 rounded-full px-5 py-3 border border-gray-100 focus-within:border-[#D4AF37]/50 focus-within:ring-4 focus-within:ring-[#D4AF37]/10 transition-all w-72">
              <FiSearch className="text-gray-400 text-lg" />
              <input type="text" placeholder="Search anything..." className="bg-transparent border-none outline-none ml-3 w-full text-sm font-medium placeholder-gray-400 text-[#111]" />
            </div>

            {/* PWA Install Button when available */}
            <InstallAppButton />

            {/* Online / Offline Status Badge */}
            <OnlineOfflineBadge />

            <div className="hidden xl:block text-sm font-semibold text-gray-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <button className="relative p-2 text-gray-400 hover:text-[#111] transition-colors">
              <FiBell className="text-xl" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#D4AF37] border-2 border-white rounded-full"></span>
            </button>

            {/* Profile Avatar & Dropdown Section */}
            <div className="relative">
              <div 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 cursor-pointer group select-none"
              >
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userName}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-[#D4AF37]/50 shadow-lg group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#111] text-[#D4AF37] flex items-center justify-center font-bold text-lg shadow-lg group-hover:scale-105 transition-transform">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block">
                  <p className="text-sm font-bold text-[#111] leading-none">{userName}</p>
                  <p className="text-xs text-[#D4AF37] mt-1 font-semibold uppercase tracking-wider">{roleLabel}</p>
                </div>
                <FiChevronDown className="hidden lg:block text-gray-400 group-hover:text-[#111] transition-colors" />
              </div>


              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div 
                  className="absolute right-0 mt-3 w-56 bg-white rounded-2xl border border-gray-100 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2"
                  onMouseLeave={() => setIsProfileMenuOpen(false)}
                >
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#111] rounded-xl transition-colors"
                  >
                    <FiUser className="text-[#D4AF37] text-lg" /> My Profile
                  </Link>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                  >
                    <FiLogOut className="text-lg" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>


        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 scroll-smooth custom-scrollbar">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}