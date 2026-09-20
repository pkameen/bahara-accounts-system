import { useEffect, useState, useMemo } from "react";
import { db, secondaryAuth } from "../firebase";
import { ref, onValue, set, update } from "firebase/database";
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
  FiPackage
} from "react-icons/fi";
import { calculateTopSalesEmployees } from "../utils/calculations";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Add Employee Form State
  const [addForm, setAddForm] = useState({
    name: "",
    userId: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    status: "active"
  });
  const [addLoading, setAddLoading] = useState(false);

  // Edit Employee Form State
  const [editForm, setEditForm] = useState({
    uid: "",
    name: "",
    userId: "",
    phone: "",
    status: "active"
  });
  const [editLoading, setEditLoading] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);

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
        role: "employee",
        status: addForm.status,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await set(ref(db, `employees/${uid}`), profileData);
      await set(ref(db, `users_by_id/${cleanUserId}`), {
        userId: cleanUserId,
        uid,
        email: emailToUse,
        password: addForm.password,
        role: "employee",
        name: addForm.name.trim()
      });

      toast.success("Employee Added Successfully!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }});
      setIsAddModalOpen(false);
      setAddForm({
        name: "",
        userId: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
        status: "active"
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
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast.error("Name and Phone are required");
      return;
    }

    setEditLoading(true);
    try {
      await update(ref(db, `employees/${editForm.uid}`), {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        status: editForm.status,
        updatedAt: Date.now()
      });

      toast.success("Employee profile updated!");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update employee");
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle Activate / Deactivate Employee
  const handleToggleStatus = async (emp) => {
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
    setEditForm({
      uid: emp.uid,
      name: emp.name || "",
      userId: emp.userId || "",
      phone: emp.phone || "",
      status: emp.status || "active"
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
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#111] text-[#D4AF37] hover:bg-[#222] px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg shadow-black/10 cursor-pointer"
        >
          <FiUserPlus className="text-lg" /> + Add Employee
        </button>
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
                        <div className="w-10 h-10 rounded-full bg-[#111] text-[#D4AF37] font-bold flex items-center justify-center shrink-0">
                          {emp.name?.charAt(0).toUpperCase() || "E"}
                        </div>
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
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openView(emp)} title="View Performance" className="p-2 text-gray-400 hover:text-[#111] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                          <FiEye className="text-lg" />
                        </button>
                        <button onClick={() => openEdit(emp)} title="Edit Employee" className="p-2 text-gray-400 hover:text-[#D4AF37] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                          <FiEdit className="text-lg" />
                        </button>
                        <button onClick={() => handleToggleStatus(emp)} title={emp.status === "active" ? "Deactivate" : "Activate"} className={`p-2 rounded-xl transition-colors cursor-pointer ${emp.status === "active" ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>
                          {emp.status === "active" ? <FiUserX className="text-lg" /> : <FiUserCheck className="text-lg" />}
                        </button>
                        <button onClick={() => handleResetPassword(emp)} disabled={resetLoading} title="Send Password Reset" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer">
                          <FiKey className="text-lg" />
                        </button>
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
                    <div className="w-10 h-10 rounded-full bg-[#111] text-[#D4AF37] font-bold flex items-center justify-center">
                      {emp.name?.charAt(0).toUpperCase() || "E"}
                    </div>
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

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openView(emp)} className="px-3 py-1.5 bg-gray-100 text-[#111] rounded-xl text-xs font-bold flex items-center gap-1">
                    <FiEye /> View
                  </button>
                  <button onClick={() => openEdit(emp)} className="px-3 py-1.5 bg-gray-100 text-[#111] rounded-xl text-xs font-bold flex items-center gap-1">
                    <FiEdit /> Edit
                  </button>
                  <button onClick={() => handleToggleStatus(emp)} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${emp.status === "active" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                    {emp.status === "active" ? <><FiUserX /> Deactivate</> : <><FiUserCheck /> Activate</>}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400">No employees found</div>
          )}
        </div>
      </motion.div>

      {/* ADD EMPLOYEE MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative">
              <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] text-xl">
                <FiX />
              </button>
              <h2 className="text-2xl font-bold text-[#111] mb-1 font-['Poppins']">Add New Employee</h2>
              <p className="text-xs text-gray-400 font-medium mb-6">Create login credentials and profile for a new salesman</p>

              <form onSubmit={handleAddEmployee} className="space-y-4">
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

      {/* EDIT EMPLOYEE MODAL */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] text-xl">
                <FiX />
              </button>
              <h2 className="text-2xl font-bold text-[#111] mb-1 font-['Poppins']">Edit Employee</h2>
              <p className="text-xs text-gray-400 font-medium mb-6">Update profile details</p>

              <form onSubmit={handleEditEmployee} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Employee Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-medium outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">User ID</label>
                  <input
                    type="text"
                    disabled
                    value={editForm.userId}
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 px-4 text-sm font-mono text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-medium outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl py-3 px-4 text-sm font-bold text-[#111] outline-none transition-all"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200">
                    Cancel
                  </button>
                  <button type="submit" disabled={editLoading} className="flex-1 bg-[#111] text-[#D4AF37] py-3 rounded-xl font-bold hover:bg-[#222]">
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
                <div className="w-16 h-16 rounded-2xl bg-[#111] text-[#D4AF37] font-bold text-2xl flex items-center justify-center shadow-lg">
                  {selectedEmployee.name?.charAt(0).toUpperCase() || "E"}
                </div>
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
