import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { ref, onValue, update } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import EmployeeAvatar from "../components/EmployeeAvatar";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  isSameDay,
  isSameWeek,
  isSameMonth,
  isWithinInterval,
  subDays,
  subWeeks,
  subMonths,
  startOfDay,
  endOfDay
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import {
  FiDollarSign,
  FiPackage,
  FiTrendingDown,
  FiBriefcase,
  FiImage,
  FiAlertTriangle,
  FiChevronDown,
  FiClock,
  FiFileText,
  FiPrinter,
  FiDownload,
  FiPieChart,
  FiUser,
  FiArrowRight,
  FiX,
  FiFilter,
  FiTrendingUp,
  FiLayers,
  FiArrowUpRight,
  FiCheckCircle,
  FiEye
} from "react-icons/fi";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReportTable from "../components/ReportTable";
import DateFilter from "../components/DateFilter";
import SalesCard from "../components/SalesCard";
import BySalesmanChart from "../components/BySalesmanChart";
import ExpenseByCategoryChart from "../components/ExpenseByCategoryChart";
import ExpenseBySalesmanChart from "../components/ExpenseBySalesmanChart";
import ProductSalesChart from "../components/ProductSalesChart";
import {
  calculateEmployeePerformance,
  calculateEmployeeStockReconciliation,
  calculatePeriodEmployeeStockReport
} from "../utils/calculations";

