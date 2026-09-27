import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  FiPackage,
  FiPlus,
  FiUsers,
  FiTrendingUp,
  FiDollarSign,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiSearch,
  FiEdit,
  FiTrash2,
  FiChevronRight,
  FiRefreshCw,
  FiLayers,
  FiX
} from "react-icons/fi";
import EmployeeAvatar from "../components/EmployeeAvatar";
import DateFilter from "../components/DateFilter";
import IssueStockModal from "../components/IssueStockModal";
import EmployeeStockDetailModal from "../components/EmployeeStockDetailModal";
import { calculateEmployeeStockReconciliation } from "../utils/calculations";

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
  const [activeTab, setActiveTab] = useState("employees"); // "employees" | "products" | "history"

  // Modals & Drawers
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
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

  // Centralized Stock & Reconciliation Calculations
  const {
    employees: reconciliationEmployees,
    overallIssued,
    overallSold,
    overallBalance,
    overallStockUtilizationFormatted,
    totalCentralStockQty,
    totalCentralStockValue,
    totalEmployeeStockValue,
    totalCompanyControlledStockQty,
    totalCompanyStockValue,
    stockMismatchCount,
    paymentDiffCount,
    employeesWithBalanceCount
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

  // Filtered Stock Issues for History Tab
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

  // Delete Stock Allocation Handler
  const handleDeleteIssue = async (issueId) => {
    if (!issueId) return;
    try {
      await remove(ref(db, `employeeStockIssues/${issueId}`));
      toast.success("Stock allocation record removed", {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete stock allocation");
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
              {isAdmin ? "Employee Stock & Reconciliation" : "My Stock & Reconciliation"}
            </h1>
          </div>
          <p className="text-gray-500 font-medium text-sm">
            Continuous inventory ledger, physical stock allocation bills & sales reconciliation
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

          {isAdmin && (
            <button
              onClick={() => {
                setEditingIssue(null);
                setIsIssueModalOpen(true);
              }}
              className="w-full sm:w-auto bg-[#111111] text-[#D4AF37] hover:bg-black px-6 py-3.5 rounded-[20px] font-bold text-xs shadow-xl transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02]"
            >
              <FiPlus className="text-base" /> Issue Stock to Employee
            </button>
          )}
        </div>
      </motion.div>

      {/* Overview KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        {/* Total Company Stock Value */}
        <div className="bg-[#111111] text-white premium-shadow border border-gray-800 rounded-[28px] p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-[#D4AF37] blur-[50px] opacity-20 rounded-full group-hover:opacity-35 transition-opacity pointer-events-none"></div>
          <div className="relative z-10">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Total Company Stock Value</span>
            <h2 className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
              ₹{totalCompanyStockValue.toLocaleString('en-IN')}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-300 font-semibold">
              <span>Central: ₹{totalCentralStockValue.toLocaleString('en-IN')}</span>
              <span>•</span>
              <span>Employees: ₹{totalEmployeeStockValue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Total Issued & Units */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[28px] p-5 flex items-center justify-between transition-all hover:border-[#D4AF37]/30">
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Total Units Issued</span>
            <h2 className="text-2xl font-bold text-[#111] font-['Poppins']">
              {overallIssued.toLocaleString('en-IN')} <span className="text-xs font-semibold text-gray-400">units</span>
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold mt-1">Physical stock allocated to staff</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-gray-50 text-[#D4AF37] flex items-center justify-center text-xl border border-gray-100 shadow-sm shrink-0">
            <FiPackage />
          </div>
        </div>

        {/* Total Units Sold */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[28px] p-5 flex items-center justify-between transition-all hover:border-[#D4AF37]/30">
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Total Units Sold</span>
            <h2 className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
              {overallSold.toLocaleString('en-IN')} <span className="text-xs font-semibold text-gray-400">units</span>
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold mt-1">Overall Sold: {overallStockUtilizationFormatted}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center text-xl border border-[#D4AF37]/20 shadow-sm shrink-0">
            <FiTrendingUp />
          </div>
        </div>

        {/* Remaining Balance Stock & Mismatches */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[28px] p-5 flex items-center justify-between transition-all hover:border-[#D4AF37]/30">
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest block mb-1">Balance & Mismatches</span>
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

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
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
            Stock Issue Log ({filteredHistoryIssues.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search employee or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl text-xs font-semibold text-[#111] p-3 pl-9 outline-none focus:border-[#D4AF37] shadow-sm transition-all"
          />
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

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
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Issued</span>
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

                  {/* Sales & Payment Reconciliation Row */}
                  <div className="space-y-2 border-t border-gray-100 pt-4 text-xs font-semibold">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Expected Sales Amount:</span>
                      <span className="font-bold text-green-600 font-['Poppins']">₹{emp.expectedSales.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Payment Recorded:</span>
                      <span className="font-bold text-emerald-600 font-['Poppins']">₹{emp.receivedAmount.toLocaleString('en-IN')}</span>
                    </div>
                    {emp.paymentDifference > 0 && (
                      <div className="flex justify-between items-center text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-100">
                        <span>Payment Difference:</span>
                        <span className="font-['Poppins']">₹{emp.paymentDifference.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Link */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#D4AF37] group-hover:translate-x-1 transition-transform">
                  <span>View Stock Breakdown & History</span>
                  <FiChevronRight className="text-base" />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-[30px] border border-gray-100">
              <FiPackage className="text-4xl text-gray-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-gray-700">No Employees Found</h4>
              <p className="text-xs text-gray-400 mt-1">No stock allocation or sales records match your search criteria.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 2: PRODUCT RECONCILIATION MATRIX */}
      {activeTab === "products" && (
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-[#111] font-['Poppins']">Product-wise Inventory Distribution</h3>
            <p className="text-xs text-gray-400 mt-0.5">Aggregated product stock issued, sold, and remaining with field employees</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Product Name</th>
                  <th className="p-4 sm:p-5 text-center">Active Employees</th>
                  <th className="p-4 sm:p-5 text-right">Total Issued</th>
                  <th className="p-4 sm:p-5 text-right">Total Sold</th>
                  <th className="p-4 sm:p-5 text-right">Remaining Balance</th>
                  <th className="p-4 sm:p-5 text-right">Sales Value</th>
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
                      No product stock reconciliation data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK ISSUE HISTORY LOG */}
      {activeTab === "history" && (
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#111] font-['Poppins'] font-bold">Physical Stock Allocation Log</h3>
              <p className="text-xs text-gray-400 mt-0.5">Historical records of stock issued to employees</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Issue Date</th>
                  <th className="p-4 sm:p-5">Employee</th>
                  <th className="p-4 sm:p-5">Product Issued</th>
                  <th className="p-4 sm:p-5 text-center">Quantity</th>
                  <th className="p-4 sm:p-5">Allocated By</th>
                  <th className="p-4 sm:p-5">Notes</th>
                  {isAdmin && <th className="p-4 sm:p-5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {filteredHistoryIssues.length > 0 ? (
                  filteredHistoryIssues.map((iss) => (
                    <tr key={iss.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 sm:p-5 text-gray-500 whitespace-nowrap">
                        {iss.date || new Date(iss.createdAt || Date.now()).toLocaleDateString()}
                      </td>

                      <td className="p-4 sm:p-5 font-bold font-['Poppins']">
                        {iss.employeeName}
                      </td>

                      <td className="p-4 sm:p-5 font-bold text-[#111]">
                        {iss.productName}
                      </td>

                      <td className="p-4 sm:p-5 text-center font-bold text-[#D4AF37] font-['Poppins'] text-sm">
                        {iss.quantity} <span className="text-[10px] text-gray-400 font-normal">{iss.unit || 'units'}</span>
                      </td>

                      <td className="p-4 sm:p-5 text-gray-500">
                        {iss.createdByName || "Admin"}
                      </td>

                      <td className="p-4 sm:p-5 text-gray-400 text-[11px] max-w-[200px] truncate">
                        {iss.notes || "-"}
                      </td>

                      {isAdmin && (
                        <td className="p-4 sm:p-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingIssue(iss);
                                setIsIssueModalOpen(true);
                              }}
                              title="Edit Issue Record"
                              className="p-2 rounded-xl bg-gray-100 hover:bg-[#D4AF37]/20 text-gray-600 hover:text-[#D4AF37] transition-colors cursor-pointer"
                            >
                              <FiEdit className="text-sm" />
                            </button>
                            <button
                              onClick={() => setDeletingIssueId(iss.id)}
                              title="Delete Allocation"
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
                    <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                      No stock allocation records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Issue Modal */}
      <IssueStockModal
        isOpen={isIssueModalOpen}
        onClose={() => {
          setIsIssueModalOpen(false);
          setEditingIssue(null);
        }}
        employeesList={employees}
        productsList={products}
        editingIssue={editingIssue}
      />

      {/* Employee Detail Modal */}
      <EmployeeStockDetailModal
        employee={selectedEmployeeDetail}
        isOpen={!!selectedEmployeeDetail}
        onClose={() => setSelectedEmployeeDetail(null)}
      />

      {/* Confirm Delete Stock Issue Modal */}
      {deletingIssueId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 max-w-md w-full border border-gray-100 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl mb-4 border border-red-100">
              <FiAlertTriangle />
            </div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Delete Stock Allocation?</h3>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              Are you sure you want to remove this stock allocation record? This will adjust the employee's stock balance calculation.
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
