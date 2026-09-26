import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import {
  ref,
  push,
  onValue,
  remove,
  update,
} from "firebase/database";
import toast, { Toaster } from "react-hot-toast";
import { 
  FiTrash2, 
  FiEdit2, 
  FiPlus, 
  FiTag, 
  FiX, 
  FiChevronDown,
  FiUsers,
  FiLock
} from "react-icons/fi";
import { motion } from "framer-motion";

import { useAuth } from "../context/AuthContext";
import DateFilter from "../components/DateFilter";
import ExpenseByCategoryChart from "../components/ExpenseByCategoryChart";
import ExpenseCategoryModal from "../components/ExpenseCategoryModal";
import { filterItemsByDate } from "../utils/calculations";

const Expenses = () => {
  const { currentUser, userProfile, role } = useAuth();
  const isAdmin = role === "admin";

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);

  // Date Filter State
  const [filterType, setFilterType] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catToEdit, setCatToEdit] = useState(null);
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);

  // Fetch Categories from Firebase
  useEffect(() => {
    const catRef = ref(db, "expenseCategories");
    const unsub = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setCategories(loaded);
      } else {
        setCategories([]);
      }
    });
    return () => unsub();
  }, []);

  // Filter Categories for Dropdown based on Role & Status
  const selectableCategories = useMemo(() => {
    return categories.filter(c => {
      if (c.status !== "active") return false;
      if (role === "employee") {
        return c.allowEmployee !== false; // Authorized for employees if true or undefined
      }
      return true; // Admin can see all active categories
    });
  }, [categories, role]);

  // Fetch Expenses
  useEffect(() => {
    const expenseRef = ref(db, "expenses");
    const unsub = onValue(expenseRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let loadedExpenses = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));

        if (role === "employee" && currentUser?.uid) {
          loadedExpenses = loadedExpenses.filter(exp => exp.createdByUid === currentUser.uid);
        }

        setExpenses(loadedExpenses.reverse());
      } else {
        setExpenses([]);
      }
    });

    return () => unsub();
  }, [role, currentUser?.uid]);

  // Date Filtered Expenses
  const dateFilteredExpenses = useMemo(() => {
    return filterItemsByDate(expenses, filterType, startDate, endDate, "createdAt", "expenseDate");
  }, [expenses, filterType, startDate, endDate]);

  // Total Filtered Expense
  const totalFilteredExpense = useMemo(() => {
    return dateFilteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [dateFilteredExpenses]);

  // Handle Category Selection in Form
  const handleCategorySelect = (e) => {
    const catId = e.target.value;
    setSelectedCategoryId(catId);
    const matched = categories.find(c => c.id === catId);
    if (matched) {
      setSelectedCategoryName(matched.name);
      if (!title) {
        setTitle(matched.name);
      }
    } else {
      setSelectedCategoryName("");
    }
  };

  // Add / Edit Expense Submission
  const handleExpense = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId && selectableCategories.length > 0) {
      toast.error("Please select an Expense Category");
      return;
    }

    const matchedCat = categories.find(c => c.id === selectedCategoryId);
    if (role === "employee" && matchedCat && matchedCat.allowEmployee === false) {
      toast.error("You are not authorized to use this expense category");
      return;
    }

    if (!amount || !expenseDate) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);

    try {
      const creatorName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Admin";
      const catName = selectedCategoryName || "General Expense";
      const expenseTitle = title.trim() || catName;

      const expenseRef = ref(db, editId ? `expenses/${editId}` : "expenses");

      const payload = {
        title: expenseTitle,
        categoryId: selectedCategoryId || "uncategorized",
        categoryName: catName,
        amount: Number(amount),
        expenseDate,
        date: new Date().toLocaleDateString(),
        updatedAt: Date.now()
      };

      if (editId) {
        await update(expenseRef, payload);
        toast.success("Expense Updated", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
        setEditId(null);
      } else {
        await push(expenseRef, {
          ...payload,
          createdAt: Date.now(),
          createdByUid: currentUser?.uid || "admin_legacy",
          createdByName: creatorName,
          createdByUserId: userProfile?.userId || "admin",
          createdByRole: role || "admin"
        });
        toast.success("Expense Recorded", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
      }

      setTitle("");
      setAmount("");
      setSelectedCategoryId("");
      setSelectedCategoryName("");
      const d = new Date();
      const offset = d.getTimezoneOffset() * 60000;
      setExpenseDate(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    } catch (error) {
      console.error(error);
      toast.error(editId ? "Failed to update expense" : "Failed to add expense");
    }

    setLoading(false);
  };

  // Handle Edit Expense
  const handleEdit = (expense) => {
    setTitle(expense.title || expense.categoryName || "");
    setAmount(expense.amount);
    setSelectedCategoryId(expense.categoryId || "");
    setSelectedCategoryName(expense.categoryName || "");
    if (expense.expenseDate) {
      setExpenseDate(expense.expenseDate);
    } else if (expense.createdAt) {
      const d = new Date(expense.createdAt);
      const offset = d.getTimezoneOffset() * 60000;
      setExpenseDate(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }
    setEditId(expense.id);
  };

  // Delete Expense
  const deleteExpense = async (id) => {
    try {
      await remove(ref(db, `expenses/${id}`));
      toast.success("Expense Deleted", { style: { borderRadius: '14px', background: '#111', color: '#fff' } });
    } catch (error) {
      console.error(error);
      toast.error("Delete Failed");
    }
  };

  // Toggle Category Status (Deactivate safety)
  const handleToggleCategoryStatus = async (cat) => {
    if (!isAdmin) return;
    const newStatus = cat.status === "active" ? "inactive" : "active";
    const nowTime = Date.now();
    try {
      await update(ref(db, `expenseCategories/${cat.id}`), {
        status: newStatus,
        updatedAt: nowTime
      });
      toast.success(`Category '${cat.name}' marked as ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update category status");
    }
  };

  // Toggle Employee Access (Admin control)
  const handleToggleEmployeeAccess = async (cat) => {
    if (!isAdmin) return;
    const currentAllowed = cat.allowEmployee !== false;
    const newAllowed = !currentAllowed;
    const nowTime = Date.now();
    try {
      await update(ref(db, `expenseCategories/${cat.id}`), {
        allowEmployee: newAllowed,
        updatedAt: nowTime
      });
      toast.success(
        newAllowed
          ? `Category '${cat.name}' is now visible to Employees`
          : `Category '${cat.name}' is now restricted to Admin Only`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to update employee access permission");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 font-['Inter']">
      <Toaster />

      {/* Header & Controls */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">Expense Management</h1>
          <p className="text-gray-500 mt-2 font-medium">Track operational costs and admin-controlled expense categories</p>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row flex-wrap items-center gap-4">
          {isAdmin && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setCatToEdit(null);
                  setIsCatModalOpen(true);
                }}
                className="flex-1 sm:flex-none bg-[#D4AF37] hover:bg-yellow-400 text-[#111] px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <FiPlus className="text-sm" /> Add Category
              </button>

              <button
                type="button"
                onClick={() => setIsManageCatOpen(true)}
                className="flex-1 sm:flex-none bg-[#111] hover:bg-black text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-gray-800"
              >
                <FiTag className="text-sm text-[#D4AF37]" /> Manage Categories
              </button>
            </div>
          )}

          <DateFilter filterType={filterType} setFilterType={setFilterType} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
        </div>
      </motion.div>

      {/* Expense Input Form Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-8 mb-10">
        <h3 className="text-lg font-bold text-[#111] mb-4 font-['Poppins']">
          {editId ? "Edit Expense Entry" : "Record New Expense"}
        </h3>

        <form onSubmit={handleExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          
          {/* Category Dropdown (4 cols) */}
          <div className="lg:col-span-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Expense Category *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedCategoryId}
                  onChange={handleCategorySelect}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] p-3.5 appearance-none cursor-pointer outline-none transition-all"
                  required
                >
                  {selectableCategories.length === 0 ? (
                    <option value="">No expense categories available for your role</option>
                  ) : (
                    <option value="">Select Expense Category...</option>
                  )}
                  {selectableCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {isAdmin && cat.allowEmployee === false ? " (Admin Only)" : ""}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {isAdmin && (
                <button
                  type="button"
                  title="Add New Category"
                  onClick={() => {
                    setCatToEdit(null);
                    setIsCatModalOpen(true);
                  }}
                  className="w-11 h-11 bg-gray-100 hover:bg-[#D4AF37] hover:text-[#111] text-gray-600 rounded-2xl flex items-center justify-center text-base transition-all shrink-0 border border-gray-200"
                >
                  <FiPlus />
                </button>
              )}
            </div>
          </div>

          {/* Description/Title (3 cols) */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Description / Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Courier to Cochin, Fuel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5"
            />
          </div>

          {/* Amount (2 cols) */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Amount (₹) *
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5"
              required
            />
          </div>

          {/* Date (3 cols) */}
          <div className="lg:col-span-3 flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Expense Date *
              </label>
              <input 
                type="date" 
                value={expenseDate} 
                onChange={(e) => setExpenseDate(e.target.value)} 
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5 cursor-pointer" 
                required 
              />
            </div>

            <div className="self-end flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#111] hover:bg-black text-[#D4AF37] rounded-2xl px-5 py-3.5 font-bold text-xs shadow-md disabled:opacity-70 transition-all whitespace-nowrap"
              >
                {loading ? "Saving..." : editId ? "Update" : "Add Expense"}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setTitle("");
                    setAmount("");
                    setSelectedCategoryId("");
                    setSelectedCategoryName("");
                  }}
                  className="bg-gray-100 text-gray-600 rounded-2xl px-4 py-3.5 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

        </form>
      </motion.div>

      {/* Analytics & Summary Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-10">
        <ExpenseByCategoryChart expenses={dateFilteredExpenses} categoriesList={categories} />
      </motion.div>

      {/* Expenses Table Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Expense Records</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              Showing {dateFilteredExpenses.length} records for the selected period
            </p>
          </div>
          <div className="bg-[#111] text-[#D4AF37] px-4 py-2 rounded-2xl font-bold text-sm font-['Poppins']">
            Total: ₹{totalFilteredExpense.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 sm:p-5">Description / Note</th>
                <th className="p-4 sm:p-5">Category</th>
                <th className="p-4 sm:p-5">Created By</th>
                <th className="p-4 sm:p-5 text-right">Amount</th>
                <th className="p-4 sm:p-5">Date</th>
                <th className="p-4 sm:p-5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
              {dateFilteredExpenses.length > 0 ? (
                dateFilteredExpenses.map((expense) => {
                  const catDisplayName = expense.categoryName || expense.title || "Uncategorized";
                  const creatorDisplayName = expense.createdByName || (expense.createdByRole === "admin" ? "Admin" : "Employee");

                  return (
                    <tr key={expense.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 sm:p-5 font-bold font-['Poppins']">
                        {expense.title || catDisplayName}
                      </td>

                      <td className="p-4 sm:p-5">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                          {catDisplayName}
                        </span>
                      </td>

                      <td className="p-4 sm:p-5">
                        <span className="text-gray-600 font-medium">
                          {creatorDisplayName}
                        </span>
                        <span className="text-[10px] text-gray-400 block font-normal capitalize">
                          {expense.createdByRole || "user"}
                        </span>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-red-500 font-['Poppins']">
                        ₹{(Number(expense.amount) || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="p-4 sm:p-5 text-gray-500">
                        {expense.expenseDate ? expense.expenseDate.split('-').reverse().join('/') : expense.date}
                      </td>

                      <td className="p-4 sm:p-5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleEdit(expense)}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-[#D4AF37]/20 text-gray-600 hover:text-[#111] flex items-center justify-center transition-colors"
                            title="Edit Record"
                          >
                            <FiEdit2 />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-colors"
                              title="Delete Record"
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                    No expense records found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Category Creation / Edit Modal */}
      <ExpenseCategoryModal
        isOpen={isCatModalOpen}
        onClose={() => {
          setIsCatModalOpen(false);
          setCatToEdit(null);
        }}
        categoryToEdit={catToEdit}
        existingCategories={categories}
        onSuccess={(createdCat) => {
          if (createdCat && createdCat.id) {
            setSelectedCategoryId(createdCat.id);
            setSelectedCategoryName(createdCat.name);
            if (!title) setTitle(createdCat.name);
          }
        }}
      />

      {/* Admin Category Management Drawer / Modal */}
      {isManageCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[30px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-lg shadow-md">
                  <FiTag />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Expense Categories</h3>
                  <p className="text-xs text-gray-400 font-medium">Admin control panel for expense categories & permissions</p>
                </div>
              </div>
              <button onClick={() => setIsManageCatOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                <FiX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
              {categories.length > 0 ? (
                categories.map(cat => (
                  <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-[#111] text-sm">{cat.name}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          cat.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {cat.status || "active"}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          cat.allowEmployee !== false ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {cat.allowEmployee !== false ? <><FiUsers className="text-xs" /> Authorized</> : <><FiLock className="text-xs" /> Admin Only</>}
                        </span>
                      </div>
                      {cat.description && <p className="text-xs text-gray-400 mt-1">{cat.description}</p>}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      <button
                        onClick={() => handleToggleEmployeeAccess(cat)}
                        title={cat.allowEmployee !== false ? "Restrict to Admin Only" : "Allow Employees to view & use"}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          cat.allowEmployee !== false ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        }`}
                      >
                        {cat.allowEmployee !== false ? "Make Admin Only" : "Authorize Employee"}
                      </button>

                      <button
                        onClick={() => {
                          setCatToEdit(cat);
                          setIsManageCatOpen(false);
                          setIsCatModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleToggleCategoryStatus(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          cat.status === "active" ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-600 hover:bg-green-200"
                        }`}
                      >
                        {cat.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm font-medium">
                  No expense categories created yet.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4 flex justify-between items-center">
              <button
                onClick={() => {
                  setCatToEdit(null);
                  setIsManageCatOpen(false);
                  setIsCatModalOpen(true);
                }}
                className="bg-[#D4AF37] text-[#111] px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <FiPlus /> Add New Category
              </button>
              <button onClick={() => setIsManageCatOpen(false)} className="bg-gray-100 text-gray-600 px-5 py-2.5 rounded-xl font-bold text-xs">
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Expenses;