const CHART_COLORS = ['#D4AF37', '#111111', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#3B82F6'];

const safeNum = (val) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (val) => safeNum(val).toLocaleString('en-IN');
const formatNumber = (val) => safeNum(val).toLocaleString('en-IN');

const Reports = () => {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockIssues, setStockIssues] = useState([]);
  const [filterType, setFilterType] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedEmployeeUid, setSelectedEmployeeUid] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showEarningsDetails, setShowEarningsDetails] = useState(false);

  // Admin Employee Sales & Stock Report Specific Filters & State
  const [reportFilterType, setReportFilterType] = useState("month");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [selectedDetailEmployee, setSelectedDetailEmployee] = useState(null);
  const [selectedDrilldownProduct, setSelectedDrilldownProduct] = useState(null);

  const navigate = useNavigate();

  // Fetch Data from Firebase
  useEffect(() => {
    const salesRef = ref(db, "invoices");
    const expRef = ref(db, "expenses");
    const earnRef = ref(db, "earnings");
    const prodRef = ref(db, "products");
    const empRef = ref(db, "employees");
    const catRef = ref(db, "expenseCategories");
    const stockIssuesRef = ref(db, "employeeStockIssues");

    const unsubSales = onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSales(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setSales([]);
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

    const unsubEarn = onValue(earnRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEarnings(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setEarnings([]);
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

    const unsubEmp = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEmployees(Object.keys(data).map((key) => ({ uid: key, ...data[key] })));
      } else {
        setEmployees([]);
      }
    });

    const unsubCat = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategories(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setCategories([]);
      }
    });

    const unsubIssues = onValue(stockIssuesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStockIssues(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setStockIssues([]);
      }
    });

    return () => {
      unsubSales();
      unsubExp();
      unsubEarn();
      unsubProd();
      unsubEmp();
      unsubCat();
      unsubIssues();
    };
  }, []);

  // Compute Dynamic Admin Employee Sales & Stock Report
  const adminStockReport = useMemo(() => {
    return calculatePeriodEmployeeStockReport({
      stockIssues,
      invoices: sales,
      expenses,
      employeesList: employees,
      productsList: products,
      filterType: reportFilterType,
      startDate: reportStartDate,
      endDate: reportEndDate
    });
  }, [stockIssues, sales, expenses, employees, products, reportFilterType, reportStartDate, reportEndDate]);

  // Sync currently viewed detail employee when report recalculates
  const currentDetailEmployee = useMemo(() => {
    if (!selectedDetailEmployee) return null;
    const empList = adminStockReport?.employeesReport || [];
    return empList.find(e => e.uid === selectedDetailEmployee.uid) || selectedDetailEmployee;
  }, [selectedDetailEmployee, adminStockReport]);

  // Centralized Filter and Calculation Logic for General Analytics
  const {
    filteredSales,
    filteredExpenses,
    filteredEarnings,
    turnover,
    turnoverGrowth,
    expenseTotal,
    expenseGrowth,
    balance,
    balanceGrowth,
    actualSalesCash,
    validEarningsCash,
    otherIncomeTotal,
    gstRefundTotal,
    creditRecoveryTotal,
    capitalReceivedTotal,
    totalEarningsReceipts,
    pendingAmount,
    pendingCount,
    totalItems,
    chartData,
    topProducts
  } = useMemo(() => {
    const now = new Date();
    let currentSales = [];
    let prevSales = [];
    let currentExp = [];
    let prevExp = [];
    let currentEarn = [];
    let prevEarn = [];

    const filterData = (dataList, type = "sale") => {
      dataList.forEach((item) => {
        let dateVal = item.createdAt || Date.now();
        if (type === "sale" && item.invoiceDate && typeof item.invoiceDate === "string" && item.invoiceDate.includes("-")) {
          const [year, month, day] = item.invoiceDate.split('-');
          if (year && month && day) dateVal = new Date(year, month - 1, day).getTime();
        } else if (type === "expense" && item.expenseDate && typeof item.expenseDate === "string" && item.expenseDate.includes("-")) {
          const [year, month, day] = item.expenseDate.split('-');
          if (year && month && day) dateVal = new Date(year, month - 1, day).getTime();
        } else if (type === "earning" && item.transactionDate && typeof item.transactionDate === "string" && item.transactionDate.includes("-")) {
          const [year, month, day] = item.transactionDate.split('-');
          if (year && month && day) dateVal = new Date(year, month - 1, day).getTime();
        }

        const d = new Date(dateVal);
        let isCurrent = false;
        let isPrev = false;

        if (filterType === "today") {
          isCurrent = isSameDay(d, now);
          isPrev = isSameDay(d, subDays(now, 1));
        } else if (filterType === "week") {
          isCurrent = isSameWeek(d, now);
          isPrev = isSameWeek(d, subWeeks(now, 1));
        } else if (filterType === "month") {
          isCurrent = isSameMonth(d, now);
          isPrev = isSameMonth(d, subMonths(now, 1));
        } else if (filterType === "custom" && startDate && endDate) {
          const start = startOfDay(new Date(startDate));
          const end = endOfDay(new Date(endDate));
          isCurrent = isWithinInterval(d, { start, end });
        } else if (filterType === "custom") {
          isCurrent = true;
        }

        // Payment status filter applies only to sales invoices
        if (type === "sale" && paymentFilter !== "all") {
          const status = item.paymentStatus || "paid";
          if (status !== paymentFilter) {
            isCurrent = false;
            isPrev = false;
          }
        }

        // Employee filter applies to all records created by that employee
        if (selectedEmployeeUid) {
          if (item.createdByUid !== selectedEmployeeUid) {
            isCurrent = false;
            isPrev = false;
          }
        }

        if (isCurrent) {
          if (type === "sale") currentSales.push(item);
          else if (type === "expense") currentExp.push(item);
          else if (type === "earning") currentEarn.push(item);
        }
        if (isPrev) {
          if (type === "sale") prevSales.push(item);
          else if (type === "expense") prevExp.push(item);
          else if (type === "earning") prevEarn.push(item);
        }
      });
    };

    filterData(sales, "sale");
    filterData(expenses, "expense");
    filterData(earnings, "earning");

    const getRevenue = (arr) => arr.reduce((sum, s) => sum + safeNum(s.totalAmount), 0);
    const getExp = (arr) => arr.reduce((sum, e) => sum + safeNum(e.amount), 0);

    const currentTurnover = getRevenue(currentSales);
    const prevTurnover = getRevenue(prevSales);
    const currentExpenseTotal = getExp(currentExp);
    const prevExpenseTotal = getExp(prevExp);

    let tGrowth = 0;
    if (prevTurnover > 0) tGrowth = ((currentTurnover - prevTurnover) / prevTurnover) * 100;
    else if (currentTurnover > 0) tGrowth = 100;

    let eGrowth = 0;
    if (prevExpenseTotal > 0) eGrowth = ((currentExpenseTotal - prevExpenseTotal) / prevExpenseTotal) * 100;
    else if (currentExpenseTotal > 0) eGrowth = 100;

    let items = 0;
    let pTotal = 0;
    let pCount = 0;
    const productMap = {};
    const dateGroupMap = {};

    currentSales.forEach((sale) => {
      let saleDateVal = sale.createdAt || 0;
      if (sale.invoiceDate && typeof sale.invoiceDate === "string" && sale.invoiceDate.includes("-")) {
        const [year, month, day] = sale.invoiceDate.split('-');
        if (year && month && day) saleDateVal = new Date(year, month - 1, day).getTime();
      }

      const dateStr = new Date(saleDateVal).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateGroupMap[dateStr]) dateGroupMap[dateStr] = { date: dateStr, rawDate: saleDateVal, Revenue: 0 };
      dateGroupMap[dateStr].Revenue += safeNum(sale.totalAmount);

      const status = sale.paymentStatus || "paid";
      if (status === "pending") {
        pTotal += safeNum(sale.totalAmount);
        pCount += 1;
      }

      const saleProds = Array.isArray(sale.products) ? sale.products : (sale.products && typeof sale.products === 'object' ? Object.values(sale.products) : []);
      saleProds.forEach(p => {
        const qty = safeNum(p.quantity);
        items += qty;

        if (p.productId || p.productName) {
          const pId = p.productId || p.productName;
          if (!productMap[pId]) {
            productMap[pId] = { id: pId, name: p.productName, category: p.category, qty: 0, revenue: 0 };
          }
          productMap[pId].qty += qty;
          productMap[pId].revenue += safeNum(p.total);
        }
      });
    });

    // Actual Sales Cash Received: Unpaid (pending) invoices are NOT cash received
    const actualSalesCash = currentTurnover - pTotal;

    // Previous period pending sales for previous net balance calculation
    let prevPTotal = 0;
    prevSales.forEach((sale) => {
      const status = sale.paymentStatus || "paid";
      if (status === "pending") {
        prevPTotal += safeNum(sale.totalAmount);
      }
    });
    const prevActualSalesCash = prevTurnover - prevPTotal;

    // Categorization and Genuine Cash Inflows from Earnings:
    // Reference accounting logic from Main Admin Dashboard (Dashboard.jsx)
    let otherInc = 0;
    let gstRef = 0;
    let creditRec = 0;
    let capital = 0;
    let validEarningsCash = 0;

    currentEarn.forEach((item) => {
      const amt = safeNum(item.amount);
      if (amt <= 0) return;

      const catName = (item.categoryName || "").toLowerCase().trim();
      const desc = (item.description || "").toLowerCase().trim();
      const cls = item.classification || "";

      // 1. Capital Received (strictly isolated in its own category, never counted as sales or operating income)
      if (cls === "CAPITAL_INVESTMENT" || catName.includes("capital") || catName.includes("investment")) {
        capital += amt;
      }
      // 2. GST Refund
      else if (
        catName.includes("gst") ||
        catName.includes("refund") ||
        cls === "REFUND_RECOVERY" ||
        desc.includes("gst refund")
      ) {
        gstRef += amt;
      }
      // 3. Credit Recovery
      else if (
        cls === "CREDIT_RECOVERY" ||
        catName.includes("credit") ||
        catName.includes("recovery")
      ) {
        creditRec += amt;
      }
      // 4. Other Income
      else {
        otherInc += amt;
      }

      // Genuine Cash Inflows from Earnings:
      // To prevent double counting, do NOT add receipts that were linked to settle an invoice,
      // as those invoice payments are already counted in actualSalesCash.
      if (!(item.linkedInfo && item.linkedInfo.type === "invoice")) {
        validEarningsCash += amt;
      }
    });

    let prevValidEarningsCash = 0;
    prevEarn.forEach((item) => {
      const amt = safeNum(item.amount);
      if (amt <= 0) return;
      if (!(item.linkedInfo && item.linkedInfo.type === "invoice")) {
        prevValidEarningsCash += amt;
      }
    });

    const totalEarningsReceipts = capital + gstRef + creditRec + otherInc;

    // Reconciled Net Balance = Actual Sales Cash + Valid Earnings Cash - Actual Expenses Paid
    const netBalance = actualSalesCash + validEarningsCash - currentExpenseTotal;
    const prevBalance = prevActualSalesCash + prevValidEarningsCash - prevExpenseTotal;

    let bGrowth = 0;
    if (prevBalance !== 0) {
      bGrowth = ((netBalance - prevBalance) / Math.abs(prevBalance)) * 100;
    } else if (netBalance > 0) {
      bGrowth = 100;
    }

    const top3 = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 3).map(tp => {
      const dbP = products.find(prod => prod.id === tp.id);
      return { ...tp, image: dbP?.image || null };
    });

    const chartArr = Object.values(dateGroupMap).sort((a, b) => a.rawDate - b.rawDate);

    return {
      filteredSales: currentSales,
      filteredExpenses: currentExp,
      filteredEarnings: currentEarn,
      turnover: currentTurnover,
      turnoverGrowth: filterType === "custom" ? null : (tGrowth > 0 ? `+${tGrowth.toFixed(1)}%` : `${tGrowth.toFixed(1)}%`),
      expenseTotal: currentExpenseTotal,
      expenseGrowth: filterType === "custom" ? null : (eGrowth > 0 ? `+${eGrowth.toFixed(1)}%` : `${eGrowth.toFixed(1)}%`),
      balance: netBalance,
      balanceGrowth: filterType === "custom" ? null : (bGrowth > 0 ? `+${bGrowth.toFixed(1)}%` : `${bGrowth.toFixed(1)}%`),
      actualSalesCash,
      validEarningsCash,
      otherIncomeTotal: otherInc,
      gstRefundTotal: gstRef,
      creditRecoveryTotal: creditRec,
      capitalReceivedTotal: capital,
      totalEarningsReceipts,
      pendingAmount: pTotal,
      pendingCount: pCount,
      totalItems: items,
      chartData: chartArr,
      topProducts: top3
    };
  }, [sales, expenses, earnings, products, filterType, startDate, endDate, paymentFilter, selectedEmployeeUid]);

  // Unified Employee Performance Matrix
  const employeePerformanceList = useMemo(() => {
    return calculateEmployeePerformance(filteredSales, filteredExpenses, employees);
  }, [filteredSales, filteredExpenses, employees]);

  // Employee Stock & Sales Reconciliation Matrix
  const stockReconciliationData = useMemo(() => {
    return calculateEmployeeStockReconciliation({
      stockIssues,
      invoices: filteredSales,
      employeesList: employees,
      productsList: products,
      filterType: "all",
      targetEmployeeUid: selectedEmployeeUid || null
    });
  }, [stockIssues, filteredSales, employees, products, selectedEmployeeUid]);

  // Advanced Product Sales Analytics
  const productAnalytics = useMemo(() => {
    const targetId = selectedProductId || (topProducts.length > 0 ? topProducts[0].id : (products.length > 0 ? products[0].id : null));
    if (!targetId) return null;

    const dbProduct = products.find(p => p.id === targetId);
    if (!dbProduct) return null;

    let totalQty = 0;
    let totalRev = 0;
    let lastSold = 0;
    const chartMap = {};

    filteredSales.forEach(sale => {
      let saleDateVal = sale.createdAt || 0;
      if (sale.invoiceDate && typeof sale.invoiceDate === "string" && sale.invoiceDate.includes("-")) {
        const [year, month, day] = sale.invoiceDate.split('-');
        saleDateVal = new Date(year, month - 1, day).getTime();
      }
      const saleDate = new Date(saleDateVal);
      const dateStr = saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!chartMap[dateStr]) {
        chartMap[dateStr] = { date: dateStr, rawDate: saleDateVal, Qty: 0, Revenue: 0 };
      }

      const saleProds = Array.isArray(sale.products) ? sale.products : (sale.products && typeof sale.products === 'object' ? Object.values(sale.products) : []);
      const pMatch = saleProds.find(p => p.productId === targetId);
      if (pMatch) {
        const qty = Number(pMatch.quantity) || 0;
        const rev = Number(pMatch.total || 0);
        totalQty += qty;
        totalRev += rev;
        chartMap[dateStr].Qty += qty;
        chartMap[dateStr].Revenue += rev;
        if (saleDateVal > lastSold) {
          lastSold = saleDateVal;
        }
      }
    });

    let badge = { text: "Low Sales", icon: "📦", color: "bg-gray-100 text-gray-600" };
    let trend = "Low Demand";

    if (totalQty >= 20) {
      badge = { text: "Best Seller", icon: "🔥", color: "bg-orange-100 text-orange-600" };
      trend = "High Demand";
    } else if (totalQty >= 10) {
      badge = { text: "High Demand", icon: "📈", color: "bg-green-100 text-green-600" };
      trend = "High Demand";
    } else if (totalQty >= 5) {
      badge = { text: "Trending", icon: "⭐", color: "bg-[#D4AF37]/20 text-[#D4AF37]" };
      trend = "Medium Demand";
    }

    const chartData = Object.values(chartMap).sort((a, b) => a.rawDate - b.rawDate);

    return { ...dbProduct, totalQty, totalRev, lastSoldDate: lastSold ? new Date(lastSold).toLocaleDateString() : "Never", badge, trend, chartData };
  }, [filteredSales, products, selectedProductId, topProducts]);

  // Handlers
  const handleEdit = (invoiceId) => {
    const invoiceToEdit = sales.find(s => s.id === invoiceId);
    if (invoiceToEdit) {
      navigate("/invoice", { state: { editInvoice: invoiceToEdit } });
    }
  };

  const handleDelete = (invoiceId) => {
    setDeletingInvoiceId(invoiceId);
  };

  const confirmDelete = async () => {
    if (!deletingInvoiceId) return;
    try {
      const invToDelete = sales.find(s => s.id === deletingInvoiceId);
      const updates = {};
      updates[`invoices/${deletingInvoiceId}`] = null;

      const delProds = Array.isArray(invToDelete.products) ? invToDelete.products : (invToDelete.products && typeof invToDelete.products === 'object' ? Object.values(invToDelete.products) : []);
      if (invToDelete && delProds.length > 0) {
        delProds.forEach(p => {
          if (p.productId) {
            const dbProd = products.find(prod => prod.id === p.productId);
            if (dbProd) {
              updates[`products/${p.productId}/stock`] = Number(dbProd.stock || 0) + Number(p.quantity || 0);
            }
          }
        });
      }
      await update(ref(db), updates);
      toast.success("Invoice deleted successfully", { style: { borderRadius: '14px', background: '#111', color: '#fff' } });
    } catch {
      toast.error("Failed to delete invoice");
    }
    setDeletingInvoiceId(null);
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await update(ref(db), {
        [`invoices/${invoiceId}/paymentStatus`]: "paid"
      });
      toast.success("Invoice marked as Paid!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Export PDF Handler
  const handleDownloadPDF = async (elementId, filename = "report.pdf") => {
    const input = document.getElementById(elementId);
    if (!input) return;
    try {
      const toastId = toast.loading("Generating PDF report...");
      const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(filename);
      toast.success("PDF Downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF generation failed", err);
      toast.error("Failed to generate PDF");
    }
  };

  // Export CSV Handler
  const handleExportCSV = (reportObj, periodLabel = "Period") => {
    if (!reportObj || !reportObj.employeesReport) return;
    let csvStr = "data:text/csv;charset=utf-8,";
    csvStr += "Employee Name,Product Name,Opening Stock,Stock Issued,Total Available,Sold Quantity,Remaining Stock,Sales %,Revenue (INR),Expenses (INR),Net Balance (INR)\n";

    reportObj.employeesReport.forEach(emp => {
      if (emp.productsList && emp.productsList.length > 0) {
        emp.productsList.forEach(p => {
          csvStr += `"${emp.name}","${p.productName}",${p.openingStock},${p.issuedDuringPeriod},${p.totalAvailable},${p.soldDuringPeriod},${p.remainingStock},"${p.salesPercentageFormatted}",${p.revenue},${emp.expenses},${emp.netBalance}\n`;
        });
      } else {
        csvStr += `"${emp.name}","N/A",${emp.openingStock},${emp.issuedDuringPeriod},${emp.totalAvailable},${emp.soldDuringPeriod},${emp.remainingStock},"${emp.salesPercentageFormatted}",${emp.revenue},${emp.expenses},${emp.netBalance}\n`;
      }
    });

    const encodedUri = encodeURI(csvStr);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Employee_Sales_And_Stock_Report_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Report Downloaded!");
  };

  // Print Handler
  const handlePrint = (elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bahara Accounts - Employee Sales & Stock Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
            h1, h2, h3 { margin: 0 0 10px 0; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #eee; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f9fafb; font-weight: bold; color: #4b5563; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .card { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; background: #fafafa; }
            .card-title { font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase; }
            .card-val { font-size: 18px; font-weight: bold; margin-top: 4px; }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      <Toaster />

      {/* Header & Filters */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight">Business Analytics</h1>
          <p className="text-gray-500 mt-2 font-medium">Detailed financial and product performance</p>
        </div>
        <div className="w-full md:w-auto flex flex-col sm:flex-row flex-wrap items-center gap-4">
          {/* Employee Filter */}
          <div className="relative group w-full sm:w-auto min-w-[200px]">
            <select
              value={selectedEmployeeUid}
              onChange={(e) => setSelectedEmployeeUid(e.target.value)}
              className="w-full bg-white border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-[20px] text-xs font-bold text-[#111] p-3 appearance-none cursor-pointer outline-none transition-all shadow-sm"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.uid} value={emp.uid}>{emp.name || emp.email}</option>
              ))}
            </select>
            <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#D4AF37] transition-colors" />
          </div>

          <div className="bg-white premium-shadow border border-gray-100 p-1.5 rounded-[20px] flex items-center h-full w-full sm:w-auto">
            {['all', 'paid', 'pending'].map(f => (
              <button
                key={f}
                onClick={() => setPaymentFilter(f)}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${paymentFilter === f ? 'bg-[#111] text-[#D4AF37] shadow-md' : 'text-gray-400 hover:text-[#111]'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <DateFilter filterType={filterType} setFilterType={setFilterType} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <SalesCard
          title="Total Turnover"
          amount={`₹${formatCurrency(turnover)}`}
          icon={<FiDollarSign />}
          color="text-[#D4AF37]"
          percentage={turnoverGrowth}
          subtext="Product Sales Only"
        />
        <SalesCard
          title="Pending Amount"
          amount={`₹${formatCurrency(pendingAmount)}`}
          icon={<FiClock />}
          color="text-orange-500"
          subtext="Uncollected sales receivables"
        />
        <SalesCard
          title="Pending Bills"
          amount={formatNumber(pendingCount)}
          icon={<FiFileText />}
          color="text-orange-500"
          subtext={`${pendingCount} unpaid invoice(s)`}
        />
        <SalesCard
          title="Total Items Sold"
          amount={formatNumber(totalItems)}
          icon={<FiPackage />}
          color="text-cyan-600"
          subtext="Physical product units sold"
        />
        <SalesCard
          title="Total Expenses"
          amount={`₹${formatCurrency(expenseTotal)}`}
          icon={<FiTrendingDown />}
          color="text-red-500"
          percentage={expenseGrowth}
          subtext="Period operating outflows"
        />
        <div className={`text-white premium-shadow border rounded-[30px] p-7 relative overflow-hidden group transition-all duration-300 flex flex-col justify-between cursor-default ${
          balance >= 0
            ? "bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] border-emerald-400/40 shadow-2xl"
            : "bg-gradient-to-br from-[#881337] via-[#9f1239] to-[#be123c] border-rose-400/40 shadow-2xl"
        }`}>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D4AF37] blur-[70px] opacity-25 rounded-full group-hover:opacity-40 transition-opacity pointer-events-none"></div>
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest">Reconciled Net Balance</span>
                {balanceGrowth && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md ${balance >= 0 ? "bg-white/20 text-white" : "bg-black/30 text-rose-200"}`}>
                    {balanceGrowth}
                  </span>
                )}
              </div>
              <h2 className={`text-3xl font-bold tracking-tight font-['Poppins'] ${balance >= 0 ? 'text-white' : 'text-rose-100'}`}>
                ₹{formatCurrency(balance)}
              </h2>
            </div>
            <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-2xl border backdrop-blur-md ${
              balance >= 0 ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/30" : "bg-rose-400/20 text-rose-200 border-rose-400/30"
            }`}>
              <FiBriefcase />
            </div>
          </div>
          <div className="relative z-10 pt-4 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/80 font-medium">
            <span>Inflows: Sales ₹{formatCurrency(actualSalesCash)} + Earn ₹{formatCurrency(validEarningsCash)}</span>
            <span>Exp: ₹{formatCurrency(expenseTotal)}</span>
          </div>
        </div>
      </motion.div>

      {/* 2. CONCISE EARNINGS & INFLOW BREAKDOWN BANNER */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-10 bg-gradient-to-br from-[#111111] via-[#1a1c2e] to-[#16213e] border border-white/10 rounded-[32px] p-7 shadow-2xl relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37] blur-[100px] opacity-15 rounded-full pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3.5">
            <span className="p-3 rounded-2xl bg-white/10 text-[#D4AF37] text-xl shadow-lg border border-white/10 backdrop-blur-md">
              <FiTrendingUp />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white font-['Poppins']">Earnings & Inflows Reconciliation</h3>
                <span className="text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-[#D4AF37]/30">
                  {filteredEarnings.length} {filteredEarnings.length === 1 ? 'Receipt' : 'Receipts'}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium mt-0.5">
                Secondary income, tax refunds, credit recoveries & capital inflows for active reporting period
              </p>
            </div>
          </div>

          {filteredEarnings.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEarningsDetails(prev => !prev)}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <FiEye className="text-sm" />
              <span>{showEarningsDetails ? "Hide Period Ledger" : "View Period Ledger"}</span>
              <FiChevronDown className={`text-xs transition-transform duration-200 ${showEarningsDetails ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 text-center relative z-10">
          {/* Other Income Total */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-emerald-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Other Income</span>
            <span className="text-base font-bold text-emerald-300 font-['Poppins']">
              ₹{formatCurrency(otherIncomeTotal)}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">Secondary & misc</span>
          </div>

          {/* GST Refund Total */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-amber-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">GST Refund</span>
            <span className="text-base font-bold text-amber-300 font-['Poppins']">
              ₹{formatCurrency(gstRefundTotal)}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">Tax refunds</span>
          </div>

          {/* Credit Recovery Total */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-blue-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Credit Recovery</span>
            <span className="text-base font-bold text-blue-300 font-['Poppins']">
              ₹{formatCurrency(creditRecoveryTotal)}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">Receivables collected</span>
          </div>

          {/* Capital Received Total */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-purple-400/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Capital Received</span>
            <span className="text-base font-bold text-purple-300 font-['Poppins']">
              ₹{formatCurrency(capitalReceivedTotal)}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">Owner funding inflow</span>
          </div>

          {/* Total Earnings Receipts */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm hover:border-[#D4AF37]/50 transition-all">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Inflows</span>
            <span className="text-base font-bold text-[#D4AF37] font-['Poppins']">
              ₹{formatCurrency(totalEarningsReceipts)}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">All period inflows</span>
          </div>

          {/* Reconciled Net Balance */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-sm transition-all ${
            balance >= 0 ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-rose-500/20 border-rose-500/40 text-rose-300"
          }`}>
            <span className="text-[9px] font-bold uppercase tracking-widest block mb-1">Net Balance</span>
            <span className="text-base font-bold font-['Poppins']">
              ₹{formatCurrency(balance)}
            </span>
            <span className="text-[10px] block mt-0.5 font-medium opacity-90">
              {balance >= 0 ? "🟢 Cash Positive" : "🔴 Deficit"}
            </span>
          </div>
        </div>

        {/* Collapsible Period Earnings Ledger */}
        <AnimatePresence>
          {showEarningsDetails && filteredEarnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 pt-5 border-t border-white/10 relative z-10"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Period Earnings Transactions</h4>
                <span className="text-[11px] text-gray-400">Total: ₹{formatCurrency(totalEarningsReceipts)}</span>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Received Into</th>
                      <th className="p-3">Classification</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {filteredEarnings.map((earn) => (
                      <tr key={earn.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 whitespace-nowrap text-gray-300 font-medium">
                          {earn.transactionDate || (earn.createdAt ? new Date(earn.createdAt).toLocaleDateString() : "N/A")}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {earn.categoryName || "General Earning"}
                        </td>
                        <td className="p-3 text-gray-300 max-w-[200px] truncate" title={earn.description}>
                          {earn.description || "—"}
                          {earn.linkedInfo && (
                            <span className="ml-1.5 text-[9px] bg-white/10 text-[#D4AF37] px-1.5 py-0.5 rounded">
                              {earn.linkedInfo.type === "invoice" ? `Inv #${earn.linkedInfo.reference}` : `Exp #${earn.linkedInfo.reference}`}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-400">
                          {earn.receivedInto || earn.paymentMethod || "Bank"}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            earn.classification === "CAPITAL_INVESTMENT"
                              ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
                              : earn.classification === "REFUND_RECOVERY"
                              ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                              : earn.classification === "CREDIT_RECOVERY"
                              ? "bg-blue-400/20 text-blue-300 border border-blue-400/30"
                              : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                          }`}>
                            {earn.classification || "OTHER_INCOME"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-[#D4AF37] font-['Poppins']">
                          ₹{formatCurrency(earn.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ========================================================================= */}
      {/* 1. DEDICATED ADMIN SECTION: EMPLOYEE SALES & STOCK REPORT                 */}
      {/* ========================================================================= */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-8 mb-10 overflow-hidden"
          id="admin-sales-stock-report-main"
        >
          {/* Section Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#D4AF37]/20 text-[#D4AF37] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Admin Analytics
                </span>
                <span className="text-xs text-gray-400 font-semibold">• Live Continuous Ledger</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#111] font-['Poppins'] tracking-tight">
                Employee Sales & Stock Report
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
                Comprehensive breakdown of employee product allocations, opening stock, sales, remaining inventory & revenue balances.
              </p>
            </div>

            {/* Filter Buttons & Export Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Period Filter Pills */}
              <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-200 flex items-center gap-1">
                {[
                  { id: "today", label: "Today" },
                  { id: "week", label: "This Week" },
                  { id: "month", label: "This Month" },
                  { id: "custom", label: "Custom Range" }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setReportFilterType(f.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reportFilterType === f.id
                        ? "bg-[#111] text-[#D4AF37] shadow-md"
                        : "text-gray-500 hover:text-[#111] hover:bg-gray-200/60"
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons: CSV, PDF, Print */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportCSV(adminStockReport, reportFilterType)}
                  className="bg-gray-100 hover:bg-gray-200 text-[#111] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Export CSV"
                >
                  <FiDownload /> CSV
                </button>
                <button
                  onClick={() => handleDownloadPDF("admin-sales-stock-report-main", `Employee_Sales_Stock_${reportFilterType}.pdf`)}
                  className="bg-gray-100 hover:bg-gray-200 text-[#111] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Download PDF"
                >
                  <FiDownload /> PDF
                </button>
                <button
                  onClick={() => handlePrint("admin-sales-stock-report-main")}
                  className="bg-[#111] hover:bg-black text-[#D4AF37] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Print Report"
                >
                  <FiPrinter /> Print
                </button>
              </div>
            </div>
          </div>

          {/* Custom Date Range Selector Inputs */}
          {reportFilterType === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="py-4 border-b border-gray-100 flex flex-wrap items-center gap-4 bg-amber-50/50 p-4 rounded-2xl mt-4"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <FiFilter /> Select Date Range:
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">From:</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#111] outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">To:</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#111] outline-none focus:border-[#D4AF37]"
                />
              </div>
            </motion.div>
          )}

          {/* Period Summary Metric Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 my-6">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Opening Stock</span>
              <span className="text-lg font-bold text-[#111] font-['Poppins']">{adminStockReport?.summary?.openingStock || 0}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Stock Issued</span>
              <span className="text-lg font-bold text-blue-600 font-['Poppins']">{adminStockReport?.summary?.stockIssued || 0}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Available</span>
              <span className="text-lg font-bold text-[#111] font-['Poppins']">{adminStockReport?.summary?.totalAvailable || 0}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Sold</span>
              <span className="text-lg font-bold text-[#D4AF37] font-['Poppins']">{adminStockReport?.summary?.totalSold || 0}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Remaining Stock</span>
              <span className="text-lg font-bold text-amber-700 font-['Poppins']">{adminStockReport?.summary?.remainingStock || 0}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Revenue</span>
              <span className="text-lg font-bold text-green-600 font-['Poppins']">₹{formatCurrency(adminStockReport?.summary?.totalRevenue)}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Expenses</span>
              <span className="text-lg font-bold text-red-500 font-['Poppins']">₹{formatCurrency(adminStockReport?.summary?.totalExpenses)}</span>
            </div>
            <div className="bg-[#111] text-[#D4AF37] rounded-2xl p-3.5 text-center shadow-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Net Balance</span>
              <span className="text-lg font-bold font-['Poppins']">₹{formatCurrency(adminStockReport?.summary?.netBalance)}</span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4 text-right">Products Issued</th>
                  <th className="p-4 text-right">Products Sold</th>
                  <th className="p-4 text-right">Remaining Stock</th>
                  <th className="p-4 text-right">Revenue</th>
                  <th className="p-4 text-center">Sales %</th>
                  <th className="p-4 text-right">Expenses</th>
                  <th className="p-4 text-right">Net Balance</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {adminStockReport?.employeesReport?.length > 0 ? (
                  adminStockReport.employeesReport.map((emp) => (
                    <tr
                      key={emp.uid}
                      onClick={() => setSelectedDetailEmployee(emp)}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-bold font-['Poppins']">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar emp={emp} className="w-9 h-9" textClassName="text-xs" />
                          <div>
                            <span className="text-sm font-bold text-[#111] group-hover:text-[#D4AF37] transition-colors">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-normal block">
                              {emp.productsList?.length || 0} product line(s)
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-700 font-bold">{emp.issuedDuringPeriod}</td>
                      <td className="p-4 text-right text-[#D4AF37] font-bold">{emp.soldDuringPeriod}</td>
                      <td className="p-4 text-right text-amber-800 font-bold">{emp.remainingStock}</td>
                      <td className="p-4 text-right text-green-600 font-bold">₹{formatCurrency(emp.revenue)}</td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-xs text-[#111]">{emp.salesPercentageFormatted}</span>
                          <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-[#D4AF37] h-full rounded-full"
                              style={{ width: `${Math.min(100, emp.salesPercentage)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right text-red-500 font-bold">₹{formatCurrency(emp.expenses)}</td>
                      <td className="p-4 text-right font-bold">
                        <span className={`px-2.5 py-1 rounded-full text-xs ${emp.netBalance >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                          ₹{formatCurrency(emp.netBalance)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailEmployee(emp);
                          }}
                          className="bg-[#111] text-[#D4AF37] hover:bg-black text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 mx-auto"
                        >
                          Details <FiArrowRight className="text-xs" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400 font-medium">
                      No active employee sales or stock records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout View */}
          <div className="md:hidden grid grid-cols-1 gap-4">
            {adminStockReport?.employeesReport?.length > 0 ? (
              adminStockReport.employeesReport.map((emp) => (
                <div
                  key={emp.uid}
                  onClick={() => setSelectedDetailEmployee(emp)}
                  className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 cursor-pointer hover:border-[#D4AF37] transition-all"
                >
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200/60">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar emp={emp} className="w-10 h-10" textClassName="text-sm" />
                      <div>
                        <h4 className="font-bold text-sm text-[#111]">{emp.name}</h4>
                        <span className="text-[10px] text-gray-500">{emp.productsList?.length || 0} products assigned</span>
                      </div>
                    </div>
                    <span className="bg-[#111] text-[#D4AF37] px-2.5 py-1 rounded-lg text-xs font-bold">
                      {emp.salesPercentageFormatted}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-white p-2 rounded-xl border border-gray-100">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Issued</span>
                      <span className="text-xs font-bold text-gray-800">{emp.issuedDuringPeriod}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-gray-100">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Sold</span>
                      <span className="text-xs font-bold text-[#D4AF37]">{emp.soldDuringPeriod}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-gray-100">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block">Remaining</span>
                      <span className="text-xs font-bold text-amber-800">{emp.remainingStock}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Revenue</span>
                      <span className="font-bold text-green-600">₹{formatCurrency(emp.revenue)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Expenses</span>
                      <span className="font-bold text-red-500">₹{formatCurrency(emp.expenses)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold">Net Balance</span>
                      <span className="font-bold text-[#111]">₹{formatCurrency(emp.netBalance)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-400 font-medium">
                No active employee records for this period.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 2. DETAILED EMPLOYEE REPORT MODAL / DRAWER                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {currentDetailEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[30px] w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative border border-gray-100"
              id="detailed-employee-report-modal"
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <EmployeeAvatar emp={currentDetailEmployee} className="w-14 h-14" textClassName="text-xl" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-black px-2.5 py-0.5 rounded-full">
                      Detailed Employee Report
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#111] font-['Poppins'] mt-1">
                      {currentDetailEmployee.name} — Sales & Stock Report
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Period Filter: <span className="font-bold text-[#111] uppercase">{reportFilterType}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportCSV({ employeesReport: [currentDetailEmployee] }, currentDetailEmployee.name)}
                    className="bg-gray-100 hover:bg-gray-200 text-[#111] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <FiDownload /> CSV
                  </button>
                  <button
                    onClick={() => handleDownloadPDF("detailed-employee-report-modal", `${currentDetailEmployee.name}_Sales_Report.pdf`)}
                    className="bg-gray-100 hover:bg-gray-200 text-[#111] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <FiDownload /> PDF
                  </button>
                  <button
                    onClick={() => handlePrint("detailed-employee-report-modal")}
                    className="bg-[#111] hover:bg-black text-[#D4AF37] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <FiPrinter /> Print
                  </button>
                  <button
                    onClick={() => setSelectedDetailEmployee(null)}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors ml-2"
                  >
                    <FiX className="text-xl" />
                  </button>
                </div>
              </div>

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 my-6">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Opening Stock</span>
                  <span className="text-base font-bold text-[#111]">{currentDetailEmployee?.openingStock || 0}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Stock Issued</span>
                  <span className="text-base font-bold text-blue-600">{currentDetailEmployee?.issuedDuringPeriod || 0}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Available</span>
                  <span className="text-base font-bold text-[#111]">{currentDetailEmployee?.totalAvailable || 0}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Sold</span>
                  <span className="text-base font-bold text-[#D4AF37]">{currentDetailEmployee?.soldDuringPeriod || 0}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Remaining Stock</span>
                  <span className="text-base font-bold text-amber-800">{currentDetailEmployee?.remainingStock || 0}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Revenue</span>
                  <span className="text-base font-bold text-green-600">₹{formatCurrency(currentDetailEmployee?.revenue)}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Expenses</span>
                  <span className="text-base font-bold text-red-500">₹{formatCurrency(currentDetailEmployee?.expenses)}</span>
                </div>
                <div className="bg-[#111] text-[#D4AF37] rounded-2xl p-3 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Net Balance</span>
                  <span className="text-base font-bold">₹{formatCurrency(currentDetailEmployee?.netBalance)}</span>
                </div>
              </div>

              {/* Product Sales Graph / Visual Distribution */}
              {(() => {
                const detailSoldProducts = (currentDetailEmployee?.productsList || []).filter(
                  (p) => (Number(p.soldDuringPeriod) || 0) > 0
                );
                const detailTotalSoldUnits = detailSoldProducts.reduce(
                  (sum, p) => sum + (Number(p.soldDuringPeriod) || 0),
                  0
                );
                const highestSoldProduct = detailSoldProducts.length > 0 ? detailSoldProducts[0] : null;
                const highestProductImage = highestSoldProduct
                  ? (highestSoldProduct.image ||
                      products.find(
                        (p) =>
                          (highestSoldProduct.productId && p.id === highestSoldProduct.productId) ||
                          (p.productName &&
                            p.productName.trim().toLowerCase() ===
                              (highestSoldProduct.productName || "").trim().toLowerCase()) ||
                          (p.name &&
                            p.name.trim().toLowerCase() ===
                              (highestSoldProduct.productName || "").trim().toLowerCase())
                      )?.image ||
                      null)
                  : null;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
                    {/* 1. Upgraded Product Sales Distribution */}
                    <div className="lg:col-span-8 bg-gray-50/70 border border-gray-100 rounded-3xl p-6 flex flex-col justify-between">
                      <div>
                        {/* Section Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-[#111] font-['Poppins'] flex items-center gap-2">
                              <FiPieChart className="text-[#D4AF37]" /> Product Sales Distribution
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                              Breakdown of product sales volume, revenue generation & unit share
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-gray-600 bg-white border border-gray-200/80 px-3 py-1 rounded-full self-start sm:self-auto shadow-xs">
                            Unit Sales Share
                          </span>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                              Total Units Sold
                            </span>
                            <span className="text-base font-bold text-[#111] font-['Poppins']">
                              {formatNumber(currentDetailEmployee?.soldDuringPeriod || 0)}{" "}
                              <span className="text-xs font-semibold text-gray-400">units</span>
                            </span>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                              Total Sales Revenue
                            </span>
                            <span className="text-base font-bold text-green-600 font-['Poppins']">
                              ₹{formatCurrency(currentDetailEmployee?.revenue)}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 bg-white border border-gray-100 rounded-2xl p-3 shadow-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                              Active Products Sold
                            </span>
                            <span className="text-base font-bold text-[#D4AF37] font-['Poppins']">
                              {detailSoldProducts.length}{" "}
                              <span className="text-xs font-semibold text-gray-400">
                                product{detailSoldProducts.length === 1 ? "" : "s"}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Chart + Legend View */}
                        {detailSoldProducts.length > 0 ? (
                          <div className="flex flex-col md:flex-row items-center gap-6 mt-2">
                            {/* Donut Chart */}
                            <div className="h-[220px] w-full md:w-5/12 min-w-0 flex items-center justify-center relative overflow-hidden">
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                  <Pie
                                    data={detailSoldProducts}
                                    dataKey="soldDuringPeriod"
                                    nameKey="productName"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={4}
                                  >
                                    {detailSoldProducts.map((entry, index) => (
                                      <Cell
                                        key={`cell-${entry.productId || index}`}
                                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                                      />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    formatter={(val, name, props) => {
                                      const p = props.payload;
                                      const qty = Number(val) || 0;
                                      const share =
                                        detailTotalSoldUnits > 0
                                          ? ((qty / detailTotalSoldUnits) * 100).toFixed(1)
                                          : "0.0";
                                      return [
                                        `${qty} pcs (${share}% share) • ₹${formatCurrency(p.revenue)}`,
                                        p.productName || "Product"
                                      ];
                                    }}
                                    contentStyle={{
                                      borderRadius: "14px",
                                      border: "1px solid rgba(255,255,255,0.1)",
                                      backgroundColor: "#111",
                                      color: "#fff",
                                      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                                      padding: "10px 14px"
                                    }}
                                    itemStyle={{ color: "#D4AF37", fontWeight: "bold", fontSize: "12px" }}
                                    labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Compact Legend Table */}
                            <div className="w-full md:w-7/12 flex flex-col justify-center">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between pb-1.5 border-b border-gray-200/70">
                                <span>Product</span>
                                <div className="flex items-center gap-3 sm:gap-4">
                                  <span className="w-12 text-right">Sold</span>
                                  <span className="w-16 sm:w-20 text-right">Revenue</span>
                                  <span className="w-12 text-center">Share</span>
                                </div>
                              </div>
                              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-100/60">
                                {detailSoldProducts.map((p, idx) => {
                                  const color = CHART_COLORS[idx % CHART_COLORS.length];
                                  const qty = Number(p.soldDuringPeriod) || 0;
                                  const rev = Number(p.revenue) || 0;
                                  const share =
                                    detailTotalSoldUnits > 0
                                      ? ((qty / detailTotalSoldUnits) * 100).toFixed(1)
                                      : "0.0";
                                  return (
                                    <div
                                      key={p.productId || idx}
                                      className="pt-1.5 first:pt-0 flex items-center justify-between text-xs py-0.5 hover:bg-white/80 rounded-lg px-1 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                          style={{ backgroundColor: color }}
                                        />
                                        <span
                                          className="font-bold text-[#111] truncate"
                                          title={p.productName}
                                        >
                                          {p.productName || "Product"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                                        <span className="font-semibold text-gray-600 w-12 text-right">
                                          {qty} pcs
                                        </span>
                                        <span className="font-bold text-green-600 w-16 sm:w-20 text-right">
                                          ₹{formatCurrency(rev)}
                                        </span>
                                        <span className="font-bold text-[#111] bg-white border border-gray-200/80 px-1.5 py-0.5 rounded-md text-[10px] w-12 text-center shadow-2xs">
                                          {share}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-[200px] flex flex-col items-center justify-center text-gray-400 text-xs font-semibold gap-2">
                            <FiPieChart className="text-3xl text-gray-300" />
                            <span>No product sales recorded yet for this period.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Improved Highest Sold Product Summary Card */}
                    <div className="lg:col-span-4 bg-[#111] text-white rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden border border-white/5">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] blur-[70px] opacity-20 rounded-full pointer-events-none"></div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="bg-[#D4AF37] text-[#111] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Highest Sold Product
                          </span>
                          {highestSoldProduct && (
                            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">
                              Top Seller
                            </span>
                          )}
                        </div>

                        {/* Product Name in Crisp White Bold Font */}
                        <h4 className="text-xl sm:text-2xl font-bold font-['Poppins'] text-white tracking-tight mt-3 line-clamp-2">
                          {highestSoldProduct ? highestSoldProduct.productName : "None"}
                        </h4>

                        {/* Actual Product Image Display */}
                        <div className="my-3 w-full h-36 sm:h-44 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center p-3 relative overflow-hidden group">
                          {highestProductImage ? (
                            <img
                              src={highestProductImage}
                              alt={highestSoldProduct?.productName || "Product"}
                              className="w-full h-full object-contain filter drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.parentElement?.querySelector(
                                  ".highest-prod-fallback"
                                );
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`highest-prod-fallback w-full h-full flex flex-col items-center justify-center gap-2 ${
                              highestProductImage ? "hidden" : "flex"
                            }`}
                          >
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37]">
                              <FiPackage className="text-2xl" />
                            </div>
                            <span className="text-[11px] font-medium text-gray-400">
                              {highestSoldProduct ? "No Image Available" : "No Sales Logged"}
                            </span>
                          </div>
                        </div>

                        {/* Sold Quantity & Revenue Metrics */}
                        <p className="text-xs text-gray-300 mt-1 font-medium">
                          {highestSoldProduct
                            ? `${highestSoldProduct.soldDuringPeriod} pcs sold • ₹${formatCurrency(
                                highestSoldProduct.revenue
                              )}`
                            : "No sales logged for this employee."}
                        </p>
                      </div>

                      {/* Overall Sales % Footer */}
                      <div className="pt-4 border-t border-white/10 mt-3 flex items-center justify-between text-xs">
                        <div className="flex flex-col">
                          <span className="text-gray-400 font-medium">Overall Sales %:</span>
                          <span className="text-[10px] text-gray-500">Employee performance</span>
                        </div>
                        <span className="text-[#D4AF37] font-bold text-xl font-['Poppins']">
                          {currentDetailEmployee?.salesPercentageFormatted || "0%"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Product Breakdown Table */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden mt-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-[#111] text-sm font-['Poppins']">Assigned Product Stock & Sales Matrix</h3>
                  <span className="text-xs text-gray-400 font-medium">Click any row for product drill-down</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="p-4">Product</th>
                        <th className="p-4 text-right">Opening Stock</th>
                        <th className="p-4 text-right">Stock Issued</th>
                        <th className="p-4 text-right">Total Available</th>
                        <th className="p-4 text-right">Sold</th>
                        <th className="p-4 text-right">Remaining</th>
                        <th className="p-4 text-center">Sales %</th>
                        <th className="p-4 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                      {currentDetailEmployee.productsList.length > 0 ? (
                        currentDetailEmployee.productsList.map((prod) => (
                          <tr
                            key={prod.productId}
                            onClick={() => setSelectedDrilldownProduct(prod)}
                            className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                          >
                            <td className="p-4 font-bold font-['Poppins']">
                              <div className="flex items-center gap-3">
                                {prod.image ? (
                                  <img src={prod.image} alt={prod.productName} className="w-8 h-8 rounded-xl object-cover border border-gray-200" />
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                                    <FiPackage />
                                  </div>
                                )}
                                <div>
                                  <span className="text-sm font-bold text-[#111]">{prod.productName}</span>
                                  <span className="text-[10px] text-gray-400 font-normal block">{prod.category}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-gray-700 font-bold">{prod.openingStock}</td>
                            <td className="p-4 text-right text-blue-600 font-bold">{prod.issuedDuringPeriod}</td>
                            <td className="p-4 text-right text-gray-900 font-bold">{prod.totalAvailable}</td>
                            <td className="p-4 text-right text-[#D4AF37] font-bold">{prod.soldDuringPeriod}</td>
                            <td className="p-4 text-right text-amber-800 font-bold">{prod.remainingStock}</td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-xs text-[#111]">{prod.salesPercentageFormatted}</span>
                                <div className="w-14 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                                  <div
                                    className="bg-[#D4AF37] h-full rounded-full"
                                    style={{ width: `${Math.min(100, prod.salesPercentage)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-green-600 font-bold">₹{formatCurrency(prod.revenue)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-gray-400 font-medium">
                            {currentDetailEmployee.totalAvailable > 0
                              ? "Stock available — no sales recorded yet."
                              : "No sales recorded for this period."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. PRODUCT DRILL-DOWN MODAL: EMPLOYEE → PRODUCT                          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedDrilldownProduct && currentDetailEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[30px] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative border border-gray-100"
            >
              <button
                onClick={() => setSelectedDrilldownProduct(null)}
                className="absolute top-6 right-6 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
              >
                <FiX className="text-lg" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">{currentDetailEmployee.name}</span>
                <span className="text-xs text-gray-300">→</span>
                <span className="text-xs font-bold text-[#D4AF37] uppercase">Product Analytics</span>
              </div>

              <div className="flex items-center gap-4 my-4 pb-4 border-b border-gray-100">
                {selectedDrilldownProduct.image ? (
                  <img src={selectedDrilldownProduct.image} alt={selectedDrilldownProduct.productName} className="w-16 h-16 rounded-2xl object-cover border border-gray-200 shadow-sm" />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-2xl">
                    <FiPackage />
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-bold text-[#111] font-['Poppins']">{selectedDrilldownProduct.productName}</h3>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full inline-block mt-1">
                    {selectedDrilldownProduct.category}
                  </span>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-6">
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Opening Stock</span>
                  <span className="text-sm font-bold text-[#111]">{selectedDrilldownProduct.openingStock}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Stock Issued</span>
                  <span className="text-sm font-bold text-blue-600">{selectedDrilldownProduct.issuedDuringPeriod}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Available</span>
                  <span className="text-sm font-bold text-[#111]">{selectedDrilldownProduct.totalAvailable}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Sold Quantity</span>
                  <span className="text-sm font-bold text-[#D4AF37]">{selectedDrilldownProduct.soldDuringPeriod}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Remaining Stock</span>
                  <span className="text-sm font-bold text-amber-800">{selectedDrilldownProduct.remainingStock}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Sales Percentage</span>
                  <span className="text-sm font-bold text-green-600">{selectedDrilldownProduct.salesPercentageFormatted}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Avg Selling Rate</span>
                  <span className="text-sm font-bold text-[#111]">₹{selectedDrilldownProduct.avgSellingRate}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Invoice Count</span>
                  <span className="text-sm font-bold text-[#111]">{selectedDrilldownProduct.invoiceCount} bill(s)</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">First Sale Date</span>
                  <span className="text-xs font-bold text-gray-700">
                    {selectedDrilldownProduct.firstSaleDate ? new Date(selectedDrilldownProduct.firstSaleDate).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Last Sale Date</span>
                  <span className="text-xs font-bold text-gray-700">
                    {selectedDrilldownProduct.lastSaleDate ? new Date(selectedDrilldownProduct.lastSaleDate).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>

              <div className="bg-[#111] text-[#D4AF37] p-4 rounded-2xl text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Total Product Revenue</span>
                <span className="text-2xl font-bold font-['Poppins']">₹{formatCurrency(selectedDrilldownProduct.revenue)}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comprehensive Reports Analytics */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-8 mb-10">

        {/* 1. Revenue Trend Area Chart */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8 w-full">
          <h3 className="text-xl font-bold text-[#111] mb-6 tracking-tight font-['Poppins']">Revenue Trend</h3>
          {chartData.length > 0 ? (
            <div className="h-[300px] w-full min-w-0 relative overflow-hidden">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTurnover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#111' }} />
                  <Area type="monotone" dataKey="Revenue" stroke="#111" strokeWidth={3} fillOpacity={1} fill="url(#colorTurnover)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] w-full flex flex-col items-center justify-center text-center text-gray-400">
              <FiTrendingDown className="text-4xl mb-2 text-gray-200" />
              <p className="font-semibold text-xs text-gray-500">No revenue data available for the selected period.</p>
            </div>
          )}
        </div>

        {/* 2. By Salesman Revenue Donut Chart */}
        <BySalesmanChart invoices={filteredSales} employees={employees} />

        {/* 3. Expense by Category Donut Chart */}
        <ExpenseByCategoryChart expenses={filteredExpenses} categoriesList={categories} />

        {/* 4. Product Sales Performance Donut Chart */}
        <ProductSalesChart invoices={filteredSales} productsList={products} />

        {/* 5. Expense by Salesman / Creator Donut Chart */}
        <ExpenseBySalesmanChart expenses={filteredExpenses} employees={employees} />

        {/* 6. Unified Employee Performance Matrix Table */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Employee & Salesman Performance</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              Net profit contribution matrix combining sales revenue generated vs expenses created for the selected period
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Salesperson / Employee</th>
                  <th className="p-4 sm:p-5 text-right">Sales Revenue</th>
                  <th className="p-4 sm:p-5 text-right">Expenses Created</th>
                  <th className="p-4 sm:p-5 text-right">Net Profit / Contribution</th>
                  <th className="p-4 sm:p-5 text-center">Invoices / Pcs</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {employeePerformanceList.length > 0 ? (
                  employeePerformanceList.map((emp) => (
                    <tr key={emp.uid} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 sm:p-5 font-bold font-['Poppins']">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar emp={emp} className="w-8 h-8" textClassName="text-xs" />
                          <div>
                            <span className="text-sm font-bold text-[#111]">{emp.name}</span>
                            <span className="text-[10px] text-gray-400 font-normal block capitalize">{emp.isAdmin ? "Admin" : "Employee"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-green-600 font-['Poppins']">
                        ₹{(emp.revenue || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-red-500 font-['Poppins']">
                        ₹{(emp.expenses || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold font-['Poppins']">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${emp.profit >= 0 ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                          ₹{(emp.profit || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="p-4 sm:p-5 text-center text-gray-500">
                        {emp.invoicesCount} inv ({emp.itemsSold} pcs)
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 font-medium">
                      No employee performance records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7. Employee Stock & Sales Reconciliation Summary Table */}
        <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Employee Stock & Reconciliation Summary</h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                Continuous stock ledger tracking issued qty, sold qty, balance, stock value, sales value & utilization % per employee
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-100 text-xs font-bold text-gray-600">
              <FiPackage className="text-[#D4AF37]" />
              <span>Issued: {stockReconciliationData.overallIssued} | Sold: {stockReconciliationData.overallSold} | Balance: {stockReconciliationData.overallBalance} | Util: {stockReconciliationData.overallStockUtilizationFormatted}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 sm:p-5">Employee Name</th>
                  <th className="p-4 sm:p-5 text-right">Issued Qty</th>
                  <th className="p-4 sm:p-5 text-right">Sold Qty</th>
                  <th className="p-4 sm:p-5 text-right">Balance Qty</th>
                  <th className="p-4 sm:p-5 text-right">Stock Value</th>
                  <th className="p-4 sm:p-5 text-right">Sales Value</th>
                  <th className="p-4 sm:p-5 text-center">Sold % / Utilization</th>
                  <th className="p-4 sm:p-5 text-center">Reconciliation Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                {stockReconciliationData.employees.length > 0 ? (
                  stockReconciliationData.employees.map((emp) => (
                    <tr key={emp.uid} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 sm:p-5 font-bold font-['Poppins']">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar emp={emp} className="w-8 h-8" textClassName="text-xs" />
                          <div>
                            <span className="text-sm font-bold text-[#111]">{emp.name}</span>
                            <span className="text-[10px] text-gray-400 font-normal block">{emp.productList?.length || 0} product(s)</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-[#111] font-['Poppins']">
                        {formatNumber(emp.totalIssued)}
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-[#D4AF37] font-['Poppins']">
                        {formatNumber(emp.totalSold)}
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold font-['Poppins']">
                        <span className={`px-2.5 py-1 rounded-full text-xs ${safeNum(emp.currentBalance) < 0 ? "bg-red-50 text-red-600 font-bold" : "text-[#111]"}`}>
                          {formatNumber(emp.currentBalance)}
                        </span>
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-gray-700 font-['Poppins']">
                        ₹{formatCurrency(emp.totalStockValue)}
                      </td>

                      <td className="p-4 sm:p-5 text-right font-bold text-green-600 font-['Poppins']">
                        ₹{formatCurrency(emp.totalSalesValue)}
                      </td>

                      <td className="p-4 sm:p-5 text-center font-bold text-amber-700 font-['Poppins']">
                        {emp.overallUtilizationFormatted || "0%"}
                      </td>

                      <td className="p-4 sm:p-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${emp.status?.color || "bg-green-100 text-green-700 border-green-200"}`}>
                          {emp.status?.icon || "✅"} {emp.status?.label || "Normal"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 font-medium">
                      No employee stock reconciliation records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </motion.div>

      {/* Product Sales Analytics */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-[#111] tracking-tight font-['Poppins']">Product Sales Analytics</h3>
            <p className="text-gray-500 mt-1 font-medium text-sm">Track product-wise sales performance and stock movement.</p>
          </div>
          <div className="relative group min-w-[250px]">
            <select
              value={selectedProductId || (productAnalytics ? productAnalytics.id : "")}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-white border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl text-sm font-bold text-[#111] p-3.5 appearance-none cursor-pointer outline-none transition-all shadow-sm">
              <option value="" disabled>Select Product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.productName}</option>
              ))}
            </select>
            <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#D4AF37] transition-colors" />
          </div>
        </div>

        {productAnalytics ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Premium Product Card */}
            <div className="lg:col-span-4 bg-[#111] rounded-[30px] p-6 text-white relative overflow-hidden group premium-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] blur-[70px] opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
              <div className="flex items-start justify-between relative z-10 mb-6">
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${productAnalytics.badge.color}`}>
                  {productAnalytics.badge.icon} {productAnalytics.badge.text}
                </span>
                <span className="bg-white/10 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                  {productAnalytics.category}
                </span>
              </div>
              <div className="flex flex-col items-center text-center relative z-10 mb-8">
                <div className="w-28 h-28 bg-gray-50/10 rounded-[20px] mb-4 flex items-center justify-center border border-white/10 overflow-hidden shadow-xl">
                  {productAnalytics.image ? (
                    <img src={productAnalytics.image} alt={productAnalytics.productName} className="w-full h-full object-cover" />
                  ) : (
                    <FiPackage className="text-4xl text-gray-400" />
                  )}
                </div>
                <h4 className="text-xl font-bold font-['Poppins'] text-[#c4c2c2] tracking-tight mb-1 px-4">{productAnalytics.productName}</h4>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">{productAnalytics.trend}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 relative z-10 border-t border-white/10 pt-6">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Quantity Sold</p>
                  <p className="text-2xl font-bold text-white">{productAnalytics.totalQty} <span className="text-sm text-gray-500 font-medium">pcs</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Revenue</p>
                  <p className="text-2xl font-bold text-[#D4AF37]">₹{formatCurrency(productAnalytics.totalRev)}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-white/5 mt-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Last Sold Date</p>
                  <p className="text-sm font-bold text-white">{productAnalytics.lastSoldDate}</p>
                </div>
              </div>
            </div>

            {/* Product Sales Graph */}
            <div className="lg:col-span-8 bg-white premium-shadow border border-gray-100 rounded-[30px] p-8 flex flex-col">
              <h3 className="text-lg font-bold text-[#111] mb-6 tracking-tight">Product Sales Trend</h3>
              <div className="h-[300px] w-full min-w-0 relative overflow-hidden">
                {productAnalytics.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={productAnalytics.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                      <Bar yAxisId="left" dataKey="Qty" fill="#111111" radius={[4, 4, 0, 0]} barSize={30} />
                      <Bar yAxisId="right" dataKey="Revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FiTrendingDown className="text-4xl mb-3 text-gray-200" />
                    <p className="font-semibold text-sm">No sales data for this period.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-12 text-center text-gray-400 font-medium">
            <FiPackage className="text-4xl mx-auto mb-3 text-gray-300" />
            Select a product to view its analytics.
          </div>
        )}
      </motion.div>

      {/* Best Selling Products */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-10">
        <h3 className="text-2xl font-bold text-[#111] mb-6 tracking-tight font-['Poppins']">Best Selling Products</h3>
        {topProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topProducts.map((prod, index) => {
              const medals = [{ text: "Top Seller", icon: "🥇", color: "bg-[#D4AF37] text-[#111]" }, { text: "Popular", icon: "🥈", color: "bg-gray-200 text-gray-700" }, { text: "Trending", icon: "🥉", color: "bg-orange-100 text-orange-700" }];
              const badge = medals[index];
              return (
                <div key={prod.id} className="bg-white premium-shadow border border-gray-100 rounded-[24px] p-5 flex items-center gap-5 relative overflow-hidden group hover:border-[#D4AF37]/40 transition-colors">
                  <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl shadow-sm z-10 flex items-center gap-1.5 backdrop-blur-md border-b border-l border-white/20" style={{ backgroundColor: badge.color.split(' ')[0], color: badge.color.split(' ')[1] }}>
                    <span className="text-sm">{badge.icon}</span> {badge.text}
                  </div>
                  <div className="w-24 h-24 bg-gray-50 rounded-[16px] border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden group-hover:shadow-md transition-shadow">
                    {prod.image ? <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" /> : <FiImage className="text-gray-300 text-3xl" />}
                  </div>
                  <div className="flex flex-col flex-1 truncate pr-2 pt-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{prod.category}</span>
                    <h4 className="font-bold text-[#111] font-['Poppins'] text-lg truncate mb-2">{prod.name}</h4>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md">{prod.qty} Sold</span>
                      <span className="font-bold text-[#D4AF37]">₹{formatCurrency(prod.revenue)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-12 text-center text-gray-400 font-medium">
            <FiPackage className="text-4xl mx-auto mb-3 text-gray-300" />
            No product sales available in this period.
          </div>
        )}
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <ReportTable sales={filteredSales} onEdit={handleEdit} onDelete={handleDelete} onMarkPaid={handleMarkPaid} />
      </motion.div>

      {/* DELETE CONFIRMATION MODAL */}
      {deletingInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[30px] p-8 w-full max-w-md text-center shadow-2xl">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiAlertTriangle className="text-4xl" />
            </div>
            <h2 className="text-2xl font-bold text-[#111] mb-2 font-['Poppins']">Delete Invoice?</h2>
            <p className="text-gray-500 mb-8 font-medium">Are you sure you want to permanently delete this invoice record? This will accurately revert product stock quantities.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeletingInvoiceId(null)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30">Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Reports;