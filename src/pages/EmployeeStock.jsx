import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { ref, onValue, update } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  FiPackage,
  FiSend,
  FiUsers,
  FiTrendingUp,
  FiDollarSign,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiSearch,
  FiChevronRight,
  FiLayers,
  FiEdit,
  FiTrash2,
  FiPlusCircle
} from "react-icons/fi";
import EmployeeAvatar from "../components/EmployeeAvatar";
import DateFilter from "../components/DateFilter";
import TransferStockModal from "../components/TransferStockModal";
import IssueStockModal from "../components/IssueStockModal";
import AddStockModal from "../components/AddStockModal";
import EmployeeStockDetailModal from "../components/EmployeeStockDetailModal";
import { calculateEmployeeStockReconciliation, calculateAdminCentralStock } from "../utils/calculations";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function EmployeeStock() {
  const { currentUser, userProfile, role } = useAuth();
  const isAdmin = role === "admin";

  const [stockIssues, setStockIssues] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(isAdmin ? "adminStock" : "employees"); // "adminStock" | "employees" | "products" | "history"

  // Modals & Drawers
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [preSelectedProduct, setPreSelectedProduct] = useState(null);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
  const [deletingIssueId, setDeletingIssueId] = useState(null);

  // Fetch Firebase Data
  useEffect(() => {
    const issuesRef = ref(db, "employeeStockIssues");
    const invRef = ref(db, "invoices");
    const empRef = ref(db, "employees");
    const prodRef = ref(db, "products");

    const unsubIssues = onValue(issuesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStockIssues(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setStockIssues([]);
      }
      setLoading(false);
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInvoices(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setInvoices([]);
      }
    });

    const unsubEmp = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEmployees(Object.keys(data).map((key) => ({ uid: key, ...data[key] })));
      } else {
        setEmployees([]);
      }
    });

    const unsubProd = onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProducts(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setProducts([]);
      }
    });

    return () => {
      unsubIssues();
      unsubInv();
      unsubEmp();
      unsubProd();
    };
  }, []);

  // Centralized Field Employee Stock & Reconciliation Calculations
  const {
    employees: reconciliationEmployees,
    overallIssued,
    overallSold,
    overallBalance,
    overallStockUtilizationFormatted,
    totalEmployeeStockValue,
    stockMismatchCount,
    paymentDiffCount
  } = useMemo(() => {
    return calculateEmployeeStockReconciliation({
      stockIssues,
      invoices,
      employeesList: employees,
      productsList: products,
      filterType,
      startDate,
      endDate,
      targetEmployeeUid: isAdmin ? null : currentUser?.uid
    });
  }, [stockIssues, invoices, employees, products, filterType, startDate, endDate, isAdmin, currentUser]);

  // Admin Central Stock Calculation (Source of truth: Stock Management records)
  const { totalAdminStockQty, totalAdminStockValue, adminProducts, filteredAdminProducts } = useMemo(() => {
    const calcResult = calculateAdminCentralStock({
      productsList: products,
      stockIssues,
      invoices
    });

    const filtered = calcResult.adminProducts.filter((prod) => {
      const matchesSearch =
        prod.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

    return {
      totalAdminStockQty: calcResult.totalAdminStockQty,
      totalAdminStockValue: calcResult.totalAdminStockValue,
      adminProducts: calcResult.adminProducts,
      filteredAdminProducts: filtered
    };
  }, [products, stockIssues, invoices, searchQuery]);

  // Filtered employees list for search
  const filteredEmployeesList = useMemo(() => {
    return reconciliationEmployees.filter((emp) => {
      if (!isAdmin && emp.uid !== currentUser?.uid) return false;
      const matchesSearch =
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [reconciliationEmployees, searchQuery, isAdmin, currentUser]);

  // Filtered Stock Transfers for History Tab
  const filteredHistoryIssues = useMemo(() => {
    return stockIssues
      .filter((iss) => {
        if (!isAdmin && iss.employeeId !== currentUser?.uid) return false;
        const matchesSearch =
          iss.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (iss.productName && iss.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (Array.isArray(iss.products) && iss.products.some(p => p.productName?.toLowerCase().includes(searchQuery.toLowerCase())));
        return matchesSearch;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [stockIssues, searchQuery, isAdmin, currentUser]);

  // Product-wise Combined Ledger Across Employees
  const productReconciliationMatrix = useMemo(() => {
    const prodMap = {};

    filteredEmployeesList.forEach((emp) => {
      emp.productList?.forEach((p) => {
        if (!prodMap[p.productId]) {
          prodMap[p.productId] = {
            productId: p.productId,
            productName: p.productName,
            image: p.image,
            category: p.category,
            unit: p.unit,
            totalIssued: 0,
            totalSold: 0,
            totalBalance: 0,
            totalSalesValue: 0,
            employeesCount: 0
          };
        }
        prodMap[p.productId].totalIssued += p.issued;
        prodMap[p.productId].totalSold += p.sold;
        prodMap[p.productId].totalBalance += p.balance;
        prodMap[p.productId].totalSalesValue += p.salesValue;
        if (p.issued > 0 || p.sold > 0) {
          prodMap[p.productId].employeesCount += 1;
        }
      });
    });

    return Object.values(prodMap).sort((a, b) => b.totalIssued - a.totalIssued || b.totalSold - a.totalSold);
  }, [filteredEmployeesList]);

  const handleOpenTransferModal = (prod = null) => {
    setPreSelectedProduct(prod);
    setIsTransferModalOpen(true);
  };

  // Delete Stock Allocation Handler
  const handleDeleteIssue = async (issueId) => {
    if (!issueId) return;
    try {
      const issueToDelete = stockIssues.find((i) => i.id === issueId);
      const updates = {};
      updates[`employeeStockIssues/${issueId}`] = null;
      updates[`stockTransfers/${issueId}`] = null;

      // Restore stock back to central warehouse if product exists
      if (issueToDelete) {
        const issueProducts = Array.isArray(issueToDelete.products) && issueToDelete.products.length > 0
          ? issueToDelete.products
          : (issueToDelete.productId ? [{ productId: issueToDelete.productId, quantity: issueToDelete.quantity }] : []);

        issueProducts.forEach((p) => {
          if (p.productId) {
            const dbProd = products.find((prod) => prod.id === p.productId);
            if (dbProd) {
              const currentStock = Number(dbProd.stock ?? dbProd.companyStock ?? 0);
              updates[`products/${p.productId}/stock`] = currentStock + Number(p.quantity || 0);
            }
          }
        });
      }

      await update(ref(db), updates);
      toast.success("Stock allocation record deleted & central stock restored", {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });
    } catch (err) {
      console.error("Error deleting stock allocation:", err);
      toast.error("Failed to delete stock allocation record");
    }
    setDeletingIssueId(null);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-12 font-['Inter']">
      <Toaster />

      {/* Header & Actions */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2.5 rounded-2xl bg-[#111] text-[#D4AF37] text-lg shadow-md">
              <FiLayers />
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">
              {isAdmin ? "Central Stock & Transfer Management" : "My Stock Ledger"}
            </h1>
          </div>
          <p className="text-gray-500 font-medium text-sm">
            Admin Central Stock, employee stock allocation transfers, editing, deletion & continuous ledger
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
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

      {/* Overview KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        
        {/* Employee Field Stock Value */}
        <div className="bg-[#111111] text-white premium-shadow border border-gray-800 rounded-[28px] p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#D4AF37] blur-[50px] opacity-20 rounded-full group-hover:opacity-35 transition-opacity pointer-events-none"></div>
          <div className="relative z-10">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">
              {isAdmin ? "Total Employee Stock Value" : "My Current Stock Value"}
            </span>
            <h2 className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
              ₹{totalEmployeeStockValue.toLocaleString('en-IN')}
            </h2>
            <p className="text-[10px] text-gray-300 font-semibold mt-2">
              {isAdmin ? "Remaining stock value held by sales representatives" : "Stock value currently held (Qty × Rate)"}
            </p>
          </div>
        </div>

        {/* Total Units Sold */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[28px] p-5 flex items-center justify-between transition-all hover:border-[#D4AF37]/30">
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Total Units Sold</span>
            <h2 className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
              {overallSold.toLocaleString('en-IN')} <span className="text-xs font-semibold text-gray-400">units</span>
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold mt-1">Stock Utilization: {overallStockUtilizationFormatted}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center text-xl border border-[#D4AF37]/20 shadow-sm shrink-0">
            <FiTrendingUp />
          </div>
        </div>

        {/* Remaining Field Balance & Mismatches */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[28px] p-5 flex items-center justify-between transition-all hover:border-[#D4AF37]/30">
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Field Stock Balance</span>
            <h2 className={`text-2xl font-bold font-['Poppins'] ${overallBalance < 0 ? "text-red-600" : "text-[#111]"}`}>
              {overallBalance.toLocaleString('en-IN')} <span className="text-xs font-semibold text-gray-400">bal units</span>
            </h2>
            <p className={`text-[10px] font-bold mt-1 ${stockMismatchCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {stockMismatchCount > 0 ? `🔴 ${stockMismatchCount} Stock Mismatch(es)` : "🟢 Stock Balances Normal"}
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm border shrink-0 ${stockMismatchCount > 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
            <FiClock />
          </div>
        </div>

      </motion.div>

      {/* Discrepancy Alerts Warning Bar (If Mismatches Exist) */}
      {isAdmin && (stockMismatchCount > 0 || paymentDiffCount > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-800">
            <FiAlertTriangle className="text-xl text-amber-600 shrink-0" />
            <p className="text-xs font-bold">
              Reconciliation Attention Needed: <span className="font-normal">{stockMismatchCount} employee(s) have stock mismatches and {paymentDiffCount} employee(s) have pending payment differences.</span>
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/60 px-3 py-1 rounded-full shrink-0">
            Audit Flag
          </span>
        </motion.div>
      )}

      {/* Navigation Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          {isAdmin && (
            <button
              onClick={() => setActiveTab("adminStock")}
              className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer whitespace-nowrap ${
                activeTab === "adminStock"
                  ? "bg-[#111] text-[#D4AF37] shadow-lg"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Central Company Stock ({filteredAdminProducts.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab("employees")}
            className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer whitespace-nowrap ${
              activeTab === "employees"
                ? "bg-[#111] text-[#D4AF37] shadow-lg"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Employee Summary ({filteredEmployeesList.length})
          </button>
          
          <button
            onClick={() => setActiveTab("products")}
            className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer whitespace-nowrap ${
              activeTab === "products"
                ? "bg-[#111] text-[#D4AF37] shadow-lg"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Product Matrix ({productReconciliationMatrix.length})
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer whitespace-nowrap ${
              activeTab === "history"
                ? "bg-[#111] text-[#D4AF37] shadow-lg"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Stock Allocation Log ({filteredHistoryIssues.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search product or employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl text-xs font-semibold text-[#111] p-3 pl-9 outline-none focus:border-[#D4AF37] shadow-sm transition-all"
          />
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* TAB 0: ADMIN CENTRAL STOCK DISPLAY & TRANSFER BUTTON */}
      {activeTab === "adminStock" && isAdmin && (
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#111] font-['Poppins']">Central Company Stock Master</h3>
              <p className="text-xs text-gray-400 mt-0.5">Live central inventory balance calculated strictly from Stock Management records</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddStockModalOpen(true)}
                className="bg-emerald-700 text-white hover:bg-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <FiPlusCircle className="text-sm" /> + Add Central Stock
              </button>
              <button
                onClick={() => handleOpenTransferModal(null)}
                className="bg-[#111] text-[#D4AF37] hover:bg-black px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <FiSend className="text-sm" /> Transfer Stock
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Product Name</th>
                  <th className="p-4 sm:p-5">Category</th>
                  <th className="p-4 sm:p-5 text-right">Selling Price</th>
                  <th className="p-4 sm:p-5 text-right">
                    Current Company Stock
                    <span className="text-[9px] text-[#D4AF37] font-semibold block tracking-normal normal-case">Current balance from Stock Management</span>
                  </th>
                  <th className="p-4 sm:p-5 text-right">Total Stock Value</th>
                  <th className="p-4 sm:p-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {filteredAdminProducts.length > 0 ? (
                  filteredAdminProducts.map((prod) => {
                    const currentStock = prod.currentAdminStock;
                    const sellingPrice = prod.sellingPrice;
                    const stockVal = prod.totalStockValue;

                    return (
                      <tr key={prod.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4 sm:p-5 font-bold">
                          <div className="flex items-center gap-3">
                            {prod.image ? (
                              <img src={prod.image} alt={prod.productName} className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 border border-gray-200">
                                <FiPackage />
                              </div>
                            )}
                            <div>
                              <span className="text-sm font-bold text-[#111]">{prod.productName}</span>
                              <span className="text-[10px] text-gray-400 font-semibold block">Unit: {prod.unit || 'KG'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 sm:p-5 text-gray-500 uppercase text-[11px] font-bold">
                          {prod.category || "General"}
                        </td>

                        <td className="p-4 sm:p-5 text-right font-bold text-gray-700 font-['Poppins']">
                          ₹{sellingPrice.toLocaleString('en-IN')}<span className="text-[10px] text-gray-400 font-normal"> / {prod.unit || 'KG'}</span>
                        </td>

                        <td className="p-4 sm:p-5 text-right font-bold font-['Poppins'] text-base">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                            currentStock > 0 ? "bg-amber-100 text-amber-900 border border-amber-200" : "bg-red-50 text-red-600 border border-red-200"
                          }`}>
                            {currentStock.toLocaleString('en-IN')} {prod.unit || 'KG'}
                          </span>
                        </td>

                        <td className="p-4 sm:p-5 text-right font-bold text-green-600 font-['Poppins']">
                          ₹{stockVal.toLocaleString('en-IN')}
                        </td>

                        <td className="p-4 sm:p-5 text-center">
                          <button
                            onClick={() => handleOpenTransferModal(prod)}
                            className="bg-[#111] text-[#D4AF37] hover:bg-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                          >
                            <FiSend className="text-xs" /> Transfer Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                      No products found in Central Admin Stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 1: EMPLOYEE RECONCILIATION CARDS GRID */}
      {activeTab === "employees" && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployeesList.length > 0 ? (
            filteredEmployeesList.map((emp) => (
              <motion.div
                key={emp.uid}
                variants={itemVariants}
                onClick={() => setSelectedEmployeeDetail(emp)}
                className="bg-white premium-shadow border border-gray-100 rounded-[28px] p-6 hover:border-[#D4AF37]/50 transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Employee Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3.5">
                      <EmployeeAvatar emp={emp} className="w-12 h-12 shadow-md border-2 border-gray-100 group-hover:border-[#D4AF37]/50" textClassName="text-sm font-bold" />
                      <div>
                        <h3 className="font-bold text-[#111] text-base tracking-tight font-['Poppins'] group-hover:text-[#D4AF37] transition-colors">
                          {emp.name}
                        </h3>
                        <span className="text-[10px] text-gray-400 font-semibold block capitalize">
                          {emp.role || "Sales Representative"}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${emp.status.color}`}>
                      {emp.status.icon} {emp.status.label}
                    </span>
                  </div>

                  {/* Stock Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 text-center mb-5">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Transferred</span>
                      <span className="text-base font-bold text-[#111] font-['Poppins']">{emp.totalIssued}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Sold</span>
                      <span className="text-base font-bold text-[#D4AF37] font-['Poppins']">{emp.totalSold}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Balance</span>
                      <span className={`text-base font-bold font-['Poppins'] ${emp.currentBalance < 0 ? "text-red-600" : "text-[#111]"}`}>
                        {emp.currentBalance}
                      </span>
                    </div>
                  </div>

                  {/* Stock Value & Financials */}
                  <div className="space-y-2 border-t border-gray-100 pt-4 text-xs font-semibold">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Employee Stock Value:</span>
                      <span className="font-bold text-[#111] font-['Poppins']">₹{emp.totalStockValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Expected Sales Total:</span>
                      <span className="font-bold text-green-600 font-['Poppins']">₹{emp.expectedSales.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Link */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#D4AF37] group-hover:translate-x-1 transition-transform">
                  <span>View Full Stock Breakdown</span>
                  <FiChevronRight className="text-base" />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-[30px] border border-gray-100">
              <FiPackage className="text-4xl text-gray-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-gray-700">No Employees Found</h4>
              <p className="text-xs text-gray-400 mt-1">No employee records match your search criteria.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 2: PRODUCT RECONCILIATION MATRIX */}
      {activeTab === "products" && (
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-[#111] font-['Poppins']">Product-wise Field Inventory Distribution</h3>
            <p className="text-xs text-gray-400 mt-0.5">Aggregated product stock transferred, sold, and remaining balance with employees</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Product Name</th>
                  <th className="p-4 sm:p-5 text-center">Active Employees</th>
                  <th className="p-4 sm:p-5 text-right">Total Transferred</th>
                  <th className="p-4 sm:p-5 text-right">Total Sold</th>
                  <th className="p-4 sm:p-5 text-right">Remaining Field Balance</th>
                  <th className="p-4 sm:p-5 text-right">Sales Turnover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {productReconciliationMatrix.length > 0 ? (
                  productReconciliationMatrix.map((prod) => (
                    <tr key={prod.productId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 sm:p-5 font-bold">
                        <div className="flex items-center gap-3">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.productName} className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 border border-gray-200">
                              <FiPackage />
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-bold text-[#111]">{prod.productName}</span>
                            <span className="text-[10px] text-gray-400 font-semibold block uppercase">{prod.category || "General"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 sm:p-5 text-center text-gray-600">
                        {prod.employeesCount} {prod.employeesCount === 1 ? 'employee' : 'employees'}
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold font-['Poppins']">
                        {prod.totalIssued} <span className="text-[10px] font-normal text-gray-400">{prod.unit || 'units'}</span>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-[#D4AF37] font-['Poppins']">
                        {prod.totalSold} <span className="text-[10px] font-normal text-gray-400">{prod.unit || 'units'}</span>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold font-['Poppins']">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${prod.totalBalance < 0 ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-100 text-gray-700"}`}>
                          {prod.totalBalance}
                        </span>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-green-600 font-['Poppins']">
                        ₹{prod.totalSalesValue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                      No product field distribution data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK ALLOCATION & TRANSFER HISTORY LOG (WITH EDIT & DELETE OPTIONS) */}
      {activeTab === "history" && (
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111] font-['Poppins']">Stock Allocation & Transfer History Log</h3>
              <p className="text-xs text-gray-400 mt-0.5">Historical movement records of stock transferred from Admin to field employees</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Transfer ID</th>
                  <th className="p-4 sm:p-5">Date</th>
                  <th className="p-4 sm:p-5">From</th>
                  <th className="p-4 sm:p-5">To (Employee)</th>
                  <th className="p-4 sm:p-5">Product Transferred</th>
                  <th className="p-4 sm:p-5 text-center">Quantity</th>
                  <th className="p-4 sm:p-5 text-right">Value</th>
                  <th className="p-4 sm:p-5">Transferred By</th>
                  <th className="p-4 sm:p-5">Note</th>
                  {isAdmin && <th className="p-4 sm:p-5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {filteredHistoryIssues.length > 0 ? (
                  filteredHistoryIssues.map((trf) => (
                    <tr key={trf.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 sm:p-5 font-bold font-['Poppins'] text-gray-700">
                        {trf.transferId || trf.issueNumber || trf.id.slice(-6)}
                      </td>

                      <td className="p-4 sm:p-5 text-gray-500 whitespace-nowrap">
                        {trf.date || new Date(trf.createdAt || Date.now()).toLocaleDateString()}
                      </td>

                      <td className="p-4 sm:p-5 text-gray-500 font-medium">
                        {trf.from || "Admin (Central Stock)"}
                      </td>

                      <td className="p-4 sm:p-5 font-bold font-['Poppins'] text-[#111]">
                        {trf.employeeName}
                      </td>

                      <td className="p-4 sm:p-5 font-bold text-[#111]">
                        {trf.productName || (Array.isArray(trf.products) ? trf.products.map(p => p.productName).join(", ") : "Product")}
                      </td>

                      <td className="p-4 sm:p-5 text-center font-bold text-[#D4AF37] font-['Poppins'] text-sm">
                        {trf.quantity || trf.totalQuantity} <span className="text-[10px] text-gray-400 font-normal">{trf.unit || 'units'}</span>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-green-600 font-['Poppins']">
                        ₹{Number(trf.totalValue || trf.price * trf.quantity || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="p-4 sm:p-5 text-gray-500">
                        {trf.createdByName || "Admin"}
                      </td>

                      <td className="p-4 sm:p-5 text-gray-400 text-[11px] max-w-[180px] truncate">
                        {trf.notes || "-"}
                      </td>

                      {isAdmin && (
                        <td className="p-4 sm:p-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingIssue(trf);
                                setIsIssueModalOpen(true);
                              }}
                              title="Edit Stock Allocation"
                              className="p-2 rounded-xl bg-gray-100 hover:bg-[#D4AF37]/20 text-gray-600 hover:text-[#D4AF37] transition-colors cursor-pointer"
                            >
                              <FiEdit className="text-sm" />
                            </button>
                            <button
                              onClick={() => setDeletingIssueId(trf.id)}
                              title="Delete Stock Allocation"
                              className="p-2 rounded-xl bg-gray-100 hover:bg-red-500/10 text-gray-600 hover:text-red-500 transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="text-sm" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-400 font-medium">
                      No stock transfer records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Stock to Central Warehouse Modal */}
      <AddStockModal
        isOpen={isAddStockModalOpen}
        onClose={() => setIsAddStockModalOpen(false)}
        productsList={adminProducts}
      />

      {/* Transfer Stock Modal */}
      <TransferStockModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setPreSelectedProduct(null);
        }}
        employeesList={employees}
        productsList={adminProducts}
        preSelectedProduct={preSelectedProduct}
      />

      {/* Edit Stock Issue Modal */}
      <IssueStockModal
        isOpen={isIssueModalOpen}
        onClose={() => {
          setIsIssueModalOpen(false);
          setEditingIssue(null);
        }}
        employeesList={employees}
        productsList={adminProducts}
        editingIssue={editingIssue}
      />

      {/* Employee Detail Modal */}
      <EmployeeStockDetailModal
        employee={selectedEmployeeDetail}
        isOpen={!!selectedEmployeeDetail}
        onClose={() => setSelectedEmployeeDetail(null)}
        onEditIssue={(iss) => {
          setEditingIssue(iss);
          setIsIssueModalOpen(true);
        }}
        onDeleteIssue={(id) => setDeletingIssueId(id)}
        isAdmin={isAdmin}
      />

      {/* Confirm Delete Stock Allocation Modal */}
      {deletingIssueId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-['Inter']">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 max-w-md w-full border border-gray-100 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl mb-4 border border-red-100">
              <FiAlertTriangle />
            </div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Delete Stock Allocation?</h3>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              Are you sure you want to remove this stock allocation record? This will adjust the employee's stock balance calculation and restore stock to the central warehouse.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setDeletingIssueId(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteIssue(deletingIssueId)}
                className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
