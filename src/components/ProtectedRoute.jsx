import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { currentUser, role, loading } = useAuth();

  // Wait for auth initialization and role resolution before rendering routes
  if (loading || (currentUser && !role)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#091512]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#059669] border-t-[#D4AF37] rounded-full animate-spin"></div>
          <p className="text-[#D4AF37] font-semibold text-sm font-['Poppins'] tracking-wider">BAHARA INTERNATIONAL</p>
          <p className="text-gray-400 text-xs font-medium">Authenticating & Initializing Portal...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    if (role === "employee") {
      return <Navigate to="/employee-dashboard" replace />;
    } else if (role === "admin") {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
}
