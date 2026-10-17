import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiDollarSign,
  FiPackage,
  FiFileText,
  FiTrendingDown,
  FiBriefcase,
  FiAward,
  FiPlus,
  FiTrendingUp,
  FiCreditCard,
  FiCheckCircle,
  FiCalendar,
  FiArrowUpRight,
  FiRefreshCw
} from "react-icons/fi";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DateFilter from "../components/DateFilter";
import ReportTable from "../components/ReportTable";
import ExpenseByCategoryChart from "../components/ExpenseByCategoryChart";
import ProductSalesChart from "../components/ProductSalesChart";
import EmployeeAvatar from "../components/EmployeeAvatar";
import { calculateMetrics, filterItemsByDate, calculateEmployeeStockReconciliation } from "../utils/calculations";
import baharaLogo from "../assets/bahara.logo.jpg";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 320, damping: 26 }
  }
};

export default function EmployeeDashboard() {
  const { currentUser, userProfile, role } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockIssues, setStockIssues] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterType, setFilterType] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Online / Offline live listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Personalized Greeting based on local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Authenticated Employee Details
  const employeeName =
    userProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "Sales Executive";

  const employeeRole =
    userProfile?.roleTitle ||
    userProfile?.designation ||
    (role === "admin" ? "System Administrator" : "Field Sales Executive");

  // Real-time Database Listeners
  useEffect(() => {
    const invRef = ref(db, "invoices");
    const expRef = ref(db, "expenses");
    const prodRef = ref(db, "products");
    const issuesRef = ref(db, "employeeStockIssues");
    const empRef = ref(db, "employees");

    const unsubInv = onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      setInvoices(data ? Object.keys(data).map((k) => ({ id: k, ...data[k] })) : []);
    });

    const unsubExp = onValue(expRef, (snapshot) => {
      const data = snapshot.val();
      setExpenses(data ? Object.keys(data).map((k) => ({ id: k, ...data[k] })) : []);
    });

    const unsubProd = onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      setProducts(data ? Object.keys(data).map((k) => ({ id: k, ...data[k] })) : []);
    });

    const unsubIssues = onValue(issuesRef, (snapshot) => {
      const data = snapshot.val();
      setStockIssues(data ? Object.keys(data).map((k) => ({ id: k, ...data[k] })) : []);
    });

    const unsubEmp = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      setEmployees(data ? Object.keys(data).map((k) => ({ uid: k, ...data[k] })) : []);
    });

    return () => {
      unsubInv();
      unsubExp();
      unsubProd();
      unsubIssues();
      unsubEmp();
    };
  }, []);

  // Compute Employee Stock Reconciliation using centralized engine
  const myStockRecon = useMemo(() => {
    const empTargetUid = userProfile?.uid || currentUser?.uid;
    const res = calculateEmployeeStockReconciliation({
      stockIssues,
      invoices,
      employeesList: employees,
      productsList: products,
      targetEmployeeUid: empTargetUid
    });
    return res.employees.length > 0 ? res.employees[0] : null;
  }, [stockIssues, invoices, employees, products, userProfile, currentUser]);

  // Compute Employee Dashboard Metrics using centralized calculation engine
  const {
    filteredInvoices,
    totalTurnover,
    pendingTotal,
    totalExpenses,
    profit,
    totalItemsSold,
    totalInvoices,
    averageInvoiceValue,
    topProduct,
    chartData
  } = useMemo(() => {
    const dateFilteredInvoices = filterItemsByDate(
      invoices,
      filterType,
      startDate,
      endDate,
      "createdAt",
      "invoiceDate"
    );
    const dateFilteredExpenses = filterItemsByDate(
      expenses,
      filterType,
      startDate,
      endDate,
      "createdAt",
      "expenseDate"
    );

    const metrics = calculateMetrics({
      invoices: dateFilteredInvoices,
      expenses: dateFilteredExpenses,
      employeeUid: currentUser?.uid
    });

    // Chronological timeline chart
    const dateGroupMap = {};
    metrics.invoices.forEach((inv) => {
      let saleDateVal = inv.createdAt || 0;
      if (inv.invoiceDate) {
        const [y, m, d] = inv.invoiceDate.split("-");
        saleDateVal = new Date(y, m - 1, d).getTime();
      }
      const dateStr = new Date(saleDateVal).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });
      if (!dateGroupMap[dateStr]) {
        dateGroupMap[dateStr] = { date: dateStr, rawDate: saleDateVal, Sales: 0 };
      }
      dateGroupMap[dateStr].Sales += Number(inv.totalAmount) || 0;
    });

    const chartArr = Object.values(dateGroupMap).sort((a, b) => a.rawDate - b.rawDate);

    return {
      filteredInvoices: metrics.invoices,
      totalTurnover: metrics.totalTurnover,
      pendingTotal: metrics.pendingTotal,
      totalExpenses: metrics.totalExpenses,
      profit: metrics.profit,
      totalItemsSold: metrics.totalItemsSold,
      totalInvoices: metrics.totalInvoices,
      averageInvoiceValue: metrics.averageInvoiceValue,
      topProduct: metrics.topProduct,
      chartData: chartArr
    };
  }, [invoices, expenses, currentUser?.uid, filterType, startDate, endDate]);

  const myEmployeeExpenses = useMemo(() => {
    const dateFilteredExp = filterItemsByDate(
      expenses,
      filterType,
      startDate,
      endDate,
      "createdAt",
      "expenseDate"
    );
    if (currentUser?.uid) {
      return dateFilteredExp.filter((exp) => exp.createdByUid === currentUser.uid);
    }
    return dateFilteredExp;
  }, [expenses, filterType, startDate, endDate, currentUser]);

  const paidAmount = Math.max(0, totalTurnover - pendingTotal);
  const collectionRate =
    totalTurnover > 0 ? Math.round((paidAmount / totalTurnover) * 100) : 0;

  return (
    <div className="relative min-h-screen text-[#111] font-['Inter'] pb-28 lg:pb-12">
      {/* Subtle Bahara Brand Logo Watermark */}
      <div
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={baharaLogo}
          alt=""
          className="w-[680px] max-w-[85vw] opacity-[0.035] filter grayscale contrast-125 select-none transform -rotate-12 scale-110"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        {/* ========================================================= */}
        {/* 1. EMPLOYEE WELCOME HEADER                                */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-[32px] p-6 sm:p-8 border border-stone-200/80 shadow-[0_4px_25px_rgba(11,36,20,0.04)] relative overflow-hidden"
        >
          {/* Subtle gold accent corner wash */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#D4AF37]/15 via-[#143822]/5 to-transparent rounded-bl-full pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            {/* Left: Avatar, Greeting, Name & Status */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Professional Circular Avatar with Status Dot */}
              <div className="relative shrink-0">
                <EmployeeAvatar
                  emp={userProfile || { name: employeeName, role }}
                  role={role}
                  className="w-16 h-16 sm:w-20 sm:h-20 shadow-md ring-2 ring-[#D4AF37]/60"
                  roundedClassName="rounded-full"
                  textClassName="text-2xl sm:text-3xl"
                />
                {/* Live Online/Offline Status Indicator on Avatar */}
                <span
                  title={isOnline ? "Online" : "Offline"}
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                    isOnline ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </div>

              {/* Greeting & Name */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37] font-['Poppins']">
                    {greeting}
                  </span>
                  <span className="text-stone-300">•</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isOnline
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200/70"
                        : "bg-amber-50 text-amber-800 border-amber-200/70"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    {isOnline ? "Online • Live Sync" : "Offline Mode"}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                  {employeeName}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-500 font-medium">
                  <span className="font-semibold text-[#143822]">{employeeRole}</span>
                  <span className="text-stone-300">•</span>
                  <span>Bahara Works Official Cardamom Division</span>
                </div>
              </div>
            </div>

            {/* Right: Date Filter & Fast Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <DateFilter
                filterType={filterType}
                setFilterType={setFilterType}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
              />
              <Link
                to="/invoice"
                className="hidden sm:inline-flex items-center justify-center gap-2 bg-[#143822] hover:bg-[#0B2414] text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
              >
                <FiPlus className="text-base text-[#D4AF37]" /> New Invoice
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ========================================================= */}
        {/* 2. SALES STATISTICS KPI CARDS                             */}
        {/* ========================================================= */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {/* Hero Card: Net Balance */}
          <motion.div
            variants={itemVariants}
            className="sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-[#0B2414] via-[#12361E] to-[#1C4B2B] text-white rounded-[28px] p-6 shadow-xl border border-[#D4AF37]/35 relative overflow-hidden flex flex-col justify-between group"
          >
            {/* Watermark Logo Accent in Hero Card */}
            <img
              src={baharaLogo}
              alt=""
              aria-hidden="true"
              className="absolute -right-8 -bottom-8 w-44 h-44 opacity-10 rounded-full filter brightness-200 contrast-150 pointer-events-none mix-blend-screen transform rotate-6"
            />
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37] blur-[70px] opacity-25 rounded-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                  Primary KPI
                </span>
                <span className="w-10 h-10 rounded-2xl bg-white/10 text-[#D4AF37] flex items-center justify-center text-lg shadow-inner">
                  <FiCreditCard />
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-100/75 block mb-1">
                My Net Balance
              </span>
              <h2
                className={`text-3xl sm:text-4xl font-bold tracking-tight font-['Poppins'] ${
                  profit < 0 ? "text-rose-300" : "text-[#D4AF37]"
                }`}
              >
                {profit < 0
                  ? `-₹${Math.abs(profit).toLocaleString("en-IN")}`
                  : `₹${profit.toLocaleString("en-IN")}`}
              </h2>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 text-[11px] text-emerald-100/70 font-medium flex items-center justify-between">
              <span>Sales ₹{totalTurnover.toLocaleString("en-IN")}</span>
              <span className="text-rose-200/80">Exp -₹{totalExpenses.toLocaleString("en-IN")}</span>
            </div>
          </motion.div>

          {/* Gross Sales */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[28px] p-6 border border-stone-200/80 shadow-[0_2px_15px_rgba(11,36,20,0.03)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Turnover
                </span>
                <span className="w-10 h-10 rounded-2xl bg-[#D4AF37]/15 text-[#9E7D17] flex items-center justify-center text-lg">
                  <FiDollarSign />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                My Gross Sales
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                ₹{totalTurnover.toLocaleString("en-IN")}
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Total sales value for selected period
            </div>
          </motion.div>

          {/* Cash Collected */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[28px] p-6 border border-stone-200/80 shadow-[0_2px_15px_rgba(11,36,20,0.03)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Collections
                </span>
                <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg">
                  <FiBriefcase />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                Cash Collected
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-emerald-700 tracking-tight font-['Poppins']">
                ₹{paidAmount.toLocaleString("en-IN")}
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium flex items-center justify-between">
              <span>Pending: ₹{pendingTotal.toLocaleString("en-IN")}</span>
              <span className="font-bold text-emerald-700">{collectionRate}% paid</span>
            </div>
          </motion.div>

          {/* Operational Expenses */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[28px] p-6 border border-stone-200/80 shadow-[0_2px_15px_rgba(11,36,20,0.03)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Expenses
                </span>
                <span className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg">
                  <FiTrendingDown />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                My Field Expenses
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-rose-600 tracking-tight font-['Poppins']">
                ₹{totalExpenses.toLocaleString("en-IN")}
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>{myEmployeeExpenses.length} expense entry(s)</span>
            </div>
          </motion.div>

          {/* Stock Assigned */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[28px] p-6 border border-stone-200/80 shadow-[0_2px_15px_rgba(11,36,20,0.03)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Allocation
                </span>
                <span className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center text-lg">
                  <FiPackage />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                Stock Assigned
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                {myStockRecon?.totalIssued || 0}{" "}
                <span className="text-sm font-normal text-stone-400">units</span>
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium">
              Total units allocated to your profile
            </div>
          </motion.div>

          {/* Stock Balance */}
          <motion.div
            variants={itemVariants}
            className={`rounded-[28px] p-6 border shadow-[0_2px_15px_rgba(11,36,20,0.03)] transition-all flex flex-col justify-between group ${
              myStockRecon && myStockRecon.currentBalance < 0
                ? "bg-rose-50/70 border-rose-300 text-rose-900"
                : "bg-white border-stone-200/80 text-stone-900 hover:border-[#D4AF37]/50"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Inventory
                </span>
                <span className="w-10 h-10 rounded-2xl bg-[#143822]/10 text-[#143822] flex items-center justify-center text-lg">
                  <FiPackage />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                Stock Balance (In Hand)
              </span>
              <h2
                className={`text-2xl sm:text-3xl font-bold tracking-tight font-['Poppins'] ${
                  myStockRecon && myStockRecon.currentBalance < 0
                    ? "text-rose-600"
                    : "text-[#143822]"
                }`}
              >
                {myStockRecon?.currentBalance || 0}{" "}
                <span className="text-sm font-normal text-stone-400">units</span>
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium">
              Remaining stock available to sell
            </div>
          </motion.div>

          {/* Invoices Generated */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[28px] p-6 border border-stone-200/80 shadow-[0_2px_15px_rgba(11,36,20,0.03)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Activity
                </span>
                <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-lg">
                  <FiFileText />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                Invoices Generated
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                {totalInvoices}
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium">
              Completed customer sales invoices
            </div>
          </motion.div>

          {/* Units Sold */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[28px] p-6 border border-stone-200/80 shadow-[0_2px_15px_rgba(11,36,20,0.03)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Volume
                </span>
                <span className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center text-lg">
                  <FiCheckCircle />
                </span>
              </div>
              <span className="text-xs font-semibold text-stone-500 block mb-1">
                Total Units Sold
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                {totalItemsSold}{" "}
                <span className="text-sm font-normal text-stone-400">units</span>
              </h2>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-stone-500 font-medium">
              Physical product units dispatched
            </div>
          </motion.div>
        </motion.div>

        {/* ========================================================= */}
        {/* 3. ASSIGNED STOCK INVENTORY SECTION                       */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-[32px] p-6 sm:p-8 border border-stone-200/80 shadow-[0_4px_25px_rgba(11,36,20,0.04)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block mb-0.5">
                Inventory Ledger
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight font-['Poppins'] flex items-center gap-2.5">
                <FiPackage className="text-[#143822]" /> Assigned Stock Inventory
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-1">
                Personal stock allocation, continuous inventory balance & utilization
              </p>
            </div>

            {myStockRecon?.status && (
              <span
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border self-start sm:self-auto ${myStockRecon.status.color}`}
              >
                {myStockRecon.status.icon} {myStockRecon.status.label}
              </span>
            )}
          </div>

          {/* Inventory Overview Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-0.5">
                Total Products
              </span>
              <span className="text-lg font-bold text-stone-900 font-['Poppins']">
                {myStockRecon?.productList?.length || 0}
              </span>
            </div>

            <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100 text-center">
              <span className="text-[9px] font-bold text-sky-800 uppercase tracking-widest block mb-0.5">
                Total Issued
              </span>
              <span className="text-lg font-bold text-sky-700 font-['Poppins']">
                {myStockRecon?.totalIssued || 0}{" "}
                <span className="text-xs font-normal text-sky-500">units</span>
              </span>
            </div>

            <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-0.5">
                Total Sold
              </span>
              <span className="text-lg font-bold text-[#D4AF37] font-['Poppins']">
                {myStockRecon?.totalSold || 0}{" "}
                <span className="text-xs font-normal text-stone-400">units</span>
              </span>
            </div>

            <div
              className={`p-3.5 rounded-2xl border text-center ${
                myStockRecon?.currentBalance < 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-[#FAF8F5] border-stone-200/60"
              }`}
            >
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-0.5">
                In-Hand Balance
              </span>
              <span
                className={`text-lg font-bold font-['Poppins'] ${
                  myStockRecon?.currentBalance < 0 ? "text-rose-600" : "text-[#143822]"
                }`}
              >
                {myStockRecon?.currentBalance || 0}{" "}
                <span className="text-xs font-normal">units</span>
              </span>
            </div>

            <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-0.5">
                Stock Value
              </span>
              <span className="text-lg font-bold text-emerald-700 font-['Poppins']">
                ₹{(myStockRecon?.totalStockValue || 0).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/60 text-center">
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-widest block mb-0.5">
                Utilization %
              </span>
              <span className="text-lg font-bold text-amber-700 font-['Poppins']">
                {myStockRecon?.overallUtilizationFormatted || "0%"}
              </span>
            </div>
          </div>

          {/* Product Cards Grid */}
          {myStockRecon?.productList && myStockRecon.productList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myStockRecon.productList.map((prod) => {
                const issuedQty =
                  prod.issued ??
                  (prod.receivedFromCompany || 0) + (prod.receivedFromEmployees || 0);
                return (
                  <div
                    key={prod.productId}
                    className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs hover:border-[#D4AF37]/60 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.productName}
                              className="w-12 h-12 rounded-xl object-cover border border-stone-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[#143822]/10 text-[#143822] flex items-center justify-center text-lg border border-[#143822]/20 shrink-0">
                              <FiPackage />
                            </div>
                          )}
                          <div>
                            <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider block">
                              {prod.category || "Cardamom Spices"}
                            </span>
                            <h4 className="font-bold text-stone-900 text-base font-['Poppins']">
                              {prod.productName}
                            </h4>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                            prod.status?.color || "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {prod.status?.label || "In Stock"}
                        </span>
                      </div>

                      {/* 4-Stat Metric Badges */}
                      <div className="grid grid-cols-4 gap-2 bg-[#FAF8F5] p-3 rounded-xl border border-stone-200/60 text-center mb-3">
                        <div className="bg-sky-50/50 rounded-lg p-1.5 border border-sky-100/50">
                          <span className="text-[8px] font-bold text-sky-700 uppercase tracking-widest block">
                            Issued
                          </span>
                          <span className="text-xs font-bold text-sky-700 font-['Poppins']">
                            {issuedQty}
                          </span>
                        </div>
                        <div className="bg-amber-50/50 rounded-lg p-1.5 border border-amber-100/50">
                          <span className="text-[8px] font-bold text-amber-800 uppercase tracking-widest block">
                            Sold
                          </span>
                          <span className="text-xs font-bold text-[#9E7D17] font-['Poppins']">
                            {prod.sold || 0}
                          </span>
                        </div>
                        <div
                          className={`rounded-lg p-1.5 border ${
                            prod.balance < 0
                              ? "bg-rose-50 border-rose-100"
                              : "bg-emerald-50/50 border-emerald-100/50"
                          }`}
                        >
                          <span className="text-[8px] font-bold text-stone-500 uppercase tracking-widest block">
                            Balance
                          </span>
                          <span
                            className={`text-xs font-bold font-['Poppins'] ${
                              prod.balance < 0 ? "text-rose-600" : "text-emerald-700"
                            }`}
                          >
                            {prod.balance || 0}
                          </span>
                        </div>
                        <div className="bg-purple-50/50 rounded-lg p-1.5 border border-purple-100/50">
                          <span className="text-[8px] font-bold text-purple-700 uppercase tracking-widest block">
                            Sold %
                          </span>
                          <span className="text-xs font-bold text-purple-600 font-['Poppins']">
                            {prod.utilizationFormatted || "0%"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-stone-500 border-t border-stone-100 pt-2.5">
                      <span>
                        Stock Value:{" "}
                        <strong className="text-emerald-700 font-bold">
                          ₹{(prod.stockValue || 0).toLocaleString("en-IN")}
                        </strong>
                      </span>
                      <span>
                        Rate:{" "}
                        <strong className="text-stone-900 font-bold">
                          ₹{(prod.unitPrice || 0).toLocaleString("en-IN")}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-stone-400 font-medium bg-[#FAF8F5] rounded-2xl border border-stone-200/70">
              <FiPackage className="text-3xl text-stone-300 mx-auto mb-2" />
              No stock has been allocated to your profile yet. Contact your administrator for stock issue.
            </div>
          )}
        </motion.div>

        {/* ========================================================= */}
        {/* 4. PERFORMANCE: TOP PRODUCT & AVERAGE ORDER VALUE         */}
        {/* ========================================================= */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Top Selling Product */}
          <div className="lg:col-span-8 bg-white border border-stone-200/80 rounded-[32px] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-[0_4px_25px_rgba(11,36,20,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-0.5">
                  Top Performer
                </span>
                <h3 className="text-xl font-bold text-stone-900 font-['Poppins']">
                  My Highest Selling Product
                </h3>
              </div>
              <span className="px-3.5 py-1.5 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#9E7D17] font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5">
                <FiAward className="text-sm" /> Best Seller
              </span>
            </div>

            {topProduct ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 my-2">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#143822] text-[#D4AF37] rounded-2xl flex items-center justify-center text-2xl shadow-md shrink-0">
                    <FiPackage />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      {topProduct.category || "Spices"}
                    </span>
                    <h4 className="text-2xl font-bold text-stone-900 font-['Poppins']">
                      {topProduct.name}
                    </h4>
                  </div>
                </div>

                <div className="flex gap-8 sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-stone-100 pt-4 sm:pt-0">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">
                      Units Sold
                    </span>
                    <span className="text-2xl font-bold text-stone-900 font-['Poppins']">
                      {topProduct.qty}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">
                      Sales Revenue
                    </span>
                    <span className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
                      ₹{Number(topProduct.revenue).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-stone-400 font-medium">
                No sales recorded for this period
              </div>
            )}
          </div>

          {/* Average Order Value Badge */}
          <div className="lg:col-span-4 bg-gradient-to-br from-[#0B2414] via-[#12361E] to-[#1C4B2B] text-white rounded-[32px] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-lg border border-[#D4AF37]/25">
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37] blur-[70px] opacity-25 rounded-full pointer-events-none" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] bg-white/10 px-3 py-1 rounded-full border border-white/10 inline-block mb-3">
                Order Value Metric
              </span>
              <span className="text-xs font-semibold text-emerald-100/70 block mb-1">
                Average Order Value
              </span>
              <h3 className="text-4xl font-bold text-[#D4AF37] tracking-tight font-['Poppins']">
                ₹{averageInvoiceValue.toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-emerald-100/70 mt-2 font-medium">
                Average sales revenue per completed customer invoice
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-300 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md w-fit border border-white/10">
              <FiTrendingUp /> Calculated across {totalInvoices} invoice(s)
            </div>
          </div>
        </motion.div>

        {/* ========================================================= */}
        {/* 5. CHARTS: PRODUCT SALES & EXPENSE CATEGORIES             */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ProductSalesChart
              invoices={filteredInvoices}
              productsList={products}
              title="My Product Sales Performance"
              subtitle="Your product-wise sales distribution for the selected period"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ExpenseByCategoryChart
              expenses={myEmployeeExpenses}
              title="My Expense Categories"
            />
          </motion.div>
        </div>

        {/* ========================================================= */}
        {/* 6. DAILY SALES TIMELINE AREA CHART                        */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-[32px] p-6 sm:p-8 border border-stone-200/80 shadow-[0_4px_25px_rgba(11,36,20,0.04)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-0.5">
                Timeline Trend
              </span>
              <h3 className="text-xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                My Daily Sales Performance
              </h3>
            </div>
            <span className="text-xs font-bold text-[#143822] bg-[#143822]/10 px-3 py-1 rounded-full w-fit">
              Revenue Volume (INR)
            </span>
          </div>

          <div className="h-[280px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSalesmanSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#143822" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0efe9" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#78716c", fontSize: 12, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#78716c", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      backgroundColor: "#111",
                      color: "#fff",
                      border: "1px solid rgba(212,175,55,0.3)",
                      boxShadow: "0 15px 35px -5px rgba(0,0,0,0.3)",
                      padding: "10px 14px",
                      fontWeight: "bold"
                    }}
                    itemStyle={{ color: "#D4AF37" }}
                    formatter={(val) => [`₹${Number(val).toLocaleString("en-IN")}`, "Sales"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="Sales"
                    stroke="#143822"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSalesmanSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400 font-medium">
                No chronological sales data recorded for this period
              </div>
            )}
          </div>
        </motion.div>

        {/* ========================================================= */}
        {/* 7. QUICK ACTION CALLOUT BANNER                            */}
        {/* ========================================================= */}
        <div className="rounded-[32px] p-6 sm:p-8 bg-gradient-to-br from-[#0B2414] via-[#12361E] to-[#1C4B2B] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-[#D4AF37]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37] blur-[100px] opacity-15 pointer-events-none" />
          <div className="relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] bg-white/10 px-3 py-1 rounded-full border border-white/10 inline-block mb-2">
              Fast Operations
            </span>
            <h3 className="text-2xl font-bold text-white font-['Poppins']">
              Quick Sales Operations
            </h3>
            <p className="text-emerald-100/75 text-sm mt-1 max-w-xl">
              Issue an instant customer sales invoice or record an operational field expense.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto relative z-10">
            <Link
              to="/invoice"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-[#111] hover:bg-[#E5C358] px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              <FiFileText className="text-lg" /> Create Invoice
            </Link>
            <Link
              to="/expenses"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider backdrop-blur-md active:scale-95 transition-all"
            >
              <FiPlus className="text-lg" /> Add Expense
            </Link>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 8. RECENT SALES INVOICES LEDGER                           */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-[32px] p-6 sm:p-8 border border-stone-200/80 shadow-[0_4px_25px_rgba(11,36,20,0.04)]"
        >
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-0.5">
                Transactions Ledger
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight font-['Poppins']">
                My Recent Sales Invoices
              </h3>
            </div>
            <span className="text-xs font-bold text-[#143822] bg-[#143822]/10 border border-[#143822]/20 px-3.5 py-1.5 rounded-2xl">
              {filteredInvoices?.length || 0} Invoice(s)
            </span>
          </div>

          <ReportTable sales={filteredInvoices} hideSearch />
        </motion.div>
      </div>
    </div>
  );
}
