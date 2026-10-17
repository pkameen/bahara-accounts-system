import { NavLink, useLocation } from "react-router-dom";
import { FiHome, FiFileText, FiPlusCircle, FiLayers, FiUser } from "react-icons/fi";
import { motion } from "framer-motion";

/**
 * Five-item Mobile Bottom Navigation for Bahara Works Employees
 * Aligned with Bahara International brand identity:
 * - Forest Green (#0B2414, #143822)
 * - Muted Gold (#D4AF37)
 * - Warm Ivory/White background
 * 
 * Destinations:
 * 1. Home -> /employee-dashboard
 * 2. Invoice -> /invoice
 * 3. Expense -> /expenses
 * 4. Stock -> /stock-management (or /employee-stock)
 * 5. Profile -> /profile
 */
export default function EmployeeBottomNav() {
  const location = useLocation();

  const navItems = [
    {
      name: "Home",
      path: "/employee-dashboard",
      icon: <FiHome className="text-xl" />,
      isActive: location.pathname === "/employee-dashboard" || location.pathname === "/"
    },
    {
      name: "Invoice",
      path: "/invoice",
      icon: <FiFileText className="text-xl" />,
      isActive: location.pathname === "/invoice"
    },
    {
      name: "Expense",
      path: "/expenses",
      icon: <FiPlusCircle className="text-xl" />,
      isActive: location.pathname === "/expenses"
    },
    {
      name: "My Stock",
      path: "/stock-management",
      icon: <FiLayers className="text-xl" />,
      isActive: location.pathname === "/stock-management" || location.pathname === "/employee-stock"
    },
    {
      name: "Profile",
      path: "/profile",
      icon: <FiUser className="text-xl" />,
      isActive: location.pathname === "/profile"
    }
  ];

  return (
    <nav
      aria-label="Employee Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-xl border-t border-stone-200/90 shadow-[0_-8px_30px_rgba(11,36,20,0.08)] select-none"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
      }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center px-1 pt-1.5">
        {navItems.map((item) => {
          const active = item.isActive;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className="relative flex flex-col items-center justify-center py-1.5 px-1 min-h-[50px] transition-all duration-200 group focus:outline-none"
            >
              {/* Active top indicator pill */}
              {active && (
                <motion.div
                  layoutId="employee-bottom-nav-indicator"
                  className="absolute -top-1.5 w-10 h-1 bg-gradient-to-r from-[#143822] via-[#D4AF37] to-[#143822] rounded-full shadow-[0_2px_8px_rgba(212,175,55,0.4)]"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}

              {/* Icon Container with subtle active pill */}
              <div
                className={`w-10 h-7 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? "text-[#143822] bg-[#143822]/10 scale-105"
                    : "text-stone-400 group-hover:text-stone-600 group-active:scale-95"
                }`}
              >
                {item.icon}
              </div>

              {/* Short Label */}
              <span
                className={`text-[10px] tracking-tight mt-0.5 transition-colors duration-200 truncate font-['Poppins'] ${
                  active
                    ? "font-bold text-[#143822]"
                    : "font-semibold text-stone-400 group-hover:text-stone-600"
                }`}
              >
                {item.name}
              </span>

              {/* Gold Micro Dot for active state */}
              {active && (
                <span className="w-1 h-1 rounded-full bg-[#D4AF37] mt-0.5 shadow-xs" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
