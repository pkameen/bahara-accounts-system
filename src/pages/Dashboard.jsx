import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { ref, onValue, update } from "firebase/database";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import {
  FiDollarSign,
  FiPackage,
  FiFileText,
  FiTrendingDown,
  FiBriefcase,
  FiPlus,
  FiAward,
  FiClock,
  FiUsers,
  FiChevronRight
} from "react-icons/fi";

import BySalesmanChart from "../components/BySalesmanChart";
import ProductSalesChart from "../components/ProductSalesChart";
import EmployeeAvatar from "../components/EmployeeAvatar";
import DateFilter from "../components/DateFilter";
import SalesCard from "../components/SalesCard";
import ReportTable from "../components/ReportTable";
import { calculateTopSalesEmployees, filterItemsByDate, calculateEmployeeStockReconciliation } from "../utils/calculations";


const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

const Dashboard = () => {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockIssues, setStockIssues] = useState([]);
  const [filterType, setFilterType] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dateFilteredInvoices = useMemo(() => {
    return filterItemsByDate(invoices, filterType, startDate, endDate, "createdAt", "invoiceDate");
  }, [invoices, filterType, startDate, endDate]);

  const dateFilteredExpenses = useMemo(() => {
    return filterItemsByDate(expenses, filterType, startDate, endDate, "createdAt", "expenseDate");
  }, [expenses, filterType, startDate, endDate]);


  useEffect(() => {
    const invoicesRef = ref(db, "invoices");
    const expRef = ref(db, "expenses");
    const empRef = ref(db, "employees");
    const prodRef = ref(db, "products");
    const issuesRef = ref(db, "employeeStockIssues");

    // Fetch Invoices
    const unsubInv = onValue(invoicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInvoices(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setInvoices([]);
      }
    });

    // Fetch Expenses
    const unsubExp = onValue(expRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExpenses(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setExpenses([]);
      }
    });

    // Fetch Employees
    const unsubEmp = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEmployees(Object.keys(data).map(key => ({ uid: key, ...data[key] })));
      } else {
        setEmployees([]);
      }
    });

    // Fetch Products
    const unsubProd = onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProducts(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setProducts([]);
      }
    });

    // Fetch Stock Issues
    const unsubIssues = onValue(issuesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStockIssues(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setStockIssues([]);
      }
    });

    return () => {
      unsubInv();
      unsubExp();
      unsubEmp();
      unsubProd();
      unsubIssues();
    };
  }, []);



  // Centralized Data Calculations (Company Overall Totals)
  const {
    totalTurnover,
    totalItemsSold,
    totalExpenses,
    pendingTotal,
    balance,
    formattedGrowth,
    topProduct
  } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let turnover = 0;
    let currentMonthTurnover = 0;
    let lastMonthTurnover = 0;
    let pendingAmt = 0;
    let items = 0;

    const productStats = {};

    invoices.forEach((invoice) => {
      let saleDateVal = invoice.createdAt || 0;
      if (invoice.invoiceDate) {
        const [year, month, day] = invoice.invoiceDate.split('-');
        saleDateVal = new Date(year, month - 1, day).getTime();
      }
      const d = new Date(saleDateVal);
      const amount = Number(invoice.totalAmount) || 0;
      turnover += amount;

      if ((invoice.paymentStatus || "paid") === "pending") {
        pendingAmt += amount;
      }

      // Monthly Growth Tracking
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        currentMonthTurnover += amount;
      } else if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) {
        lastMonthTurnover += amount;
      }

      const prods = Array.isArray(invoice.products)
        ? invoice.products
        : (invoice.products && typeof invoice.products === 'object' ? Object.values(invoice.products) : []);
      prods.forEach(p => {
        const qty = Number(p.quantity) || 0;
        items += qty;

        if (p.productId || p.productName) {
          const pId = p.productId || p.productName;
          if (!productStats[pId]) {
            productStats[pId] = {
              id: pId,
              name: p.productName,
              category: p.category || "General",
              qty: 0,
              revenue: 0
            };
          }
          productStats[pId].qty += qty;
          productStats[pId].revenue += Number(p.total || 0);
        }
      });
    });

    const expTotal = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const netBalance = turnover - expTotal;

    // Growth Formula
    let growthPercentage = 0;
    if (lastMonthTurnover > 0) {
      growthPercentage = ((currentMonthTurnover - lastMonthTurnover) / lastMonthTurnover) * 100;
    } else if (currentMonthTurnover > 0) {
      growthPercentage = 100;
    }
    const growthDisplay = growthPercentage > 0 ? `+${growthPercentage.toFixed(1)}%` : `${growthPercentage.toFixed(1)}%`;

    const topProduct = Object.values(productStats).sort((a, b) => b.qty - a.qty)[0] || null;

    return {
      totalTurnover: turnover,
      pendingTotal: pendingAmt,
      totalItemsSold: items,
      totalExpenses: expTotal,
      balance: netBalance,
      formattedGrowth: growthDisplay,
      topProduct
    };
  }, [invoices, expenses]);

  // Top Sales Employees
  const topEmployees = useMemo(() => {
    return calculateTopSalesEmployees(dateFilteredInvoices, dateFilteredExpenses, employees).slice(0, 5);
  }, [dateFilteredInvoices, dateFilteredExpenses, employees]);

  // Filter Last 5 Recent Sales
  const recentSales = useMemo(() => {
    return [...invoices]
      .sort((a, b) => {
        let dateA = a.createdAt || 0;
        if (a.invoiceDate) {
          const [y, m, d] = a.invoiceDate.split('-');
          dateA = new Date(y, m - 1, d).getTime();
        }
        let dateB = b.createdAt || 0;
        if (b.invoiceDate) {
          const [y, m, d] = b.invoiceDate.split('-');
          dateB = new Date(y, m - 1, d).getTime();
        }
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [invoices]);

  const handleMarkPaid = async (invoiceId) => {
    try {
      await update(ref(db), {
        [`invoices/${invoiceId}/paymentStatus`]: "paid"
      });
      toast.success("Payment Completed!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleEdit = (invoiceId) => {
    const invoiceToEdit = invoices.find(s => s.id === invoiceId);
    if (invoiceToEdit) {
      navigate("/invoice", { state: { editInvoice: invoiceToEdit } });
    }
  };

  // Employee Stock Reconciliation Overview
  const stockReconData = useMemo(() => {
    return calculateEmployeeStockReconciliation({
      stockIssues,
      invoices,
      employeesList: employees,
      productsList: products
    });
  }, [stockIssues, invoices, employees, products]);

  const cards = [
    {
      title: "Total Turnover",
      amount: `₹${totalTurnover.toLocaleString('en-IN')}`,
      icon: <FiDollarSign />,
      color: "text-[#D4AF37]",
      percentage: formattedGrowth !== "0.0%" ? formattedGrowth : null,
      bgClass: "bg-gradient-to-br from-[#111111] via-[#1c1917] to-[#292524] text-white border-[#D4AF37]/40 shadow-2xl",
      iconBgClass: "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30"
    },
    {
      title: "Net Balance",
      amount: `₹${balance.toLocaleString('en-IN')}`,
      icon: <FiBriefcase />,
      color: balance >= 0 ? "text-emerald-200" : "text-rose-200",
      bgClass: balance >= 0
        ? "bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] text-white border-emerald-400/40 shadow-2xl"
        : "bg-gradient-to-br from-[#881337] via-[#9f1239] to-[#be123c] text-white border-rose-400/40 shadow-2xl",
      iconBgClass: balance >= 0 ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/30" : "bg-rose-400/20 text-rose-300 border-rose-400/30",
      subtext: `Turnover - Expenses`
    },
    {
      title: "Pending Payments",
      amount: `₹${pendingTotal.toLocaleString('en-IN')}`,
      icon: <FiClock />,
      color: "text-amber-200",
      bgClass: "bg-gradient-to-br from-[#7c2d12] via-[#9a3412] to-[#c2410c] text-white border-orange-400/40 shadow-2xl",
      iconBgClass: "bg-amber-400/20 text-amber-200 border-amber-400/30"
    },
    {
      title: "Total Expenses",
      amount: `₹${totalExpenses.toLocaleString('en-IN')}`,
      icon: <FiTrendingDown />,
      color: "text-rose-200",
      bgClass: "bg-gradient-to-br from-[#881337] via-[#9f1239] to-[#be123c] text-white border-rose-400/40 shadow-2xl",
      iconBgClass: "bg-rose-400/20 text-rose-200 border-rose-400/30"
    },
    {
      title: "Total Issued",
      amount: `${stockReconData.overallIssued.toLocaleString('en-IN')} Issued`,
      icon: <FiPackage />,
      color: "text-indigo-200",
      percentage: `Bal: ${stockReconData.overallBalance.toLocaleString('en-IN')} units`,
      bgClass: "bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#311b92] text-white border-indigo-400/40 shadow-2xl",
      iconBgClass: "bg-indigo-400/20 text-indigo-200 border-indigo-400/30"
    },
    {
      title: "Stock Audit",
      amount: `${stockReconData.stockMismatchCount + stockReconData.paymentDiffCount} Mismatches`,
      icon: <FiUsers />,
      color: stockReconData.stockMismatchCount > 0 ? "text-rose-200" : "text-purple-200",
      percentage: `${stockReconData.employeesWithBalanceCount} with balance`,
      bgClass: stockReconData.stockMismatchCount > 0
        ? "bg-gradient-to-br from-[#4c0519] via-[#881337] to-[#9f1239] text-white border-rose-400/40 shadow-2xl"
        : "bg-gradient-to-br from-[#3b0764] via-[#581c87] to-[#6b21a8] text-white border-purple-400/40 shadow-2xl",
      iconBgClass: "bg-purple-400/20 text-purple-200 border-purple-400/30"
    },
    {
      title: "Total Items Sold",
      amount: totalItemsSold.toLocaleString('en-IN'),
      icon: <FiPackage />,
      color: "text-cyan-200",
      bgClass: "bg-gradient-to-br from-[#164e63] via-[#0891b2] to-[#0e7490] text-white border-cyan-400/40 shadow-2xl",
      iconBgClass: "bg-cyan-400/20 text-cyan-200 border-cyan-400/30"
    },
    {
      title: "Total Employees",
      amount: employees.length,
      icon: <FiUsers />,
      color: "text-blue-200",
      percentage: `${employees.filter(e => e.status === "active").length} Active`,
      bgClass: "bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] text-white border-blue-400/40 shadow-2xl",
      iconBgClass: "bg-blue-400/20 text-blue-200 border-blue-400/30"
    },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-10 font-['Inter']">
      <Toaster />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">Overview</h1>
          <p className="text-gray-500 mt-2 font-medium">Bahara International Accounts & Performance</p>
        </div>
        <DateFilter filterType={filterType} setFilterType={setFilterType} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
      </motion.div>

      {/* Top Stats Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {cards.map((card, index) => (
          <motion.div variants={itemVariants} key={index}>
            <SalesCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* COMPACT STOCK SUMMARY BANNER */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-10 bg-gradient-to-br from-[#111111] via-[#1a1c2e] to-[#16213e] border border-white/10 rounded-[32px] p-7 shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37] blur-[100px] opacity-15 rounded-full pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3.5">
            <span className="p-3 rounded-2xl bg-white/10 text-[#D4AF37] text-xl shadow-lg border border-white/10 backdrop-blur-md">
              <FiPackage />
            </span>
            <div>
              <h3 className="text-xl font-bold text-white font-['Poppins']">Company Inventory & Valuation Ledger</h3>
              <p className="text-xs text-gray-300 font-medium">Central warehouse stock + Staff physical allocation & reconciliation</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5 text-center relative z-10">
          {/* TOTAL COMPANY STOCK VALUE */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-[#D4AF37]/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Stock Value</span>
            <span className="text-base font-bold text-[#D4AF37] font-['Poppins']">
              ₹{(stockReconData.totalCompanyStockValue || 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* COMPANY STOCK VALUE */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-cyan-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Company Stock Value</span>
            <span className="text-base font-bold text-cyan-300 font-['Poppins']">
              ₹{(stockReconData.totalCentralStockValue || 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* EMPLOYEE STOCK VALUE */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-emerald-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Employee Stock Value</span>
            <span className="text-base font-bold text-emerald-400 font-['Poppins']">
              ₹{(stockReconData.totalEmployeeStockValue || 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* TOTAL UNITS ISSUED */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-indigo-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Issued</span>
            <span className="text-base font-bold text-indigo-300 font-['Poppins']">
              {(stockReconData.overallIssued || 0).toLocaleString('en-IN')} units
            </span>
          </div>

          {/* TOTAL UNITS SOLD */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-amber-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Sold</span>
            <span className="text-base font-bold text-amber-300 font-['Poppins']">
              {(stockReconData.overallSold || 0).toLocaleString('en-IN')} units
            </span>
          </div>

          {/* TOTAL BALANCE STOCK */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-purple-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Balance</span>
            <span className={`text-base font-bold font-['Poppins'] ${stockReconData.overallBalance < 0 ? "text-rose-400" : "text-purple-300"}`}>
              {(stockReconData.overallBalance || 0).toLocaleString('en-IN')} units
            </span>
          </div>

          {/* STOCK MISMATCHES */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-sm transition-all ${stockReconData.stockMismatchCount > 0 ? "bg-rose-500/20 border-rose-500/40 text-rose-300" : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"}`}>
            <span className="text-[9px] font-bold uppercase tracking-widest block mb-1">Stock Audit</span>
            <span className="text-base font-bold font-['Poppins']">
              {stockReconData.stockMismatchCount > 0 ? `🔴 ${stockReconData.stockMismatchCount} Alert` : "🟢 0 Clean"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* By Salesman Chart Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <BySalesmanChart invoices={dateFilteredInvoices} employees={employees} />
      </motion.div>

      {/* Product Sales Performance Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <ProductSalesChart invoices={dateFilteredInvoices} productsList={products} />
      </motion.div>

      {/* Top Selling Product & Top Sales Employees Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        {/* Top Selling Product */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="lg:col-span-7 flex flex-col justify-between">
          <h2 className="text-2xl font-bold text-[#111] tracking-tight mb-6 font-['Poppins']">Top Selling Product</h2>
          {topProduct ? (
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#111111] via-[#1c1917] to-[#2d1b4e] text-white border border-[#D4AF37]/30 rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden group hover:border-[#D4AF37]/60 shadow-2xl flex-1">
              <div className="absolute top-0 right-0 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-bl-2xl shadow-md z-10 flex items-center gap-1.5 bg-[#D4AF37] text-[#111]">
                <FiAward className="text-sm" /> Best Seller
              </div>
              <div className="flex items-center gap-4 sm:gap-6 mt-4 sm:mt-0 relative z-10">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/10 text-[#D4AF37] border border-white/10 rounded-[20px] flex items-center justify-center shadow-lg shrink-0 backdrop-blur-md">
                  <FiPackage className="text-xl sm:text-2xl" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{topProduct.category}</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Poppins']">{topProduct.name}</h3>
                </div>
              </div>
              <div className="flex gap-8 sm:gap-10 sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-white/10 pt-4 sm:pt-0 relative z-10">
                <div className="flex-1 sm:flex-none">
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Quantity Sold</p>
                  <p className="text-xl sm:text-2xl font-bold text-white">{topProduct.qty}</p>
                </div>
                <div className="flex-1 sm:flex-none">
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Revenue</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#D4AF37]">₹{topProduct.revenue}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div variants={itemVariants} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8 text-center text-gray-400 font-medium flex flex-col items-center justify-center flex-1">
              <FiPackage className="text-4xl mb-3 text-gray-300" />
              No sales available yet
            </motion.div>
          )}
        </motion.div>

        {/* Top Sales Employees Widget */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#111] tracking-tight font-['Poppins']">Top Sales Employees</h2>
            <Link to="/employees" className="text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1">
              View All <FiChevronRight />
            </Link>
          </div>
          <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 flex-1 space-y-4">
            {topEmployees.length > 0 ? (
              topEmployees.map((emp) => (
                <div key={emp.uid} className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-[#D4AF37]/40 transition-colors shadow-sm">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar emp={emp} className="w-10 h-10 border-2 border-[#D4AF37]/40" textClassName="text-xs font-bold" />
                    <div>
                      <h4 className="font-bold text-[#111] text-sm">{emp.name}</h4>
                      <span className="text-[10px] text-gray-400 font-medium block">
                        {emp.invoicesCount} invoices • {emp.itemsSold} pcs
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#D4AF37] text-sm block font-['Poppins']">₹{emp.revenue.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-green-600 font-bold">₹{emp.profit.toLocaleString('en-IN')} profit</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm font-medium">No sales attributed to employees yet</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Ops Section */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 mb-10">
        <motion.div variants={itemVariants} className="bg-gradient-to-r from-[#111111] via-[#1a1c2e] to-[#0f172a] rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-6 shadow-2xl border border-white/10">
          <div className="absolute -top-10 -right-10 w-56 h-56 bg-[#D4AF37] blur-[90px] opacity-25 rounded-full pointer-events-none"></div>

          <div className="relative z-10 text-center sm:text-left">
            <h3 className="text-2xl text-white font-bold tracking-tight font-['Poppins']">Quick Executive Operations</h3>
            <p className="text-gray-300 mt-1 font-medium text-xs">Instantly access billing, team management, and product catalog tools</p>
          </div>
          <div className="flex flex-wrap gap-4 relative z-10 w-full sm:w-auto">
            <Link to="/invoice" className="flex-1 sm:flex-none bg-[#D4AF37] text-[#111] hover:bg-yellow-400 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg cursor-pointer">
              <FiFileText className="text-lg" /> Create Invoice
            </Link>
            <Link to="/employees" className="flex-1 sm:flex-none bg-white/10 border border-white/10 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold backdrop-blur-md cursor-pointer">
              <FiUsers className="text-lg" /> Manage Employees
            </Link>
            <Link to="/add-product" className="flex-1 sm:flex-none bg-white/10 border border-white/10 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold backdrop-blur-md cursor-pointer">
              <FiPlus className="text-lg" /> Add Product
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Recent Orders Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <ReportTable sales={recentSales} hideSearch onEdit={handleEdit} onMarkPaid={handleMarkPaid} />
      </motion.div>
    </div>
  );
};

export default Dashboard;