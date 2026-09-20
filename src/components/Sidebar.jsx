import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  FiPieChart, FiShoppingBag, FiPlus, 
  FiFileText, FiDollarSign, FiSettings, FiUsers, FiUser, FiLogOut, FiX
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import logoIcon from '../assets/bahara.logo.jpg'; 
import { InstallAppButton } from "./PwaBanner";

const adminNavItems = [
  { name: "Dashboard", path: "/dashboard", icon: <FiPieChart /> },
  { name: "Products", path: "/products", icon: <FiShoppingBag /> },
  { name: "Add Product", path: "/add-product", icon: <FiPlus /> },
  { name: "Reports", path: "/reports", icon: <FiFileText /> },
  { name: "Expenses", path: "/expenses", icon: <FiDollarSign /> },
  { name: "Invoice", path: "/invoice", icon: <FiFileText /> },
  { name: "Employees", path: "/employees", icon: <FiUsers /> },
  { name: "Settings", path: "/settings", icon: <FiSettings /> },
];

const employeeNavItems = [
  { name: "Dashboard", path: "/employee-dashboard", icon: <FiPieChart /> },
  { name: "Create Invoice", path: "/invoice", icon: <FiFileText /> },
  { name: "My Expenses", path: "/expenses", icon: <FiDollarSign /> },
  { name: "My Profile", path: "/profile", icon: <FiUser /> },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = role === "employee" ? employeeNavItems : adminNavItems;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        className={`fixed lg:static inset-y-0 left-0 w-[280px] shrink-0 bg-[#111111] text-gray-400 flex flex-col shadow-2xl z-50 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]`}
      >
        {/* Branding */}
        <div className="flex items-center justify-between px-7 py-9 relative mt-2 mb-2">
          <div className="flex items-center gap-4 group cursor-default">
            <div className="w-12 h-12 rounded-[15px] mt-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg group-hover:border-[#D4AF37]/50 group-hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all duration-500 overflow-hidden">
              <img src={logoIcon} alt="Bahara International Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="flex flex-col justify-center">
              <h2 className="text-white font-bold tracking-tight text-[17px] mt-3.5 whitespace-nowrap leading-tight font-['Poppins']">Bahara International</h2>
              <p className="text-[#D4AF37] text-[8px] tracking-wider uppercase mt-0.5 font-bold">
                {role === "employee" ? "Sales Portal" : "Global Spice Export"}
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-white text-2xl absolute right-6">
            <FiX />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-5 space-y-2 overflow-y-auto pb-4 custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-4 rounded-[20px] transition-all duration-300 font-medium relative overflow-hidden group ${
                  isActive 
                    ? "bg-white/10 text-white shadow-lg shadow-black/20 border border-white/5" 
                    : "hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl z-10 transition-colors ${isActive ? "text-[#D4AF37]" : "group-hover:text-[#D4AF37]"}`}>
                    {item.icon}
                  </span>
                  <span className="z-10">{item.name}</span>
                  {isActive && (
                    <motion.div layoutId="sidebar-active" className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D4AF37] rounded-r-full shadow-[0_0_15px_rgba(212,175,55,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-5 border-t border-white/5 space-y-3">
          <InstallAppButton className="w-full justify-center" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-[18px] bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 border border-white/5 hover:border-red-500/20 font-bold transition-all text-sm cursor-pointer"
          >
            <FiLogOut className="text-lg" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}