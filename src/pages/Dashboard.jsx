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

import SalesCard from "../components/SalesCard";
import ReportTable from "../components/ReportTable";
import DateFilter from "../components/DateFilter";
import BySalesmanChart from "../components/BySalesmanChart";
import { calculateTopSalesEmployees, filterItemsByDate } from "../utils/calculations";


const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

const Dashboard = () => {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterType, setFilterType] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dateFilteredInvoices = useMemo(() => {
    return filterItemsByDate(invoices, filterType, startDate, endDate, "createdAt", "invoiceDate");
  }, [invoices, filterType, startDate, endDate]);


  useEffect(() => {
    const invoicesRef = ref(db, "invoices");
    const expRef = ref(db, "expenses");
    const empRef = ref(db, "employees");

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

    return () => {
      unsubInv();
      unsubExp();
      unsubEmp();
    };
  }, []);

  // Centralized Data Calculations
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

      const prods = invoice.products || [];
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
    return calculateTopSalesEmployees(invoices, expenses, employees).slice(0, 5);
  }, [invoices, expenses, employees]);

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

  const cards = [
    {
      title: "Total Turnover",
      amount: `₹${totalTurnover}`,
      icon: <FiDollarSign />,
      color: "text-[#D4AF37]",
      percentage: formattedGrowth !== "0.0%" ? formattedGrowth : null,
    },
    {
      title: "Pending Payments",
      amount: `₹${pendingTotal}`,
      icon: <FiClock />,
      color: "text-orange-500",
    },
    {
      title: "Total Items Sold",
      amount: totalItemsSold,
      icon: <FiPackage />,
    },
    {
      title: "Total Employees",
      amount: employees.length,
      icon: <FiUsers />,
      color: "text-emerald-500",
      percentage: `${employees.filter(e => e.status === "active").length} Active`
    },
    {
      title: "Total Expenses",
      amount: `₹${totalExpenses}`,
      icon: <FiTrendingDown />,
      color: "text-red-500",
    },
    {
      title: "Balance",
      amount: `₹${balance}`,
      icon: <FiBriefcase />,
      color: balance >= 0 ? "text-green-500" : "text-red-500",
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
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
        {cards.map((card, index) => (
          <motion.div variants={itemVariants} key={index}>
            <SalesCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* By Salesman Chart Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <BySalesmanChart invoices={dateFilteredInvoices} employees={employees} />
      </motion.div>


      {/* Top Selling Product & Top Sales Employees Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        {/* Top Selling Product */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="lg:col-span-7 flex flex-col justify-between">
          <h2 className="text-2xl font-bold text-[#111] tracking-tight mb-6 font-['Poppins']">Top Selling Product</h2>
          {topProduct ? (
            <motion.div variants={itemVariants} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden group hover:border-[#D4AF37]/50 transition-colors flex-1">
              <div className="absolute top-0 right-0 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-bl-2xl shadow-sm z-10 flex items-center gap-1.5 bg-[#D4AF37] text-[#111]">
                <FiAward className="text-sm" /> Best Seller
              </div>
              <div className="flex items-center gap-4 sm:gap-6 mt-4 sm:mt-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#111] rounded-[18px] sm:rounded-[20px] flex items-center justify-center text-[#D4AF37] shadow-lg shrink-0">
                  <FiPackage className="text-xl sm:text-2xl" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{topProduct.category}</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#111] tracking-tight font-['Poppins']">{topProduct.name}</h3>
                </div>
              </div>
              <div className="flex gap-8 sm:gap-10 sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-gray-100 pt-4 sm:pt-0">
                <div className="flex-1 sm:flex-none">
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Quantity Sold</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#111]">{topProduct.qty}</p>
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
                <div key={emp.uid} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100 hover:border-[#D4AF37]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#111] text-[#D4AF37] font-bold text-sm flex items-center justify-center shrink-0">
                      {emp.name?.charAt(0).toUpperCase() || "E"}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#111] text-sm">{emp.name}</h4>
                      <span className="text-[10px] text-gray-400 font-medium block">
                        {emp.invoicesCount} invoices • {emp.itemsSold} pcs
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#D4AF37] text-sm block">₹{emp.revenue}</span>
                    <span className="text-[10px] text-green-600 font-semibold">₹{emp.profit} profit</span>
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
        <motion.div variants={itemVariants} className="bg-[#111] rounded-[30px] p-8 text-white relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#D4AF37] blur-[80px] opacity-30 rounded-full"></div>

          <div className="relative z-10 text-center sm:text-left">
            <h3 className="text-2xl text-[#ffff] font-bold tracking-tight font-['Poppins']">Quick Operations</h3>
            <p className="text-gray-400 mt-1 font-medium">Instantly access billing and staff tools</p>
          </div>
          <div className="flex flex-wrap gap-4 relative z-10 w-full sm:w-auto">
            <Link to="/invoice" className="flex-1 sm:flex-none bg-[#D4AF37] text-[#111] hover:bg-yellow-400 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold shadow-lg">
              <FiFileText className="text-lg" /> Create Invoice
            </Link>
            <Link to="/employees" className="flex-1 sm:flex-none bg-white/10 border border-white/10 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold">
              <FiUsers className="text-lg" /> Manage Employees
            </Link>
            <Link to="/add-product" className="flex-1 sm:flex-none bg-white/10 border border-white/10 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold">
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