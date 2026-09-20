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
  FiTrendingUp
} from "react-icons/fi";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import SalesCard from "../components/SalesCard";
import DateFilter from "../components/DateFilter";
import ReportTable from "../components/ReportTable";
import ExpenseByCategoryChart from "../components/ExpenseByCategoryChart";
import { calculateMetrics, filterItemsByDate } from "../utils/calculations";


const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function EmployeeDashboard() {
  const { currentUser, userProfile } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filterType, setFilterType] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const employeeName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Employee";

  // Fetch Data
  useEffect(() => {
    const invRef = ref(db, "invoices");
    const expRef = ref(db, "expenses");

    const unsubInv = onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInvoices(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setInvoices([]);
      }
    });

    const unsubExp = onValue(expRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExpenses(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setExpenses([]);
      }
    });

    return () => {
      unsubInv();
      unsubExp();
    };
  }, []);

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
    // 1. Date filter
    const dateFilteredInvoices = filterItemsByDate(invoices, filterType, startDate, endDate, "createdAt", "invoiceDate");
    const dateFilteredExpenses = filterItemsByDate(expenses, filterType, startDate, endDate, "createdAt", "expenseDate");

    // 2. Metrics filtered strictly by logged-in employee UID
    const metrics = calculateMetrics({
      invoices: dateFilteredInvoices,
      expenses: dateFilteredExpenses,
      employeeUid: currentUser?.uid
    });

    // 3. Build chronological sales chart data
    const dateGroupMap = {};
    metrics.invoices.forEach(inv => {
      let saleDateVal = inv.createdAt || 0;
      if (inv.invoiceDate) {
        const [y, m, d] = inv.invoiceDate.split('-');
        saleDateVal = new Date(y, m - 1, d).getTime();
      }
      const dateStr = new Date(saleDateVal).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateGroupMap[dateStr]) dateGroupMap[dateStr] = { date: dateStr, rawDate: saleDateVal, Sales: 0 };
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
    const dateFilteredExp = filterItemsByDate(expenses, filterType, startDate, endDate, "createdAt", "expenseDate");
    if (currentUser?.uid) {
      return dateFilteredExp.filter(exp => exp.createdByUid === currentUser.uid);
    }
    return dateFilteredExp;
  }, [expenses, filterType, startDate, endDate, currentUser]);


  const cards = [

    { title: "My Sales", amount: `₹${totalTurnover}`, icon: <FiDollarSign />, color: "text-[#D4AF37]" },
    { title: "My Revenue (Paid)", amount: `₹${totalTurnover - pendingTotal}`, icon: <FiBriefcase />, color: "text-green-500" },
    { title: "My Expenses", amount: `₹${totalExpenses}`, icon: <FiTrendingDown />, color: "text-red-500" },
    { title: "Balance", amount: `₹${profit}`, icon: <FiBriefcase />, color: profit >= 0 ? "text-green-500" : "text-red-500" },
    { title: "My Invoices", amount: totalInvoices, icon: <FiFileText /> },
    { title: "My Items Sold", amount: totalItemsSold, icon: <FiPackage /> },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-10 font-['Inter']">
      {/* Header & Date Filter */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">
            Welcome, {employeeName}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">Dashboard • Personal Sales & Contribution</p>
        </div>
        <DateFilter filterType={filterType} setFilterType={setFilterType} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
      </motion.div>

      {/* Top 6 KPI Cards Grid */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mb-10">
        {cards.map((card, index) => (
          <motion.div variants={itemVariants} key={index}>
            <SalesCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* Performance Section: Top Product & Avg Invoice */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        {/* Top Product Handled by Employee */}
        <div className="lg:col-span-8 bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#111] font-['Poppins']">My Top Selling Product</h2>
            <span className="px-3 py-1 bg-[#D4AF37] text-[#111] font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1">
              <FiAward /> Best Seller
            </span>
          </div>

          {topProduct ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#111] text-[#D4AF37] rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0">
                  <FiPackage />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{topProduct.category}</span>
                  <h3 className="text-2xl font-bold text-[#111] font-['Poppins']">{topProduct.name}</h3>
                </div>
              </div>

              <div className="flex gap-8 sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-gray-100 pt-4 sm:pt-0">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Qty Sold</span>
                  <span className="text-2xl font-bold text-[#111]">{topProduct.qty}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Revenue</span>
                  <span className="text-2xl font-bold text-[#D4AF37]">₹{topProduct.revenue}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 font-medium">No sales recorded for this period</div>
          )}
        </div>

        {/* Avg Invoice Value Badge */}
        <div className="lg:col-span-4 bg-[#111] text-white rounded-[30px] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] blur-[70px] opacity-30 rounded-full" />
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-2">Average Order Value</span>
            <h3 className="text-4xl font-bold text-[#D4AF37] tracking-tight font-['Poppins']">₹{averageInvoiceValue}</h3>
            <p className="text-xs text-gray-400 mt-2 font-medium">Average sales value per invoice generated</p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-green-400 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md w-fit">
            <FiTrendingUp /> Calculated across {totalInvoices} invoice(s)
          </div>
        </div>
      </motion.div>

      {/* My Expense Categories Breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <ExpenseByCategoryChart expenses={myEmployeeExpenses} title="My Expense Categories" />
      </motion.div>

      {/* Sales Chart Over Time */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8 mb-10">

        <h3 className="text-xl font-bold text-[#111] mb-6 tracking-tight font-['Poppins']">My Sales Performance</h3>
        <div className="h-[300px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEmployeeSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="Sales" stroke="#111" strokeWidth={3} fillOpacity={1} fill="url(#colorEmployeeSales)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 font-medium">No chart data available for selected period</div>
          )}
        </div>
      </motion.div>

      {/* Quick Action Operations & Recent Invoices */}
      <div className="grid grid-cols-1 gap-6 mb-10">
        <div className="bg-[#111] rounded-[30px] p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <h3 className="text-2xl font-bold text-white font-['Poppins']">Quick Sales Actions</h3>
            <p className="text-gray-400 text-sm mt-1">Generate a new luxury invoice or add operational expense</p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <Link to="/invoice" className="flex-1 sm:flex-none bg-[#D4AF37] text-[#111] hover:bg-yellow-400 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg transition-all">
              <FiFileText className="text-lg" /> Create Invoice
            </Link>
            <Link to="/expenses" className="flex-1 sm:flex-none bg-white/10 border border-white/10 text-white hover:bg-white/20 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all">
              <FiPlus className="text-lg" /> Add Expense
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Employee Sales Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h3 className="text-2xl font-bold text-[#111] mb-6 tracking-tight font-['Poppins']">My Recent Sales Invoices</h3>
        <ReportTable sales={filteredInvoices} hideSearch />
      </motion.div>
    </div>
  );
}
