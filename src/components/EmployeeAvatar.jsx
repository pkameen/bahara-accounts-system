import { useState, useEffect } from "react";
import logoIcon from "../assets/bahara.logo.jpg";

/**
 * Helper to identify whether an employee/user entity is an Admin.
 */
export const checkIsAdmin = (emp) => {
  if (!emp) return false;
  if (emp.isAdmin === true) return true;
  const roleStr = String(emp.role || emp.userRole || emp.createdByRole || "").toLowerCase();
  if (roleStr === "admin") return true;
  const uidStr = String(emp.uid || emp.userId || emp.createdByUserId || "").toLowerCase();
  if (uidStr === "admin" || uidStr === "admin_legacy" || uidStr === "admin_uid_2026") return true;
  const emailStr = String(emp.email || "").toLowerCase();
  if (emailStr.includes("admin")) return true;
  if (emp.name === "Admin" && !emp.photoURL && !emp.photoUrl) return true;
  return false;
};

/**
 * Unified EmployeeAvatar Component
 * - Admin: Official Bahara International Company Logo
 * - Employee with photo: Uploaded employee photo
 * - Employee without photo / broken photo: First initial fallback
 */
export default function EmployeeAvatar({
  emp,
  role,
  className = "w-10 h-10",
  textClassName = "text-sm",
  roundedClassName = "rounded-full"
}) {
  const [imgError, setImgError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const isAdminUser = checkIsAdmin(emp) || role === "admin" || emp?.role === "admin";
  const photo = emp?.photoURL || emp?.photoUrl || emp?.photo || emp?.profilePhoto || emp?.imageUrl || emp?.avatarUrl;
  const nameStr = emp?.name || emp?.displayName || "User";
  const initial = nameStr.charAt(0).toUpperCase() || "E";

  useEffect(() => {
    setImgError(false);
  }, [photo]);

  // 1. Admin Avatar -> Official Bahara International Company Logo
  if (isAdminUser) {
    if (!logoError) {
      return (
        <div className={`${className} ${roundedClassName} bg-white border border-[#D4AF37]/60 shadow-sm flex items-center justify-center overflow-hidden shrink-0`}>
          <img
            src={logoIcon}
            alt="Bahara International Logo"
            onError={() => setLogoError(true)}
            className="w-full h-full object-contain p-0.5"
          />
        </div>
      );
    }
    // Safe brand fallback if logo image load fails
    return (
      <div className={`${className} ${roundedClassName} bg-[#111] text-[#D4AF37] font-bold flex items-center justify-center border border-[#D4AF37]/60 shrink-0 ${textClassName}`}>
        B
      </div>
    );
  }

  // 2. Regular Employee with Photo
  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={nameStr ? `${nameStr}'s photo` : "Employee photo"}
        onError={() => setImgError(true)}
        className={`${className} ${roundedClassName} object-cover border border-[#D4AF37]/50 shadow-sm shrink-0`}
      />
    );
  }

  // 3. Regular Employee without Photo / Broken Photo -> Initial Fallback
  return (
    <div className={`${className} ${roundedClassName} bg-[#111] text-[#D4AF37] font-bold flex items-center justify-center shrink-0 ${textClassName}`}>
      {initial}
    </div>
  );
}
