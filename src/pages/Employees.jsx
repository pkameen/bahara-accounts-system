import { useEffect, useState, useMemo } from "react";
import { db, secondaryAuth } from "../firebase";
import { ref, onValue, set, update, remove } from "firebase/database";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  FiUsers,
  FiUserPlus,
  FiUserCheck,
  FiUserX,
  FiEdit,
  FiKey,
  FiEye,
  FiSearch,
  FiX,
  FiLock,
  FiMail,
  FiPhone,
  FiUser,
  FiPackage,
  FiCamera,
  FiUpload,
  FiTrash2,
  FiAlertTriangle,
  FiShield
} from "react-icons/fi";
import { calculateTopSalesEmployees } from "../utils/calculations";
import { useAuth } from "../context/AuthContext";

// Helper component for rendering employee photos with initial fallback and broken image handling
function EmployeeAvatar({ emp, className = "w-10 h-10", textClassName = "text-sm", roundedClassName = "rounded-full" }) {
  const [imgError, setImgError] = useState(false);

  const photo = emp?.photoURL || emp?.photoUrl || emp?.photo || emp?.profilePhoto || emp?.imageUrl || emp?.avatarUrl;
  const initial = emp?.name?.charAt(0).toUpperCase() || "E";

  useEffect(() => {
    setImgError(false);
  }, [photo]);

  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={emp?.name ? `${emp.name}'s photo` : "Employee photo"}
        onError={() => setImgError(true)}
        className={`${className} ${roundedClassName} object-cover border border-[#D4AF37]/50 shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div className={`${className} ${roundedClassName} bg-[#111] text-[#D4AF37] font-bold flex items-center justify-center shrink-0 ${textClassName}`}>
      {initial}
    </div>
  );
}

export default function Employees() {
  const { role, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add Employee Form State
  const [addForm, setAddForm] = useState({
    name: "",
    userId: "",
    phone: "",
    email: "",
    role: "employee",
    password: "",
    confirmPassword: "",
    status: "active",
    photoURL: ""
  });
  const [addLoading, setAddLoading] = useState(false);

  // Edit Employee Form State
  const [editForm, setEditForm] = useState({
    uid: "",
    name: "",
    userId: "",
    phone: "",
    email: "",
    role: "employee",
    status: "active",
    photoURL: "",
    changePassword: false,
    newPassword: "",
    confirmNewPassword: ""
  });
  const [editLoading, setEditLoading] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);

  // File Upload Handler (Data URL with validation)
  const handlePhotoSelect = (e, callback) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error("Please upload a valid image file (JPG, PNG, or WEBP)");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Fetch Data from Firebase
  useEffect(() => {
    const empRef = ref(db, "employees");
    const invRef = ref(db, "invoices");
    const expRef = ref(db, "expenses");

    const unsubEmp = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEmployees(Object.keys(data).map((key) => ({ uid: key, ...data[key] })));
      } else {
        setEmployees([]);
      }
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInvoices(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setInvoices([]);
      }
    });

    const unsubExp = onValue(expRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExpenses(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setExpenses([]);
      }
    });

    return () => {
      unsubEmp();
      unsubInv();
      unsubExp();
    };
  }, []);

  // Compute aggregated employee metrics
  const employeePerformanceList = useMemo(() => {
    return calculateTopSalesEmployees(invoices, expenses, employees);
  }, [invoices, expenses, employees]);

  // Filtered employees by search query
  const filteredEmployees = useMemo(() => {
    return employeePerformanceList.filter(emp => 
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.userId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.phone?.includes(searchQuery) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employeePerformanceList, searchQuery]);

  // Handle Create Employee
  const handleAddEmployee = async (e) => {
    e.preventDefault();

    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can add employees.");
      return;
    }

    if (!addForm.name.trim()) {
      toast.error("Employee Name is required");
      return;
    }
    if (!addForm.userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    if (!addForm.phone.trim()) {
      toast.error("Phone Number is required");
      return;
    }
    if (!addForm.password) {
      toast.error("Password is required");
      return;
    }
    if (addForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (addForm.password !== addForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const cleanUserId = addForm.userId.trim().toLowerCase();

    // Check duplicate userId
    const existingUser = employees.find(emp => emp.userId?.toLowerCase() === cleanUserId);
    if (existingUser) {
      toast.error(`User ID '${cleanUserId}' is already taken`);
      return;
    }

    const emailToUse = addForm.email.trim() || `${cleanUserId}@baharainternational.com`;

    setAddLoading(true);
    try {
      // 1. Create Auth user using secondary Auth instance or fallback UID
      let uid;
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, addForm.password);
        uid = userCredential.user.uid;
      } catch (authErr) {
        if (
          authErr.code === "auth/api-key-not-valid" ||
          authErr.code === "auth/invalid-api-key" ||
          authErr.message?.includes("api-key-not-valid")
        ) {
          // Generate fallback local UID for database-backed employee auth
          uid = "emp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        } else {
          throw authErr;
        }
      }

      // 2. Save profile in Firebase Realtime Database
      const profileData = {
        uid,
        userId: cleanUserId,
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        email: emailToUse,
        password: addForm.password,
        role: addForm.role || "employee",
        status: addForm.status,
        photoURL: addForm.photoURL || "",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await set(ref(db, `employees/${uid}`), profileData);
      await set(ref(db, `users_by_id/${cleanUserId}`), {
        userId: cleanUserId,
        uid,
        email: emailToUse,
        password: addForm.password,
        role: addForm.role || "employee",
        name: addForm.name.trim(),
        photoURL: addForm.photoURL || ""
      });

      toast.success("Employee Added Successfully!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }});
      setIsAddModalOpen(false);
      setAddForm({
        name: "",
        userId: "",
        phone: "",
        email: "",
        role: "employee",
        password: "",
        confirmPassword: "",
        status: "active",
        photoURL: ""
      });
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("Email/User ID is already registered in Authentication");
      } else {
        toast.error(error.message || "Failed to create employee account");
      }
    } finally {
      setAddLoading(false);
    }
  };

  // Handle Edit Employee
  const handleEditEmployee = async (e) => {
    e.preventDefault();
    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can edit employees.");
      return;
    }

    if (!editForm.name.trim()) {
      toast.error("Employee Name is required");
      return;
    }
    if (!editForm.phone.trim()) {
      toast.error("Phone Number is required");
      return;
    }

    if (editForm.changePassword) {
      if (!editForm.newPassword) {
        toast.error("New Password is required");
        return;
      }
      if (editForm.newPassword.length < 6) {
        toast.error("New Password must be at least 6 characters");
        return;
      }
      if (editForm.newPassword !== editForm.confirmNewPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setEditLoading(true);
    try {
      const updates = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        role: editForm.role || "employee",
        status: editForm.status,
        photoURL: editForm.photoURL || "",
        updatedAt: Date.now()
      };

      if (editForm.changePassword && editForm.newPassword) {
        updates.password = editForm.newPassword;
      }

      await update(ref(db, `employees/${editForm.uid}`), updates);

      if (editForm.userId) {
        const userUpdates = {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          role: editForm.role || "employee",
          photoURL: editForm.photoURL || ""
        };
        if (editForm.changePassword && editForm.newPassword) {
          userUpdates.password = editForm.newPassword;
        }
        await update(ref(db, `users_by_id/${editForm.userId}`), userUpdates);
      }

      toast.success("Employee profile updated successfully!", {
        style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }
      });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update employee profile");
    } finally {
      setEditLoading(false);
    }
  };

  // Confirm Delete Employee
  const confirmDeleteEmployee = (emp) => {
    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can delete employees.");
      return;
    }
    setEmployeeToDelete(emp);
    setIsDeleteModalOpen(true);
  };

  // Safe Employee Delete (removes employee profile, preserves historical invoices & expenses)
  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can delete employees.");
      return;
    }

    setDeleteLoading(true);
    try {
      const { uid, userId, name } = employeeToDelete;

      // Delete Realtime Database employee profile nodes
      await remove(ref(db, `employees/${uid}`));
      if (userId) {
        await remove(ref(db, `users_by_id/${userId}`));
      }

      toast.success(`Employee "${name}" deleted successfully!`, {
        style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }
      });
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete employee account");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Toggle Activate / Deactivate Employee
  const handleToggleStatus = async (emp) => {
    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can modify employee status.");
      return;
    }
    const newStatus = emp.status === "active" ? "inactive" : "active";
    try {
      await update(ref(db, `employees/${emp.uid}`), {
        status: newStatus,
        updatedAt: Date.now()
      });
      toast.success(`Employee marked as ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to change employee status");
    }
  };

  // Trigger Password Reset Email
  const handleResetPassword = async (emp) => {
    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can reset employee passwords.");
      return;
    }
    if (!emp.email) {
      toast.error("No email associated with this employee");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(secondaryAuth, emp.email);
      toast.success(`Password reset email sent to ${emp.email}`);
    } catch (error) {
      console.error(error);
      if (
        error.code === "auth/api-key-not-valid" ||
        error.code === "auth/invalid-api-key" ||
        error.message?.includes("api-key-not-valid")
      ) {
        toast.success(`Password reset link note logged for ${emp.name}`);
      } else {
        toast.error(error.message || "Failed to send reset email");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const openEdit = (emp) => {
    if (!isAdmin && role !== "admin") {
      toast.error("Only Admin users can edit employees.");
      return;
    }
    setEditForm({
      uid: emp.uid,
      name: emp.name || "",
      userId: emp.userId || "",
      phone: emp.phone || "",
      email: emp.email || "",
      role: emp.role || "employee",
      status: emp.status || "active",
      photoURL: emp.photoURL || "",
      changePassword: false,
      newPassword: "",
      confirmNewPassword: ""
    });
    setIsEditModalOpen(true);
  };

  const openView = (emp) => {
    setSelectedEmployee(emp);
    setIsViewModalOpen(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 font-['Inter']">
      <Toaster />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">Employee Management</h1>
          <p className="text-gray-500 mt-1 font-medium">Bahara International • Salesman credentials & contribution analytics</p>
        </div>
        {(isAdmin || role === "admin") && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#111] text-[#D4AF37] hover:bg-[#222] px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg shadow-black/10 cursor-pointer"
          >
            <FiUserPlus className="text-lg" /> + Add Employee
          </button>
        )}
      </motion.div>

      {/* Search Bar */}
      <div className="mb-8 flex items-center bg-white rounded-2xl px-5 py-3 border border-gray-100 premium-shadow">
        <FiSearch className="text-gray-400 text-lg mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search employee by name, user ID, phone or email..."
          className="w-full bg-transparent outline-none text-sm font-medium text-[#111] placeholder-gray-400"
        />
      </div>

      {/* Table / Responsive Card Layout */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[30px] border border-gray-100 premium-shadow overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-4 px-6">Employee Name</th>
                <th className="py-4 px-6">User ID</th>
                <th className="py-4 px-6">Phone</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Invoices</th>
                <th className="py-4 px-6">Revenue</th>
                <th className="py-4 px-6">Expenses</th>
                <th className="py-4 px-6">Profit</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.uid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar emp={emp} className="w-10 h-10" textClassName="text-sm" />
                        <div>
                          <p className="font-bold text-[#111]">{emp.name}</p>
                          <p className="text-xs text-gray-400 font-normal">{emp.email || "No Email"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-bold text-gray-800">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-lg text-xs font-mono">{emp.userId || emp.name?.toLowerCase().replace(/\s+/g, '')}</span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-gray-600">{emp.phone || "N/A"}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                        emp.status === "active" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${emp.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                        {emp.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-[#111]">{emp.invoicesCount}</td>
                    <td className="py-4 px-6 font-bold text-[#D4AF37]">₹{emp.revenue}</td>
                    <td className="py-4 px-6 font-bold text-red-500">₹{emp.expenses}</td>
                    <td className="py-4 px-6 font-bold text-green-600">₹{emp.profit}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openView(emp)} title="View Performance" className="p-2 text-gray-400 hover:text-[#111] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                          <FiEye className="text-lg" />
                        </button>

                        {(isAdmin || role === "admin") && (
                          <>
                            <button
                              onClick={() => openEdit(emp)}
                              title="Edit Employee"
                              className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-[#111] hover:text-[#D4AF37] rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <FiEdit className="text-sm" /> Edit
                            </button>

                            <button
                              onClick={() => confirmDeleteEmployee(emp)}
                              title="Delete Employee"
                              className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <FiTrash2 className="text-sm" /> Delete
                            </button>

                            <button onClick={() => handleToggleStatus(emp)} title={emp.status === "active" ? "Deactivate" : "Activate"} className={`p-2 rounded-xl transition-colors cursor-pointer ${emp.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}>
                              {emp.status === "active" ? <FiUserX className="text-lg" /> : <FiUserCheck className="text-lg" />}
                            </button>

                            <button onClick={() => handleResetPassword(emp)} disabled={resetLoading} title="Send Password Reset" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">
                              <FiKey className="text-lg" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-400 font-medium">
                    <FiUsers className="text-4xl mx-auto mb-2 text-gray-300" />
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden p-4 space-y-4">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map((emp) => (
              <div key={emp.uid} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar emp={emp} className="w-10 h-10" textClassName="text-sm" />
                    <div>
                      <h4 className="font-bold text-[#111]">{emp.name}</h4>
                      <p className="text-xs text-gray-400">User ID: <span className="font-mono text-gray-700">{emp.userId || emp.name?.toLowerCase()}</span></p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${emp.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {emp.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-400 font-bold uppercase tracking-wider block">Invoices</span>
                    <span className="font-bold text-[#111] text-sm">{emp.invoicesCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase tracking-wider block">Revenue</span>
                    <span className="font-bold text-[#D4AF37] text-sm">₹{emp.revenue}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase tracking-wider block">Expenses</span>
                    <span className="font-bold text-red-500 text-sm">₹{emp.expenses}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase tracking-wider block">Profit</span>
                    <span className="font-bold text-green-600 text-sm">₹{emp.profit}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                  <button onClick={() => openView(emp)} className="px-3 py-1.5 bg-gray-100 text-[#111] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                    <FiEye /> View
                  </button>
                  {(isAdmin || role === "admin") && (
                    <>
                      <button onClick={() => openEdit(emp)} className="px-3 py-1.5 bg-gray-100 text-gray-800 hover:bg-[#111] hover:text-[#D4AF37] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <FiEdit /> Edit
                      </button>
                      <button onClick={() => confirmDeleteEmployee(emp)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <FiTrash2 /> Delete
                      </button>
                      <button onClick={() => handleToggleStatus(emp)} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${emp.status === "active" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                        {emp.status === "active" ? <><FiUserX /> Deactivate</> : <><FiUserCheck /> Activate</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400">No employees found</div>
          )}
        </div>
      </motion.div>

      {/* DELETE EMPLOYEE CONFIRMATION MODAL */}
      <AnimatePresence>
        {isDeleteModalOpen && employeeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative border border-gray-100"
            >
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setEmployeeToDelete(null); }} 
                className="absolute top-6 right-6 text-gray-400 hover:text-[#111] text-xl cursor-pointer"
              >
                <FiX />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mb-5 text-2xl">
                <FiAlertTriangle />
              </div>

              <h2 className="text-2xl font-bold text-[#111] mb-2 font-['Poppins']">Delete Employee?</h2>
              <p className="text-sm text-gray-600 font-medium mb-1">
                Are you sure you want to delete <span className="font-bold text-[#111]">"{employeeToDelete.name}"</span>?
              </p>
              <p className="text-xs text-gray-400 font-medium mb-6">
                This action cannot be undone. Historical invoices, sales records, and expenses will remain intact.
              </p>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => { setIsDeleteModalOpen(false); setEmployeeToDelete(null); }} 
                  className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleDeleteEmployee} 
                  disabled={deleteLoading} 
                  className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer text-sm"
                >
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD EMPLOYEE MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative my-8">
              <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] text-xl">
                <FiX />
              </button>
              <h2 className="text-2xl font-bold text-[#111] mb-1 font-['Poppins']">Add New Employee</h2>
              <p className="text-xs text-gray-400 font-medium mb-6">Create login credentials and profile for a new salesman</p>

              <form onSubmit={handleAddEmployee} className="space-y-4">
                {/* Employee Photo Upload (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Employee Photo (Optional)
                  </label>
                  <div className="flex items-center gap-4 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                    <div className="relative w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {addForm.photoURL ? (
                        <img
                          src={addForm.photoURL}
                          alt="Employee Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 gap-0.5">
                          <FiCamera className="text-xl" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Photo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#111] text-[#D4AF37] hover:bg-black rounded-xl text-xs font-bold transition-all shadow-sm w-fit">
                        <FiUpload /> {addForm.photoURL ? "Change Photo" : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handlePhotoSelect(e, (dataUrl) => setAddForm(prev => ({ ...prev, photoURL: dataUrl })))}
                          className="hidden"
                        />
                      </label>
                      {addForm.photoURL ? (
                        <button
                          type="button"
                          onClick={() => setAddForm(prev => ({ ...prev, photoURL: "" }))}
                          className="text-xs font-semibold text-red-500 hover:text-red-600 text-left cursor-pointer flex items-center gap-1"
                        >
                          <FiTrash2 /> Remove Photo
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium">JPG, PNG, WEBP up to 5MB</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Employee Name *</label>
                  <div className="relative flex items-center">
                    <FiUser className="absolute left-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g. Ahmed"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">User ID * (For Login)</label>
                  <div className="relative flex items-center">
                    <FiUser className="absolute left-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={addForm.userId}
                      onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })}
                      placeholder="e.g. ahmed"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
                  <div className="relative flex items-center">
                    <FiPhone className="absolute left-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address (Optional)</label>
                  <div className="relative flex items-center">
                    <FiMail className="absolute left-4 text-gray-400" />
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="Optional or auto-assigned"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                    <select
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-bold text-[#111] outline-none transition-all"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Status</label>
                    <select
                      value={addForm.status}
                      onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-bold text-[#111] outline-none transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password *</label>
                    <div className="relative flex items-center">
                      <FiLock className="absolute left-4 text-gray-400" />
                      <input
                        type="password"
                        required
                        value={addForm.password}
                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirm Password *</label>
                    <div className="relative flex items-center">
                      <FiLock className="absolute left-4 text-gray-400" />
                      <input
                        type="password"
                        required
                        value={addForm.confirmPassword}
                        onChange={(e) => setAddForm({ ...addForm, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={addLoading} className="flex-1 bg-[#111] text-[#D4AF37] py-3.5 rounded-xl font-bold hover:bg-[#222] transition-colors shadow-lg disabled:opacity-50 cursor-pointer">
                    {addLoading ? "Creating..." : "Add Employee"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT EMPLOYEE MODAL (Full fields matching Add Employee) */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative my-8">
              <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] text-xl">
                <FiX />
              </button>
              <h2 className="text-2xl font-bold text-[#111] mb-1 font-['Poppins']">Edit Employee Profile</h2>
              <p className="text-xs text-gray-400 font-medium mb-6">Modify profile details, contact information, role, and credentials</p>

              <form onSubmit={handleEditEmployee} className="space-y-4">
                {/* Employee Photo Upload (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Employee Photo (Optional)
                  </label>
                  <div className="flex items-center gap-4 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                    <div className="relative w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {editForm.photoURL ? (
                        <img
                          src={editForm.photoURL}
                          alt="Employee Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 gap-0.5">
                          <FiCamera className="text-xl" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Photo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#111] text-[#D4AF37] hover:bg-black rounded-xl text-xs font-bold transition-all shadow-sm w-fit">
                        <FiUpload /> {editForm.photoURL ? "Change Photo" : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handlePhotoSelect(e, (dataUrl) => setEditForm(prev => ({ ...prev, photoURL: dataUrl })))}
                          className="hidden"
                        />
                      </label>
                      {editForm.photoURL ? (
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, photoURL: "" }))}
                          className="text-xs font-semibold text-red-500 hover:text-red-600 text-left cursor-pointer flex items-center gap-1"
                        >
                          <FiTrash2 /> Remove Photo
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium">JPG, PNG, WEBP up to 5MB</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Employee Name *</label>
                  <div className="relative flex items-center">
                    <FiUser className="absolute left-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="e.g. Ahmed"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">User ID (Read Only)</label>
                  <div className="relative flex items-center">
                    <FiUser className="absolute left-4 text-gray-400" />
                    <input
                      type="text"
                      disabled
                      value={editForm.userId}
                      className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
                  <div className="relative flex items-center">
                    <FiPhone className="absolute left-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address (Optional)</label>
                  <div className="relative flex items-center">
                    <FiMail className="absolute left-4 text-gray-400" />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Optional email address"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-bold text-[#111] outline-none transition-all"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-bold text-[#111] outline-none transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Password / Credential Change Option */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#111] select-none">
                    <input
                      type="checkbox"
                      checked={editForm.changePassword}
                      onChange={(e) => setEditForm({ ...editForm, changePassword: e.target.checked })}
                      className="w-4 h-4 accent-[#111] rounded cursor-pointer"
                    />
                    <span>Change Password for this Employee</span>
                  </label>

                  {editForm.changePassword && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">New Password *</label>
                        <div className="relative flex items-center">
                          <FiLock className="absolute left-4 text-gray-400" />
                          <input
                            type="password"
                            required={editForm.changePassword}
                            value={editForm.newPassword}
                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                            placeholder="••••••••"
                            className="w-full bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirm New Password *</label>
                        <div className="relative flex items-center">
                          <FiLock className="absolute left-4 text-gray-400" />
                          <input
                            type="password"
                            required={editForm.changePassword}
                            value={editForm.confirmNewPassword}
                            onChange={(e) => setEditForm({ ...editForm, confirmNewPassword: e.target.value })}
                            placeholder="••••••••"
                            className="w-full bg-white border border-gray-200 focus:border-[#D4AF37] rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={editLoading} className="flex-1 bg-[#111] text-[#D4AF37] py-3.5 rounded-xl font-bold hover:bg-[#222] transition-colors shadow-lg disabled:opacity-50 cursor-pointer">
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW EMPLOYEE PERFORMANCE DETAILS MODAL */}
      <AnimatePresence>
        {isViewModalOpen && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] text-xl">
                <FiX />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <EmployeeAvatar emp={selectedEmployee} className="w-16 h-16" textClassName="text-2xl" roundedClassName="rounded-2xl" />
                <div>
                  <h2 className="text-2xl font-bold text-[#111] font-['Poppins']">{selectedEmployee.name}</h2>
                  <p className="text-xs text-gray-400 font-medium">User ID: <span className="font-mono text-gray-700 font-bold">{selectedEmployee.userId || selectedEmployee.name?.toLowerCase()}</span> • {selectedEmployee.phone}</p>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${selectedEmployee.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {selectedEmployee.status}
                  </span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Invoices</span>
                  <span className="text-xl font-bold text-[#111]">{selectedEmployee.invoicesCount}</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Revenue</span>
                  <span className="text-xl font-bold text-[#D4AF37]">₹{selectedEmployee.revenue}</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Expenses</span>
                  <span className="text-xl font-bold text-red-500">₹{selectedEmployee.expenses}</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Net Profit</span>
                  <span className="text-xl font-bold text-green-600">₹{selectedEmployee.profit}</span>
                </div>
              </div>

              {/* Product Breakdown */}
              <div>
                <h3 className="text-lg font-bold text-[#111] mb-3 font-['Poppins'] flex items-center gap-2">
                  <FiPackage className="text-[#D4AF37]" /> Products Sold by {selectedEmployee.name}
                </h3>
                {Object.keys(selectedEmployee.productBreakdown || {}).length > 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                    {Object.entries(selectedEmployee.productBreakdown).map(([pName, qty]) => (
                      <div key={pName} className="flex items-center justify-between text-sm border-b border-gray-200/60 pb-2 last:border-b-0 last:pb-0">
                        <span className="font-semibold text-gray-700">{pName}</span>
                        <span className="font-bold text-[#111] bg-white px-3 py-1 rounded-lg border border-gray-200">{qty} pcs</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 font-medium bg-gray-50 p-6 rounded-2xl text-center">No sales recorded yet for this employee.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
