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
  FiTrendingUp,
  FiDollarSign,
  FiSearch,
  FiPaperclip,
  FiAlertTriangle,
  FiEye,
  FiCheck,
  FiLink,
  FiLayers,
  FiArrowUpRight
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth } from "../context/AuthContext";
import DateFilter from "../components/DateFilter";
import EarningCategoryModal from "../components/EarningCategoryModal";
import { CLASSIFICATIONS } from "../utils/earningClassifications";
import { filterItemsByDate } from "../utils/calculations";

export default function Earnings() {
  const { currentUser, userProfile, role } = useAuth();
  const isAdmin = role === "admin";

  // Form State
  const [transactionDate, setTransactionDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [classification, setClassification] = useState("OTHER_INCOME");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [receivedInto, setReceivedInto] = useState("Main Bank Account");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [attachment, setAttachment] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  // Linked Entity State (for Credit Recovery or Refund / Recovery)
  const [linkToInvoice, setLinkToInvoice] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [linkToExpense, setLinkToExpense] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState("");

  // Data Collections
  const [earnings, setEarnings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expensesList, setExpensesList] = useState([]);

  // UI / Action State
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catToEdit, setCatToEdit] = useState(null);
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);

  // View Details Modal
  const [viewingEarning, setViewingEarning] = useState(null);

  // Delete Confirmation Modal
  const [earningToDelete, setEarningToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");

  // 1. Fetch Earning Categories
  useEffect(() => {
    const catRef = ref(db, "earningCategories");
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

  // 2. Fetch Earnings Records
  useEffect(() => {
    const earnRef = ref(db, "earnings");
    const unsub = onValue(earnRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setEarnings(loaded.reverse());
      } else {
        setEarnings([]);
      }
    });
    return () => unsub();
  }, []);

  // 3. Fetch Invoices (for optional Credit Recovery linking)
  useEffect(() => {
    const invRef = ref(db, "invoices");
    const unsub = onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInvoices(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setInvoices([]);
      }
    });
    return () => unsub();
  }, []);

  // 4. Fetch Expenses (for optional Refund / Recovery linking)
  useEffect(() => {
    const expRef = ref(db, "expenses");
    const unsub = onValue(expRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExpensesList(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setExpensesList([]);
      }
    });
    return () => unsub();
  }, []);

  // Pending Invoices for Credit Recovery linking
  const pendingInvoices = useMemo(() => {
    return invoices.filter(inv => (inv.paymentStatus || "paid") === "pending");
  }, [invoices]);

  // Selectable categories for dropdown (active categories)
  const selectableCategories = useMemo(() => {
    return categories.filter(c => c.status !== "inactive" || c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Category Selection Handler
  const handleCategorySelect = (e) => {
    const catId = e.target.value;
    setSelectedCategoryId(catId);
    const matched = categories.find(c => c.id === catId);
    if (matched) {
      setSelectedCategoryName(matched.name);
      if (matched.classification) {
        setClassification(matched.classification);
      }
      if (!description) {
        setDescription(matched.name);
      }
    } else {
      setSelectedCategoryName("");
    }
  };

  // Attachment upload (Base64)
  const handleAttachmentUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File size must be under 2MB");
        return;
      }
      setAttachmentName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = () => {
    setAttachment("");
    setAttachmentName("");
  };

  // Reset form
  const resetForm = () => {
    setDescription("");
    setAmount("");
    setSelectedCategoryId("");
    setSelectedCategoryName("");
    setClassification("OTHER_INCOME");
    setPaymentMethod("Bank Transfer");
    setReceivedInto("Main Bank Account");
    setReferenceNumber("");
    setReceivedFrom("");
    setAttachment("");
    setAttachmentName("");
    setLinkToInvoice(false);
    setSelectedInvoiceId("");
    setLinkToExpense(false);
    setSelectedExpenseId("");
    setEditId(null);
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    setTransactionDate(new Date(d.getTime() - offset).toISOString().split('T')[0]);
  };

  // Submit / Edit Earning Entry
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId) {
      toast.error("Please select an Earning Category");
      return;
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (!transactionDate) {
      toast.error("Please enter a transaction date");
      return;
    }

    if (!description.trim()) {
      toast.error("Please provide a description or notes");
      return;
    }

    setLoading(true);
    try {
      const creatorName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Admin";
      const catName = selectedCategoryName || "General Earning";
      const nowTime = Date.now();

      // Linked metadata
      let linkedInfo = null;
      if (classification === "CREDIT_RECOVERY" && linkToInvoice && selectedInvoiceId) {
        const inv = invoices.find(i => i.id === selectedInvoiceId);
        if (inv) {
          linkedInfo = {
            type: "invoice",
            id: selectedInvoiceId,
            reference: inv.invoiceNumber || inv.id,
            customerName: inv.customerName || "Customer",
            originalAmount: inv.totalAmount || 0
          };
        }
      } else if (classification === "REFUND_RECOVERY" && linkToExpense && selectedExpenseId) {
        const exp = expensesList.find(x => x.id === selectedExpenseId);
        if (exp) {
          linkedInfo = {
            type: "expense",
            id: selectedExpenseId,
            reference: exp.title || exp.categoryName,
            originalAmount: exp.amount || 0
          };
        }
      }

      const payload = {
        transactionDate,
        categoryId: selectedCategoryId,
        categoryName: catName,
        classification,
        amount: numAmount,
        paymentMethod,
        receivedInto,
        description: description.trim(),
        referenceNumber: referenceNumber.trim(),
        receivedFrom: receivedFrom.trim(),
        attachment: attachment || null,
        attachmentName: attachmentName || null,
        linkedInfo: linkedInfo || null,
        updatedAt: nowTime
      };

      if (editId) {
        await update(ref(db, `earnings/${editId}`), payload);
        toast.success("Earning Record Updated", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
      } else {
        const newRef = push(ref(db, "earnings"));
        await update(ref(db, `earnings/${newRef.key}`), {
          ...payload,
          createdAt: nowTime,
          createdByUid: currentUser?.uid || "admin",
          createdByName: creatorName,
          createdByRole: role || "admin"
        });

        // If linked to an invoice, safely mark that invoice's paymentStatus as paid to settle receivable
        if (linkedInfo && linkedInfo.type === "invoice" && selectedInvoiceId) {
          await update(ref(db, `invoices/${selectedInvoiceId}`), {
            paymentStatus: "paid",
            settledByEarningId: newRef.key,
            settledDate: transactionDate
          });
          toast.success("Linked invoice marked as settled", { icon: "🔗" });
        }

        toast.success("Earning Record Saved", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(editId ? "Failed to update record" : "Failed to save record");
    }
    setLoading(false);
  };

  // Load into editor
  const handleEdit = (earning) => {
    setEditId(earning.id);
    setSelectedCategoryId(earning.categoryId || "");
    setSelectedCategoryName(earning.categoryName || "");
    setClassification(earning.classification || "OTHER_INCOME");
    setAmount(earning.amount || "");
    setPaymentMethod(earning.paymentMethod || "Bank Transfer");
    setReceivedInto(earning.receivedInto || "Main Bank Account");
    setDescription(earning.description || "");
    setReferenceNumber(earning.referenceNumber || "");
    setReceivedFrom(earning.receivedFrom || "");
    setAttachment(earning.attachment || "");
    setAttachmentName(earning.attachmentName || "");
    setTransactionDate(earning.transactionDate || new Date().toISOString().split('T')[0]);

    if (earning.linkedInfo) {
      if (earning.linkedInfo.type === "invoice") {
        setLinkToInvoice(true);
        setSelectedInvoiceId(earning.linkedInfo.id);
      } else if (earning.linkedInfo.type === "expense") {
        setLinkToExpense(true);
        setSelectedExpenseId(earning.linkedInfo.id);
      }
    } else {
      setLinkToInvoice(false);
      setSelectedInvoiceId("");
      setLinkToExpense(false);
      setSelectedExpenseId("");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Loaded into editor", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
  };

  // Open secure delete dialog
  const promptDelete = (earning) => {
    if (!isAdmin) {
      toast.error("Only administrators are permitted to delete financial records");
      return;
    }
    setEarningToDelete(earning);
  };

  // Confirm delete with reversal handling
  const confirmDeleteEarning = async () => {
    if (!earningToDelete || deleteLoading) return;
    if (!isAdmin) {
      toast.error("Unauthorized: Only administrators can delete records");
      setEarningToDelete(null);
      return;
    }

    setDeleteLoading(true);
    try {
      // If this earning was linked to an invoice and settled it, revert invoice to pending
      if (earningToDelete.linkedInfo && earningToDelete.linkedInfo.type === "invoice" && earningToDelete.linkedInfo.id) {
        try {
          await update(ref(db, `invoices/${earningToDelete.linkedInfo.id}`), {
            paymentStatus: "pending",
            settledByEarningId: null,
            settledDate: null
          });
        } catch (err) {
          console.warn("Could not revert invoice status", err);
        }
      }

      await remove(ref(db, `earnings/${earningToDelete.id}`));
      toast.success("Earning Record Deleted", { style: { borderRadius: '14px', background: '#111', color: '#fff' } });
      setEarningToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete record: " + (error.message || "Unknown error"));
    }
    setDeleteLoading(false);
  };

  // Date filtered items
  const dateFilteredEarnings = useMemo(() => {
    return filterItemsByDate(earnings, filterType, startDate, endDate, "createdAt", "transactionDate");
  }, [earnings, filterType, startDate, endDate]);

  // Combined filters: search, category, classification
  const filteredEarnings = useMemo(() => {
    return dateFilteredEarnings.filter(item => {
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        const matchesRef = (item.referenceNumber || "").toLowerCase().includes(q);
        const matchesFrom = (item.receivedFrom || "").toLowerCase().includes(q);
        const matchesCat = (item.categoryName || "").toLowerCase().includes(q);
        if (!matchesDesc && !matchesRef && !matchesFrom && !matchesCat) return false;
      }
      // Category filter
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) {
        return false;
      }
      // Classification filter
      if (classificationFilter !== "all" && item.classification !== classificationFilter) {
        return false;
      }
      return true;
    });
  }, [dateFilteredEarnings, searchTerm, categoryFilter, classificationFilter]);

  // Summary Metrics calculated strictly from date-filtered items
  const metrics = useMemo(() => {
    let totalCashReceived = 0;
    let otherIncome = 0;
    let capitalReceived = 0;
    let creditRecovered = 0;
    let refundsRecovered = 0;

    const catMap = {};
    const monthlyMap = {};

    dateFilteredEarnings.forEach(item => {
      const amt = Number(item.amount) || 0;
      totalCashReceived += amt;

      if (item.classification === "OTHER_INCOME") {
        otherIncome += amt;
      } else if (item.classification === "CAPITAL_INVESTMENT") {
        capitalReceived += amt;
      } else if (item.classification === "CREDIT_RECOVERY") {
        creditRecovered += amt;
      } else if (item.classification === "REFUND_RECOVERY") {
        refundsRecovered += amt;
      }

      // Category breakdown
      const cName = item.categoryName || "Uncategorized";
      if (!catMap[cName]) {
        catMap[cName] = { name: cName, count: 0, amount: 0, classification: item.classification };
      }
      catMap[cName].count += 1;
      catMap[cName].amount += amt;

      // Monthly breakdown
      const dateStr = item.transactionDate || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : "");
      if (dateStr) {
        const monthKey = dateStr.slice(0, 7); // YYYY-MM
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { month: monthKey, total: 0, otherIncome: 0, capital: 0, credit: 0, refunds: 0 };
        }
        monthlyMap[monthKey].total += amt;
        if (item.classification === "OTHER_INCOME") monthlyMap[monthKey].otherIncome += amt;
        if (item.classification === "CAPITAL_INVESTMENT") monthlyMap[monthKey].capital += amt;
        if (item.classification === "CREDIT_RECOVERY") monthlyMap[monthKey].credit += amt;
        if (item.classification === "REFUND_RECOVERY") monthlyMap[monthKey].refunds += amt;
      }
    });

    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.amount - a.amount);
    const monthlySummary = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));

    return {
      totalCashReceived,
      otherIncome,
      capitalReceived,
      creditRecovered,
      refundsRecovered,
      categoryBreakdown,
      monthlySummary
    };
  }, [dateFilteredEarnings]);

  const getClassificationMeta = (clsId) => {
    return CLASSIFICATIONS.find(c => c.id === clsId) || {
      id: clsId,
      label: clsId,
      badge: "bg-gray-100 text-gray-700 border-gray-200"
    };
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 font-['Inter']">
      <Toaster />

      {/* Header & Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-xl shadow-lg border border-gray-800">
              <FiTrendingUp />
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">
              Earnings & Recoveries
            </h1>
          </div>
          <p className="text-gray-500 mt-2 font-medium">
            Record other income, supplier refunds, credit collections, and capital receipts with precise accounting segregation
          </p>
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

          <DateFilter
            filterType={filterType}
            setFilterType={setFilterType}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
        </div>
      </motion.div>

      {/* Summary KPI Cards Grid (Reflects selected period) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
      >
        {/* Total Cash Inflows */}
        <div className="bg-gradient-to-br from-[#111] via-[#1a1c2e] to-[#16213e] text-white p-6 rounded-[28px] border border-white/10 shadow-xl relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Total Inflows Received
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#D4AF37] flex items-center justify-center text-base border border-white/10">
              <FiDollarSign />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
            ₹{metrics.totalCashReceived.toLocaleString('en-IN')}
          </h2>
          <p className="text-[10px] text-gray-300 mt-1 font-medium">
            All earnings & inflows in period
          </p>
        </div>

        {/* Other Income */}
        <div className="bg-white p-6 rounded-[28px] border border-gray-100 premium-shadow relative overflow-hidden hover:border-emerald-300 transition-all">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Other Income
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base border border-emerald-100">
              <FiArrowUpRight />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-emerald-600 font-['Poppins']">
            ₹{metrics.otherIncome.toLocaleString('en-IN')}
          </h2>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">
            Genuine secondary income
          </p>
        </div>

        {/* Capital Received */}
        <div className="bg-white p-6 rounded-[28px] border border-gray-100 premium-shadow relative overflow-hidden hover:border-purple-300 transition-all">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Capital Received
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-base border border-purple-100">
              <FiLayers />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-purple-600 font-['Poppins']">
            ₹{metrics.capitalReceived.toLocaleString('en-IN')}
          </h2>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">
            Owner/investor capital inflow
          </p>
        </div>

        {/* Credit Recovery */}
        <div className="bg-white p-6 rounded-[28px] border border-gray-100 premium-shadow relative overflow-hidden hover:border-blue-300 transition-all">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Credit Recovered
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-base border border-blue-100">
              <FiCheck />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-blue-600 font-['Poppins']">
            ₹{metrics.creditRecovered.toLocaleString('en-IN')}
          </h2>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">
            Collected past receivables
          </p>
        </div>

        {/* Refunds / Recoveries */}
        <div className="bg-white p-6 rounded-[28px] border border-gray-100 premium-shadow relative overflow-hidden hover:border-amber-300 transition-all">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Refunds / Recoveries
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base border border-amber-100">
              <FiTrendingUp />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-amber-600 font-['Poppins']">
            ₹{metrics.refundsRecovered.toLocaleString('en-IN')}
          </h2>
          <p className="text-[10px] text-gray-400 mt-1 font-medium">
            Supplier refunds & reversals
          </p>
        </div>
      </motion.div>

      {/* Record / Edit Earning Card Form */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white premium-shadow border border-gray-100 rounded-[32px] p-6 sm:p-8 mb-10"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins']">
              {editId ? "Edit Earning Transaction" : "Record New Earning / Receipt"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              Validate financial category, accounting classification, and payment destination
            </p>
          </div>
          {editId && (
            <span className="bg-[#111] text-[#D4AF37] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <FiEdit2 className="text-xs" /> Editing Record
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-start">

            {/* Category Dropdown (4 cols) */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Earning Category *
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
                      <option value="">No categories added yet. Click + to create your first category.</option>
                    ) : (
                      <option value="">Select Earning Category...</option>
                    )}
                    {selectableCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({getClassificationMeta(cat.classification).label})
                      </option>
                    ))}
                    {selectedCategoryId && !selectableCategories.some(c => c.id === selectedCategoryId) && (
                      <option value={selectedCategoryId}>
                        {selectedCategoryName || "Historical Category"}
                      </option>
                    )}
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

            {/* Accounting Classification (3 cols) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Classification *
              </label>
              <div className="relative">
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] p-3.5 appearance-none cursor-pointer outline-none transition-all"
                  required
                >
                  {CLASSIFICATIONS.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.label}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Amount (2 cols) */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Amount (₹) *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5"
                required
              />
            </div>

            {/* Date (3 cols) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Transaction Date *
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5 cursor-pointer"
                required
              />
            </div>

            {/* Description / Notes (4 cols) */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Description / Notes *
              </label>
              <input
                type="text"
                placeholder="e.g. Q3 Bank Interest, Packaging Material Refund"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5"
                required
              />
            </div>

            {/* Payment Method (2 cols) */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Payment Method *
              </label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] p-3.5 appearance-none cursor-pointer outline-none transition-all"
                  required
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
                <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Received Into Account (3 cols) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Received Into *
              </label>
              <div className="relative">
                <select
                  value={receivedInto}
                  onChange={(e) => setReceivedInto(e.target.value)}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] p-3.5 appearance-none cursor-pointer outline-none transition-all"
                  required
                >
                  <option value="Main Bank Account">Main Bank Account</option>
                  <option value="Company Cash Account">Company Cash Account</option>
                  <option value="UPI / Digital Account">UPI / Digital Account</option>
                  <option value="Other Account">Other Account</option>
                </select>
                <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Reference Number (3 cols) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Reference / UTR / Cheque (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-9823482, CHQ-0021"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5"
              />
            </div>

            {/* Received From (4 cols) */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Received From (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank, Green Valley Traders, Rahul Nair"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] outline-none transition-all p-3.5"
              />
            </div>

            {/* Receipt Attachment Upload (5 cols) */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Receipt Attachment (Optional)
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-[#D4AF37] rounded-2xl text-xs font-bold text-gray-600 cursor-pointer transition-all overflow-hidden text-ellipsis whitespace-nowrap">
                  <FiPaperclip className="text-sm text-[#D4AF37] shrink-0" />
                  <span className="truncate">
                    {attachmentName || "Upload Receipt / Document"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                  />
                </label>
                {attachment && (
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="w-10 h-10 rounded-2xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center text-sm transition-colors border border-red-200"
                    title="Remove Attachment"
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>

            {/* Submit & Cancel Buttons (3 cols) */}
            <div className="lg:col-span-3 flex gap-2 self-end">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#111] hover:bg-black text-[#D4AF37] rounded-2xl px-5 py-3.5 font-bold text-xs shadow-md disabled:opacity-70 transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? "Saving..." : editId ? "Update Earning" : "Add Earning"}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-100 text-gray-600 rounded-2xl px-4 py-3.5 font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

          </div>

          {/* Conditional Entity Linking: Credit Recovery (Invoice) or Refund Recovery (Expense) */}
          {classification === "CREDIT_RECOVERY" && (
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <FiLink className="text-blue-600 text-sm" />
                <span className="text-xs font-bold text-blue-900">
                  Credit Recovery Linking (Outstanding Receivables)
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-blue-800 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={linkToInvoice}
                  onChange={(e) => setLinkToInvoice(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                Link this recovery to an existing pending invoice receivable
              </label>

              {linkToInvoice && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                      Select Pending Invoice Receivable
                    </label>
                    <select
                      value={selectedInvoiceId}
                      onChange={(e) => {
                        const invId = e.target.value;
                        setSelectedInvoiceId(invId);
                        const inv = invoices.find(i => i.id === invId);
                        if (inv) {
                          if (!amount) setAmount(inv.totalAmount || "");
                          if (!receivedFrom) setReceivedFrom(inv.customerName || "");
                          if (!referenceNumber && inv.invoiceNumber) setReferenceNumber(`INV-${inv.invoiceNumber}`);
                        }
                      }}
                      className="w-full bg-white border border-blue-200 rounded-xl text-xs font-medium text-[#111] p-3 outline-none"
                    >
                      <option value="">Select Pending Invoice...</option>
                      {pendingInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber ? `Invoice #${inv.invoiceNumber}` : inv.id} — {inv.customerName || "Customer"} (₹{(Number(inv.totalAmount) || 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-blue-700/80 flex items-center">
                    Linking will update the pending invoice status upon receipt without double-counting it in product turnover.
                  </div>
                </div>
              )}
            </div>
          )}

          {classification === "REFUND_RECOVERY" && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <FiLink className="text-amber-600 text-sm" />
                <span className="text-xs font-bold text-amber-900">
                  Refund / Expense Recovery Linking
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={linkToExpense}
                  onChange={(e) => setLinkToExpense(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                />
                Link this refund to an original recorded expense
              </label>

              {linkToExpense && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                      Select Original Expense Record
                    </label>
                    <select
                      value={selectedExpenseId}
                      onChange={(e) => {
                        const expId = e.target.value;
                        setSelectedExpenseId(expId);
                        const exp = expensesList.find(x => x.id === expId);
                        if (exp && !description) {
                          setDescription(`Refund for: ${exp.title || exp.categoryName}`);
                        }
                      }}
                      className="w-full bg-white border border-amber-200 rounded-xl text-xs font-medium text-[#111] p-3 outline-none"
                    >
                      <option value="">Select Expense Record...</option>
                      {expensesList.slice(0, 50).map(exp => (
                        <option key={exp.id} value={exp.id}>
                          {exp.expenseDate || exp.date} — {exp.title || exp.categoryName} (₹{(Number(exp.amount) || 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-amber-700/80 flex items-center">
                    Distinguishes genuine refunds from revenue, maintaining audit trail for recovery.
                  </div>
                </div>
              )}
            </div>
          )}

        </form>
      </motion.div>

      {/* Analytics & Category-wise Summaries */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10"
      >
        {/* Category-wise Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#111] font-['Poppins']">Category-wise Summary</h3>
              <p className="text-xs text-gray-400 font-medium">Receipt distribution by category for active period</p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {metrics.categoryBreakdown.length} Categories
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {metrics.categoryBreakdown.length > 0 ? (
              metrics.categoryBreakdown.map((cat, idx) => {
                const percent = metrics.totalCashReceived > 0
                  ? ((cat.amount / metrics.totalCashReceived) * 100).toFixed(1)
                  : 0;
                const meta = getClassificationMeta(cat.classification);

                return (
                  <div key={idx} className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#111]">{cat.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#111] font-['Poppins']">
                        ₹{cat.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#D4AF37] h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 w-12 text-right">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-gray-400 text-xs font-medium">
                No category receipts recorded in this period.
              </div>
            )}
          </div>
        </div>

        {/* Monthly Summary (5 cols) */}
        <div className="lg:col-span-5 bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#111] font-['Poppins']">Monthly Summary</h3>
              <p className="text-xs text-gray-400 font-medium">Trend over months</p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {metrics.monthlySummary.length} Months
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {metrics.monthlySummary.length > 0 ? (
              metrics.monthlySummary.map((m, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#111] font-['Poppins']">{m.month}</h4>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      Other Inc: ₹{m.otherIncome.toLocaleString('en-IN')} • Cap: ₹{m.capital.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#D4AF37] bg-[#111] px-3 py-1.5 rounded-xl font-['Poppins']">
                    ₹{m.total.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-400 text-xs font-medium">
                No monthly transactions found.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Earnings Records Table Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white premium-shadow border border-gray-100 rounded-[32px] overflow-hidden"
      >
        {/* Table Toolbar */}
        <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Earnings & Recoveries Ledger</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              Showing {filteredEarnings.length} transactions for active filter criteria
            </p>
          </div>

          {/* Search & Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search desc, ref, payer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl text-xs font-medium text-[#111] pl-9 pr-3 py-2.5 outline-none transition-all"
              />
            </div>

            {/* Classification Filter Dropdown */}
            <div className="relative">
              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value)}
                className="bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl text-xs font-bold text-[#111] px-3.5 py-2.5 appearance-none cursor-pointer outline-none transition-all pr-8"
              >
                <option value="all">All Classifications</option>
                {CLASSIFICATIONS.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.label}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs" />
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-xl text-xs font-bold text-[#111] px-3.5 py-2.5 appearance-none cursor-pointer outline-none transition-all pr-8"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs" />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 sm:p-5">Date</th>
                <th className="p-4 sm:p-5">Reference / Notes</th>
                <th className="p-4 sm:p-5">Category</th>
                <th className="p-4 sm:p-5">Classification</th>
                <th className="p-4 sm:p-5">Payment & Account</th>
                <th className="p-4 sm:p-5 text-right">Amount</th>
                <th className="p-4 sm:p-5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
              {filteredEarnings.length > 0 ? (
                filteredEarnings.map((earning) => {
                  const meta = getClassificationMeta(earning.classification);

                  return (
                    <tr key={earning.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Date */}
                      <td className="p-4 sm:p-5 text-gray-600 whitespace-nowrap">
                        {earning.transactionDate ? earning.transactionDate.split('-').reverse().join('/') : "-"}
                      </td>

                      {/* Reference / Description */}
                      <td className="p-4 sm:p-5">
                        <div className="font-bold text-[#111] font-['Poppins']">
                          {earning.description}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {earning.referenceNumber && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              Ref: {earning.referenceNumber}
                            </span>
                          )}
                          {earning.receivedFrom && (
                            <span className="text-[10px] text-gray-500 font-normal">
                              From: {earning.receivedFrom}
                            </span>
                          )}
                          {earning.linkedInfo && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                              Linked: {earning.linkedInfo.reference || earning.linkedInfo.type}
                            </span>
                          )}
                          {earning.attachment && (
                            <span className="text-[10px] text-[#D4AF37] flex items-center gap-0.5 font-bold" title="Attachment available">
                              <FiPaperclip /> Doc
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4 sm:p-5 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                          {earning.categoryName || "Uncategorized"}
                        </span>
                      </td>

                      {/* Classification Badge */}
                      <td className="p-4 sm:p-5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>

                      {/* Payment Method & Received Into */}
                      <td className="p-4 sm:p-5 whitespace-nowrap">
                        <span className="text-[#111] font-bold block">
                          {earning.paymentMethod || "Bank Transfer"}
                        </span>
                        <span className="text-[10px] text-gray-400 block font-normal">
                          {earning.receivedInto || "Bank Account"}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="p-4 sm:p-5 text-right font-bold text-emerald-600 font-['Poppins'] whitespace-nowrap text-sm">
                        +₹{(Number(earning.amount) || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="p-4 sm:p-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {/* View details */}
                          <button
                            onClick={() => setViewingEarning(earning)}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-[#D4AF37]/20 text-gray-600 hover:text-[#111] flex items-center justify-center transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <FiEye />
                          </button>

                          {/* Edit record */}
                          <button
                            onClick={() => handleEdit(earning)}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-[#D4AF37]/20 text-gray-600 hover:text-[#111] flex items-center justify-center transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <FiEdit2 />
                          </button>

                          {/* Delete record */}
                          {isAdmin && (
                            <button
                              onClick={() => promptDelete(earning)}
                              className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                    No earning records found matching the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Category Creation / Edit Modal */}
      <EarningCategoryModal
        isOpen={isCatModalOpen}
        onClose={() => {
          setIsCatModalOpen(false);
          setCatToEdit(null);
        }}
        categoryToEdit={catToEdit}
        existingCategories={categories}
        onSuccess={(savedCat) => {
          if (savedCat && savedCat.id) {
            setSelectedCategoryId(savedCat.id);
            setSelectedCategoryName(savedCat.name);
            if (savedCat.classification) {
              setClassification(savedCat.classification);
            }
            if (!description) setDescription(savedCat.name);
          }
        }}
      />

      {/* Admin Category Management Drawer / Modal */}
      {isManageCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative border border-gray-100 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-lg shadow-md">
                  <FiTag />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Earning Categories</h3>
                  <p className="text-xs text-gray-400 font-medium">Manage categories & assigned accounting classifications</p>
                </div>
              </div>
              <button
                onClick={() => setIsManageCatOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <FiX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3">
              {categories.length > 0 ? (
                categories.map(cat => {
                  const meta = getClassificationMeta(cat.classification);
                  return (
                    <div
                      key={cat.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-[#111] text-sm">{cat.name}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${cat.status === "inactive" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}>
                            {cat.status || "active"}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-xs text-gray-400 mt-1">{cat.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setCatToEdit(cat);
                            setIsManageCatOpen(false);
                            setIsCatModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            const newStatus = cat.status === "inactive" ? "active" : "inactive";
                            try {
                              await update(ref(db, `earningCategories/${cat.id}`), {
                                status: newStatus,
                                updatedAt: Date.now()
                              });
                              toast.success(`Category marked as ${newStatus}`);
                            } catch (err) {
                              console.error(err);
                              toast.error("Failed to update status");
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${cat.status === "inactive"
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-600 hover:bg-red-200"
                            }`}
                        >
                          {cat.status === "inactive" ? "Activate" : "Deactivate"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm font-medium">
                  No earning categories configured yet.
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
                className="bg-[#D4AF37] text-[#111] px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer hover:bg-yellow-400 transition-colors"
              >
                <FiPlus /> Add New Category
              </button>
              <button
                onClick={() => setIsManageCatOpen(false)}
                className="bg-gray-100 text-gray-600 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* VIEW EARNING DETAILS MODAL */}
      <AnimatePresence>
        {viewingEarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-lg shadow-2xl relative border border-gray-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => setViewingEarning(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-[#111] transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <FiX className="text-xl" />
              </button>

              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-md border border-emerald-100">
                  <FiDollarSign />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#111] font-['Poppins']">
                    Transaction Details
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    Financial entry & audit parameters
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</span>
                  <span className="text-2xl font-bold text-emerald-600 font-['Poppins']">
                    ₹{(Number(viewingEarning.amount) || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-3.5 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date</span>
                    <span className="font-bold text-[#111]">{viewingEarning.transactionDate}</span>
                  </div>
                  <div className="bg-gray-50 p-3.5 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Category</span>
                    <span className="font-bold text-[#111]">{viewingEarning.categoryName}</span>
                  </div>
                  <div className="bg-gray-50 p-3.5 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Classification</span>
                    <span className="font-bold text-[#111]">{getClassificationMeta(viewingEarning.classification).label}</span>
                  </div>
                  <div className="bg-gray-50 p-3.5 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Payment Method</span>
                    <span className="font-bold text-[#111]">{viewingEarning.paymentMethod}</span>
                  </div>
                  <div className="bg-gray-50 p-3.5 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Received Into</span>
                    <span className="font-bold text-[#111]">{viewingEarning.receivedInto}</span>
                  </div>
                  <div className="bg-gray-50 p-3.5 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Reference No</span>
                    <span className="font-bold text-[#111]">{viewingEarning.referenceNumber || "—"}</span>
                  </div>
                </div>

                {viewingEarning.receivedFrom && (
                  <div className="bg-gray-50 p-3.5 rounded-2xl text-xs">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Received From</span>
                    <span className="font-bold text-[#111]">{viewingEarning.receivedFrom}</span>
                  </div>
                )}

                <div className="bg-gray-50 p-3.5 rounded-2xl text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Description / Notes</span>
                  <span className="font-semibold text-gray-700">{viewingEarning.description}</span>
                </div>

                {viewingEarning.linkedInfo && (
                  <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 text-xs">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Linked Record</span>
                    <span className="font-bold text-blue-900 block">
                      Type: {viewingEarning.linkedInfo.type} • Ref: {viewingEarning.linkedInfo.reference}
                    </span>
                    {viewingEarning.linkedInfo.customerName && (
                      <span className="text-[11px] text-blue-700 font-medium block mt-0.5">
                        Customer: {viewingEarning.linkedInfo.customerName}
                      </span>
                    )}
                  </div>
                )}

                {viewingEarning.attachment && (
                  <div className="pt-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Receipt Document</span>
                    <div className="rounded-2xl border border-gray-200 overflow-hidden max-h-60 flex items-center justify-center bg-gray-50">
                      {viewingEarning.attachment.startsWith("data:image") ? (
                        <img
                          src={viewingEarning.attachment}
                          alt="Receipt Attachment"
                          className="max-h-60 w-auto object-contain"
                        />
                      ) : (
                        <div className="p-4 text-center">
                          <FiPaperclip className="text-3xl text-gray-400 mx-auto mb-2" />
                          <a
                            href={viewingEarning.attachment}
                            download={viewingEarning.attachmentName || "receipt"}
                            className="text-xs font-bold text-[#D4AF37] hover:underline"
                          >
                            Download {viewingEarning.attachmentName || "Attached Document"}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingEarning(null)}
                  className="px-6 py-2.5 rounded-2xl font-bold text-xs bg-[#111] text-white hover:bg-black transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECURE DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {earningToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md shadow-2xl relative border border-gray-100"
            >
              <button
                onClick={() => !deleteLoading && setEarningToDelete(null)}
                disabled={deleteLoading}
                className="absolute top-6 right-6 text-gray-400 hover:text-[#111] transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <FiX className="text-xl" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mb-5 text-2xl mx-auto">
                <FiAlertTriangle />
              </div>

              <h2 className="text-2xl font-bold text-[#111] text-center mb-2 font-['Poppins']">
                Delete Earning Record?
              </h2>
              <p className="text-xs text-gray-500 text-center font-medium mb-6">
                Are you sure you want to permanently delete this transaction? All associated balances and linked statuses will be safely reversed.
              </p>

              {/* Transaction details in deletion modal */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2 mb-6 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Description</span>
                  <span className="font-bold text-[#111] text-right truncate max-w-[200px]">
                    {earningToDelete.description}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Category</span>
                  <span className="font-bold text-[#111]">{earningToDelete.categoryName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Date</span>
                  <span className="font-bold text-[#111]">{earningToDelete.transactionDate}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200/60 pt-2">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Amount</span>
                  <span className="font-bold text-red-600 font-['Poppins'] text-sm">
                    ₹{(Number(earningToDelete.amount) || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setEarningToDelete(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-200 transition-colors text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={confirmDeleteEarning}
                  className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Record"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
