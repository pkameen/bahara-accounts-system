import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { ref, onValue, push, update, remove } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import toast, { Toaster } from "react-hot-toast";
import {
  FiPackage,
  FiSend,
  FiSliders,
  FiPlus,
  FiLayers,
  FiSearch,
  FiCalendar,
  FiUser,
  FiX,
  FiSave,
  FiDollarSign,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiTrash2,
  FiEdit,
  FiInfo,
  FiFilter,
  FiEye
} from "react-icons/fi";
import { calculateStockLedger, calculateEmployeeStockReconciliation } from "../utils/calculations";
import TransferStockModal from "../components/TransferStockModal";
import IssueStockModal from "../components/IssueStockModal";
import EmployeeStockDetailModal from "../components/EmployeeStockDetailModal";
import EmployeeAvatar from "../components/EmployeeAvatar";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function StockManagement() {
  const navigate = useNavigate();
  const { currentUser, userProfile, role } = useAuth();
  const isAdmin = role === "admin";

  // Realtime Database state
  const [products, setProducts] = useState([]);
  const [stockIssues, setStockIssues] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState(null);
  const [reversalTargetLog, setReversalTargetLog] = useState(null);
  const [deletingTargetLog, setDeletingTargetLog] = useState(null);
  const [deletingProductTarget, setDeletingProductTarget] = useState(null);
  const [editingIssueForModal, setEditingIssueForModal] = useState(null);
  const [editingStockInId, setEditingStockInId] = useState(null);

  // Active Tab:
  // Admin: "matrix" | "company" | "employee" | "log"
  // Employee: "my_stock" | "my_log"
  const [activeTab, setActiveTab] = useState(() => (isAdmin ? "matrix" : "my_stock"));

  useEffect(() => {
    if (!isAdmin && activeTab !== "my_stock" && activeTab !== "my_log") {
      setActiveTab("my_stock");
    }
  }, [isAdmin, activeTab]);

  // Product Matrix Search & Filters
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState("all");
  const [matrixStatusFilter, setMatrixStatusFilter] = useState("all");

  // Stock Log Search & Filters
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("all");

  // Add Stock Form State
  const [addStockProduct, setAddStockProduct] = useState("");
  const [addStockQty, setAddStockQty] = useState("");
  const [addStockUnit, setAddStockUnit] = useState("KG");
  const [addStockPrice, setAddStockPrice] = useState("");
  const [addStockSource, setAddStockSource] = useState("Supplier Purchase");
  const [addStockNotes, setAddStockNotes] = useState("");
  const [addStockDate, setAddStockDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [savingAddStock, setSavingAddStock] = useState(false);

  // Stock Adjustment Form State
  const [adjProductId, setAdjProductId] = useState("");
  const [adjPhysicalQty, setAdjPhysicalQty] = useState("");
  const [adjReason, setAdjReason] = useState("Physical Audit Correction");
  const [adjNotes, setAdjNotes] = useState("");
  const [savingAdj, setSavingAdj] = useState(false);

  // Fetch Firebase Data
  useEffect(() => {
    const prodRef = ref(db, "products");
    const issuesRef = ref(db, "employeeStockIssues");
    const invRef = ref(db, "invoices");
    const empRef = ref(db, "employees");

    const unsubProd = onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      setProducts(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
      setLoading(false);
    });

    const unsubIssues = onValue(issuesRef, (snapshot) => {
      const data = snapshot.val();
      setStockIssues(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      setInvoices(data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : []);
    });

    const unsubEmp = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      setEmployees(data ? Object.keys(data).map((key) => ({ uid: key, ...data[key] })) : []);
    });

    return () => {
      unsubProd();
      unsubIssues();
      unsubInv();
      unsubEmp();
    };
  }, []);

  // Compute Single Source of Truth Stock Ledger
  const stockLedger = useMemo(() => {
    return calculateStockLedger({
      productsList: products,
      stockIssues,
      invoices,
      employeesList: employees
    });
  }, [products, stockIssues, invoices, employees]);

  const { productsList: matrixProducts, summary, transactionsLog, employeesList: reconEmployees } = stockLedger;

  // Compute full stock reconciliation object for selected employee for detail modal
  const fullSelectedEmployeeRecon = useMemo(() => {
    if (!selectedEmployeeForDetail) return null;
    const res = calculateEmployeeStockReconciliation({
      stockIssues,
      invoices,
      employeesList: employees,
      productsList: products,
      targetEmployeeUid: selectedEmployeeForDetail.uid
    });
    return res.employees.length > 0 ? res.employees[0] : selectedEmployeeForDetail;
  }, [selectedEmployeeForDetail, stockIssues, invoices, employees, products]);

  // Categories list derived from products
  const categoriesList = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Product Matrix
  const filteredMatrixProducts = useMemo(() => {
    return matrixProducts.filter((p) => {
      const matchesSearch =
        p.productName.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(matrixSearch.toLowerCase());
      const matchesCategory = matrixCategoryFilter === "all" || p.category === matrixCategoryFilter;
      const matchesStatus =
        matrixStatusFilter === "all" ||
        (matrixStatusFilter === "available" && p.totalCurrentBalance > 0) ||
        (matrixStatusFilter === "out_of_stock" && p.totalCurrentBalance <= 0);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [matrixProducts, matrixSearch, matrixCategoryFilter, matrixStatusFilter]);

  // Filtered Transaction Logs
  const filteredLogs = useMemo(() => {
    return transactionsLog.filter((log) => {
      const matchesSearch =
        log.productName.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.reference.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.userName.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.from.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.to.toLowerCase().includes(logSearch.toLowerCase());
      const matchesType = logTypeFilter === "all" || log.type === logTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactionsLog, logSearch, logTypeFilter]);

  // Calculate My Personal Stock Reconciliation for Logged-In Employee
  const myEmployeeRecon = useMemo(() => {
    if (!currentUser?.uid) return null;
    const res = calculateEmployeeStockReconciliation({
      stockIssues,
      invoices,
      employeesList: employees,
      productsList: products,
      targetEmployeeUid: currentUser.uid
    });
    return res.employees.length > 0 ? res.employees[0] : null;
  }, [stockIssues, invoices, employees, products, currentUser]);

  // Filter Stock Transaction Logs for Logged-In Employee
  const myEmployeeLogs = useMemo(() => {
    if (!currentUser?.uid) return [];
    return transactionsLog.filter((log) => {
      const isMyIssue = log.rawIssue?.employeeId === currentUser.uid ||
                        log.rawIssue?.toEmployeeId === currentUser.uid ||
                        log.rawIssue?.fromEmployeeId === currentUser.uid;
      const isMyInvoice = log.rawInvoice?.createdByUid === currentUser.uid;
      const isMyUser = log.userName === (userProfile?.name || currentUser?.displayName);
      return isMyIssue || isMyInvoice || isMyUser;
    });
  }, [transactionsLog, currentUser, userProfile]);

  const filteredMyLogs = useMemo(() => {
    return myEmployeeLogs.filter((log) => {
      const matchesSearch =
        log.productName.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.reference.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.from.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.to.toLowerCase().includes(logSearch.toLowerCase());
      const matchesType = logTypeFilter === "all" || log.type === logTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [myEmployeeLogs, logSearch, logTypeFilter]);

  const filteredMyProducts = useMemo(() => {
    if (!myEmployeeRecon?.productList) return [];
    return myEmployeeRecon.productList.filter((p) => {
      const matchesSearch =
        p.productName.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(matrixSearch.toLowerCase());
      const matchesCategory = matrixCategoryFilter === "all" || p.category === matrixCategoryFilter;
      const matchesStatus =
        matrixStatusFilter === "all" ||
        (matrixStatusFilter === "available" && p.balance > 0) ||
        (matrixStatusFilter === "out_of_stock" && p.balance <= 0);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [myEmployeeRecon, matrixSearch, matrixCategoryFilter, matrixStatusFilter]);

  // Handle Select Add Stock Product
  const handleSelectAddStockProduct = (pId) => {
    setAddStockProduct(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod) {
      setAddStockUnit(prod.unit || "KG");
      setAddStockPrice(prod.costPrice || prod.purchasePrice || prod.sellingPrice || 0);
    }
  };

  // Submit ADD STOCK to Company Stock
  const handleAddStockSubmit = async (e) => {
    e.preventDefault();

    if (!addStockProduct) {
      toast.error("Please select a product");
      return;
    }

    const qty = Number(addStockQty);
    if (!addStockQty || qty <= 0) {
      toast.error("Please enter a valid stock quantity greater than 0");
      return;
    }

    const selProd = products.find((p) => p.id === addStockProduct);
    const prodName = selProd?.productName || selProd?.name || "Product";
    const category = selProd?.category || "General";
    const priceRate = Number(addStockPrice) || Number(selProd?.sellingPrice || 0);

    setSavingAddStock(true);

    try {
      const stockIssueNumber = `STK-IN-${Math.floor(10000 + Math.random() * 90000)}`;

      const stockInRecord = {
        issueNumber: stockIssueNumber,
        type: "STOCK_IN",
        from: addStockSource || "Supplier Purchase",
        to: "Company Stock",
        employeeId: "company",
        employeeName: "Company Stock",
        date: addStockDate || new Date().toISOString().split("T")[0],
        notes: addStockNotes ? addStockNotes.trim() : "New stock addition to company inventory",
        products: [
          {
            productId: addStockProduct,
            productName: prodName,
            category,
            quantity: qty,
            unit: addStockUnit || selProd?.unit || "KG",
            price: priceRate,
            lineValue: qty * priceRate
          }
        ],
        totalQuantity: qty,
        totalValue: qty * priceRate,
        productId: addStockProduct,
        productName: prodName,
        quantity: qty,
        unit: addStockUnit || selProd?.unit || "KG",
        price: priceRate,
        createdByUid: currentUser?.uid || "admin",
        createdByName: userProfile?.name || currentUser?.displayName || "Admin",
        createdAt: Date.now()
      };

      if (editingStockInId) {
        await update(ref(db, `employeeStockIssues/${editingStockInId}`), stockInRecord);
        toast.success(`Successfully updated stock addition for ${prodName}!`, {
          style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
        });
      } else {
        const newRef = push(ref(db, "employeeStockIssues"));
        await update(ref(db, `employeeStockIssues/${newRef.key}`), stockInRecord);

        toast.success(`Successfully added ${qty} ${addStockUnit} of ${prodName} to Company Stock!`, {
          style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
        });
      }

      setIsAddStockOpen(false);
      setEditingStockInId(null);
      setAddStockProduct("");
      setAddStockQty("");
      setAddStockNotes("");
      setAddStockDate(new Date().toISOString().split("T")[0]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to add stock");
    } finally {
      setSavingAddStock(false);
    }
  };

  // Edit Stock Log Entry Handler
  const handleEditLog = (log) => {
    if (!log) return;
    if (log.rawIssue) {
      const issue = log.rawIssue;
      if (issue.type === "STOCK_IN" || issue.type === "addition") {
        setEditingStockInId(issue.id);
        setAddStockProduct(log.productId || issue.productId || "");
        setAddStockQty(log.quantity || issue.quantity || "");
        setAddStockUnit(log.unit || issue.unit || "KG");
        setAddStockPrice(log.price || issue.price || 0);
        setAddStockSource(issue.from || "Supplier Purchase");
        setAddStockNotes(issue.notes || "");
        setAddStockDate(issue.date || new Date().toISOString().split("T")[0]);
        setIsAddStockOpen(true);
      } else {
        setEditingIssueForModal(issue);
      }
    } else if (log.rawInvoice || log.type === "SALE") {
      const invoiceData = log.rawInvoice || { id: log.reference };
      navigate("/invoice", { state: { editInvoice: invoiceData } });
    }
  };

  // Delete Stock Log Entry Handler
  const handleConfirmDeleteLog = async () => {
    if (!deletingTargetLog) return;
    const log = deletingTargetLog;
    const targetIssueId = log.rawIssue?.id || log.id;
    const targetInvoiceId = log.rawInvoice?.id || (log.type === "SALE" ? log.reference : null);

    try {
      if (log.rawInvoice || log.type === "SALE") {
        if (targetInvoiceId) {
          await remove(ref(db, `invoices/${targetInvoiceId}`));
        }
      } else if (targetIssueId) {
        await remove(ref(db, `employeeStockIssues/${targetIssueId}`));
        await remove(ref(db, `stockTransfers/${targetIssueId}`)).catch(() => { });
      }

      toast.success("Transaction Deleted Successfully", {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });

      setDeletingTargetLog(null);
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      toast.error("Failed to delete transaction");
    }
  };

  // Delete Product Handler from Matrix/Stock View
  const handleConfirmDeleteProduct = async () => {
    if (!deletingProductTarget) return;
    try {
      await remove(ref(db, `products/${deletingProductTarget.id}`));
      toast.success(`Product '${deletingProductTarget.productName}' deleted successfully!`, {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });
      setDeletingProductTarget(null);
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    }
  };

  // Submit STOCK ADJUSTMENT
  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();

    if (!adjProductId) {
      toast.error("Please select a product to adjust");
      return;
    }

    const prodLedger = stockLedger.productsLedger[adjProductId];
    const systemQty = prodLedger ? prodLedger.companyStock : 0;
    const physicalQty = Number(adjPhysicalQty);

    if (isNaN(physicalQty) || physicalQty < 0) {
      toast.error("Please enter a valid non-negative physical quantity");
      return;
    }

    const diffQty = physicalQty - systemQty;
    if (diffQty === 0) {
      toast.error("Physical quantity matches system quantity. No adjustment needed.");
      return;
    }

    const selProd = products.find((p) => p.id === adjProductId);
    const prodName = selProd?.productName || selProd?.name || "Product";
    const category = selProd?.category || "General";
    const priceRate = Number(selProd?.sellingPrice || 0);

    setSavingAdj(true);

    try {
      const adjRecord = {
        issueNumber: `ADJ-${Math.floor(10000 + Math.random() * 90000)}`,
        type: "ADJUSTMENT",
        from: "System Audit",
        to: "Company Stock",
        employeeId: "company",
        employeeName: "Company Stock",
        date: new Date().toISOString().split("T")[0],
        reason: adjReason,
        notes: adjNotes ? adjNotes.trim() : `Physical audit: ${physicalQty} (Diff: ${diffQty > 0 ? "+" : ""}${diffQty})`,
        products: [
          {
            productId: adjProductId,
            productName: prodName,
            category,
            quantity: diffQty,
            unit: selProd?.unit || "KG",
            price: priceRate,
            lineValue: Math.abs(diffQty) * priceRate
          }
        ],
        totalQuantity: diffQty,
        totalValue: Math.abs(diffQty) * priceRate,
        productId: adjProductId,
        productName: prodName,
        quantity: diffQty,
        unit: selProd?.unit || "KG",
        price: priceRate,
        createdByUid: currentUser?.uid || "admin",
        createdByName: userProfile?.name || currentUser?.displayName || "Admin",
        createdAt: Date.now()
      };

      const newRef = push(ref(db, "employeeStockIssues"));
      await update(ref(db, `employeeStockIssues/${newRef.key}`), adjRecord);

      toast.success(`Stock adjustment created for ${prodName}: ${diffQty > 0 ? "+" : ""}${diffQty} ${selProd?.unit || "KG"}`, {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });

      setIsAdjustmentModalOpen(false);
      setAdjProductId("");
      setAdjPhysicalQty("");
      setAdjNotes("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create stock adjustment");
    } finally {
      setSavingAdj(false);
    }
  };

  // Submit REVERSAL for a transaction
  const handleConfirmReversal = async () => {
    if (!reversalTargetLog) return;
    const log = reversalTargetLog;

    try {
      const revRecord = {
        issueNumber: `REV-${Math.floor(10000 + Math.random() * 90000)}`,
        type: "REVERSAL",
        referenceId: log.id,
        from: "Reversal",
        to: "Company Stock",
        employeeId: "company",
        employeeName: "Company Stock",
        date: new Date().toISOString().split("T")[0],
        notes: `Reversal of ${log.badge?.label} (${log.productName} ${log.quantity} ${log.unit})`,
        products: [
          {
            productId: log.productId,
            productName: log.productName,
            category: log.category,
            quantity: log.quantity,
            unit: log.unit,
            price: log.price,
            lineValue: log.value
          }
        ],
        totalQuantity: log.quantity,
        totalValue: log.value,
        productId: log.productId,
        productName: log.productName,
        quantity: log.quantity,
        unit: log.unit,
        price: log.price,
        createdByUid: currentUser?.uid || "admin",
        createdByName: userProfile?.name || currentUser?.displayName || "Admin",
        createdAt: Date.now()
      };

      const newRef = push(ref(db, "employeeStockIssues"));
      await update(ref(db, `employeeStockIssues/${newRef.key}`), revRecord);

      toast.success(`Reversal created for ${log.productName}`, {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });

      setReversalTargetLog(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to reverse transaction");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-12 font-['Inter']">
      <Toaster />

      {/* Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">
            {isAdmin ? "Stock Management System" : "My Stock Inventory"}
          </h1>
          <p className="text-gray-500 mt-1 font-medium text-sm">
            {isAdmin
              ? "Monitor company inventory, employee stock, and every stock movement from one centralized single source of truth."
              : "Track your assigned stock balance, product sales utilization, and individual stock transactions."}
          </p>
        </div>

        {/* Action Buttons */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddStockOpen(true)}
              className="bg-[#111] text-[#D4AF37] hover:bg-[#222] px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-lg cursor-pointer"
            >
              <FiPlus className="text-lg" /> + Add Stock
            </button>

            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="bg-white border border-gray-200 text-[#111] hover:border-[#D4AF37] hover:text-[#D4AF37] px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm cursor-pointer"
            >
              <FiSend className="text-lg text-[#D4AF37]" /> Transfer Stock
            </button>

            <button
              type="button"
              onClick={() => setIsAdjustmentModalOpen(true)}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer"
            >
              <FiSliders className="text-lg" /> Stock Adjustment
            </button>
          </div>
        )}
      </motion.div>

      {/* TOP 3 SUMMARY CARDS */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      >
        {isAdmin ? (
          <>
            {/* CARD 1: COMPANY STOCK VALUE */}
            <div className="bg-[#111111] text-white p-6 rounded-[28px] shadow-2xl relative overflow-hidden border border-white/10 group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37] blur-[70px] opacity-15 rounded-full pointer-events-none"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Company Stock Value
                </span>
                <div className="w-10 h-10 rounded-xl bg-white/10 text-[#D4AF37] flex items-center justify-center text-lg border border-white/10">
                  <FiPackage />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#D4AF37] font-['Poppins'] tracking-tight">
                ₹{(summary.companyStockValue || 0).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                Physical stock held directly by company ({summary.companyStockQty} total units)
              </p>
            </div>

            {/* CARD 2: TOTAL EMPLOYEE STOCK VALUE */}
            <div className="bg-white p-6 rounded-[28px] shadow-lg border border-gray-100 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Total Employee Stock Value
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg border border-blue-100">
                  <FiUser />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#111] font-['Poppins'] tracking-tight">
                ₹{(summary.totalEmployeeStockValue || 0).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                Combined stock currently assigned to all employees ({summary.employeeStockQty} total units)
              </p>
            </div>

            {/* CARD 3: TOTAL STOCK VALUE */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-[28px] shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-amber-100 uppercase tracking-widest">
                  Total Stock Value
                </span>
                <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg backdrop-blur-sm">
                  <FiDollarSign />
                </div>
              </div>
              <div className="text-3xl font-bold text-white font-['Poppins'] tracking-tight">
                ₹{(summary.totalStockValue || 0).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-amber-100 mt-2 font-medium">
                Company Stock Value + Employee Stock Value ({summary.totalStockQty} combined units)
              </p>
            </div>
          </>
        ) : (
          <>
            {/* EMPLOYEE CARD 1: MY STOCK VALUE */}
            <div className="bg-[#111111] text-white p-6 rounded-[28px] shadow-2xl relative overflow-hidden border border-white/10 group">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37] blur-[70px] opacity-15 rounded-full pointer-events-none"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  My Stock Value
                </span>
                <div className="w-10 h-10 rounded-xl bg-white/10 text-[#D4AF37] flex items-center justify-center text-lg border border-white/10">
                  <FiDollarSign />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#D4AF37] font-['Poppins'] tracking-tight">
                ₹{(myEmployeeRecon?.totalStockValue || 0).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                Total valuation of stock currently assigned to your profile
              </p>
            </div>

            {/* EMPLOYEE CARD 2: MY CURRENT BALANCE */}
            <div className="bg-white p-6 rounded-[28px] shadow-lg border border-gray-100 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  My Stock Balance
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg border border-blue-100">
                  <FiPackage />
                </div>
              </div>
              <div className="text-3xl font-bold text-[#111] font-['Poppins'] tracking-tight">
                {(() => {
                  const activeProds = (myEmployeeRecon?.productList || []).filter(p => p.balance > 0);
                  if (activeProds.length === 1) {
                    return `${activeProds[0].balance} ${activeProds[0].unit || "KG"}`;
                  }
                  const unitsSet = new Set(activeProds.map(p => p.unit || "KG"));
                  if (unitsSet.size === 1 && activeProds.length > 0) {
                    return `${myEmployeeRecon?.currentBalance || 0} ${Array.from(unitsSet)[0]}`;
                  }
                  return `${myEmployeeRecon?.currentBalance || 0} items (${activeProds.length} products)`;
                })()}
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                Issued: {myEmployeeRecon?.totalIssued || 0} • Sold: {myEmployeeRecon?.totalSold || 0}
              </p>
            </div>

            {/* EMPLOYEE CARD 3: STOCK UTILIZATION */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-[28px] shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-amber-100 uppercase tracking-widest">
                  Stock Utilization
                </span>
                <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg backdrop-blur-sm">
                  <FiCheckCircle />
                </div>
              </div>
              <div className="text-3xl font-bold text-white font-['Poppins'] tracking-tight">
                {myEmployeeRecon?.overallUtilizationFormatted || "0%"}
              </div>
              <p className="text-xs text-amber-100 mt-2 font-medium">
                Percentage of issued stock converted into completed sales
              </p>
            </div>
          </>
        )}
      </motion.div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto custom-scrollbar">
        {isAdmin ? (
          <>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "matrix"
                ? "border-[#D4AF37] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              Product Matrix ({filteredMatrixProducts.length})
            </button>

            <button
              onClick={() => setActiveTab("company")}
              className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "company"
                ? "border-[#D4AF37] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              Company Stock View
            </button>

            <button
              onClick={() => setActiveTab("employee")}
              className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "employee"
                ? "border-[#D4AF37] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              Employee Stock View ({reconEmployees.length})
            </button>

            <button
              onClick={() => setActiveTab("log")}
              className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "log"
                ? "border-[#D4AF37] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              Stock Management Log ({filteredLogs.length})
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab("my_stock")}
              className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "my_stock"
                ? "border-[#D4AF37] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              My Stock Inventory ({filteredMyProducts.length})
            </button>

            <button
              onClick={() => setActiveTab("my_log")}
              className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${activeTab === "my_log"
                ? "border-[#D4AF37] text-[#111]"
                : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              My Stock Log ({filteredMyLogs.length})
            </button>
          </>
        )}
      </div>

      {/* TAB 1: PRODUCT MATRIX (ADMIN ONLY) */}
      {isAdmin && activeTab === "matrix" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <div className="relative flex items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 w-full md:w-80">
              <FiSearch className="text-gray-400 mr-2 text-base" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search Product Matrix..."
                className="bg-transparent outline-none text-xs font-semibold text-[#111] w-full placeholder-gray-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={matrixCategoryFilter}
                onChange={(e) => setMatrixCategoryFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#111] outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={matrixStatusFilter}
                onChange={(e) => setMatrixStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#111] outline-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="available">Available Only</option>
                <option value="out_of_stock">Out of Stock Only</option>
              </select>
            </div>
          </div>

          {/* Product Matrix Table */}
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#111]"></div>
            </div>
          ) : filteredMatrixProducts.length > 0 ? (
            <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-4 px-6">Product</th>
                      <th className="py-4 px-6">Category</th>
                      <th className="py-4 px-6 text-center">Total Added</th>
                      <th className="py-4 px-6 text-center">Total Sold</th>
                      <th className="py-4 px-6 text-center">Company Stock</th>
                      <th className="py-4 px-6 text-center">Employee Stock</th>
                      <th className="py-4 px-6 text-center">Current Balance</th>
                      <th className="py-4 px-6 text-right">Stock Value</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-medium">
                    {filteredMatrixProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-[#111]">
                          <div className="flex items-center gap-3">
                            {p.image ? (
                              <img src={p.image} alt={p.productName} className="w-10 h-10 rounded-xl object-cover border border-gray-200" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center text-base font-bold">
                                {p.productName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-[#111]">{p.productName}</div>
                              <span className="text-[10px] text-gray-400 font-normal">
                                ₹{p.sellingPrice} per {p.unit}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-500 font-semibold">{p.category}</td>
                        <td className="py-4 px-6 text-center font-bold text-gray-700 font-['Poppins']">
                          {p.totalStockAdded} {p.unit}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-[#D4AF37] font-['Poppins']">
                          {p.totalSold} {p.unit}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-blue-600 font-['Poppins']">
                          {p.companyStock} {p.unit}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-purple-600 font-['Poppins']">
                          {p.employeeStock} {p.unit}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="font-bold text-[#111] font-['Poppins'] text-base">
                            {p.totalCurrentBalance} {p.unit}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-emerald-600 font-['Poppins']">
                          ₹{p.totalStockValue.toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${p.totalCurrentBalance > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                              }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${p.totalCurrentBalance > 0 ? "bg-emerald-500" : "bg-red-500"
                                }`}
                            />
                            {p.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isAdmin && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStockInId(null);
                                  setAddStockProduct(p.id);
                                  setAddStockUnit(p.unit || "KG");
                                  setAddStockPrice(p.sellingPrice || 0);
                                  setIsAddStockOpen(true);
                                }}
                                title="Edit Product / Add Stock"
                                className="p-2 text-gray-400 hover:text-[#D4AF37] hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <FiEdit className="text-sm" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingProductTarget(p)}
                                title="Delete Product"
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <FiTrash2 className="text-sm" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">
              No products found matching your search.
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 2: COMPANY STOCK VIEW (ADMIN ONLY) */}
      {isAdmin && activeTab === "company" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Company Physical Stock View</h3>
              <p className="text-xs text-gray-400 mt-1">Stock currently located at the company warehouse/facility</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Total Company Stock Value</span>
              <span className="text-2xl font-bold text-[#D4AF37] font-['Poppins']">
                ₹{summary.companyStockValue.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {matrixProducts.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.productName}
                      className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-lg border border-gray-200 shrink-0">
                      {p.productName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-[#111] font-['Poppins'] text-sm">{p.productName}</h4>
                    <span className="text-xs text-gray-400">{p.category} • ₹{p.sellingPrice}/{p.unit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-[#111] font-['Poppins'] block">
                    {p.companyStock} {p.unit}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 font-['Poppins']">
                    ₹{p.companyStockValue.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 3: EMPLOYEE STOCK VIEW (ADMIN ONLY) */}
      {isAdmin && activeTab === "employee" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Employee Assigned Stock</h3>
              <p className="text-xs text-gray-400 mt-1">Breakdown of inventory currently held by individual sales representatives</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Total Employee Stock Value</span>
              <span className="text-2xl font-bold text-blue-600 font-['Poppins']">
                ₹{summary.totalEmployeeStockValue.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reconEmployees.map((emp) => {
              const activeAssignedProds = Object.values(emp.products || {}).filter(
                (p) => p.balance !== 0 || (p.issued || 0) > 0 || p.sold > 0
              );

              return (
                <div key={emp.uid} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    {/* Employee Header with Employee Avatar */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar emp={emp} className="w-12 h-12 shadow-sm" roundedClassName="rounded-2xl" textClassName="text-base font-bold" />
                        <div>
                          <h4
                            onClick={() => setSelectedEmployeeForDetail(emp)}
                            className="font-bold text-[#D4AF37] hover:text-amber-500 font-['Poppins'] text-base cursor-pointer transition-colors"
                          >
                            {emp.name}
                          </h4>
                          <span className="text-xs text-gray-400">{emp.role || "Sales Rep"}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${emp.status.color}`}>
                        {emp.status.label}
                      </span>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3 text-center bg-gray-50 p-3 rounded-2xl mb-4">
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Current Stock</span>
                        <span className="text-base font-bold text-[#111] font-['Poppins']">{emp.currentBalance} units</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Stock Value</span>
                        <span className="text-base font-bold text-emerald-600 font-['Poppins']">₹{emp.totalStockValue.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    {/* Assigned Products Breakdown with Product Images */}
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                        Assigned Products ({activeAssignedProds.length})
                      </span>

                      {activeAssignedProds.length > 0 ? (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                          {activeAssignedProds.map((prodItem) => {
                            const pImg = prodItem.image || products.find(p => p.id === prodItem.productId || p.productName === prodItem.productName)?.image;
                            return (
                              <div
                                key={prodItem.productId}
                                className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-xl border border-gray-100 text-xs"
                              >
                                <div className="flex items-center gap-2.5 truncate pr-2">
                                  {pImg ? (
                                    <img
                                      src={pImg}
                                      alt={prodItem.productName}
                                      className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 border border-gray-200">
                                      <FiPackage className="text-sm" />
                                    </div>
                                  )}
                                  <div className="truncate">
                                    <p className="font-bold text-[#111] truncate">{prodItem.productName}</p>
                                    <span className="text-[10px] text-gray-400">₹{prodItem.unitPrice || 0}/{prodItem.unit || "KG"}</span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`font-bold font-['Poppins'] block ${prodItem.balance < 0 ? "text-red-600" : "text-[#111]"}`}>
                                    {prodItem.balance} {prodItem.unit || "KG"}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-600 font-['Poppins']">
                                    ₹{(prodItem.stockValue || Math.max(0, prodItem.balance) * (prodItem.unitPrice || 0)).toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-3 text-xs text-gray-400 bg-gray-50 rounded-xl font-medium">
                          No active stock assigned
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeForDetail(emp)}
                    className="w-full bg-[#111] hover:bg-black text-[#D4AF37] py-3 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md mt-4"
                  >
                    <FiEye className="text-sm" /> View Employee Details
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* TAB 4: STOCK MANAGEMENT LOG (ADMIN ONLY) */}
      {isAdmin && activeTab === "log" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <div className="relative flex items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 w-full md:w-80">
              <FiSearch className="text-gray-400 mr-2 text-base" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search Log (Product, User, Ref)..."
                className="bg-transparent outline-none text-xs font-semibold text-[#111] w-full placeholder-gray-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#111] outline-none cursor-pointer"
              >
                <option value="all">All Transaction Types</option>
                <option value="STOCK_IN">Stock In</option>
                <option value="TRANSFER">Company → Employee</option>
                <option value="EMPLOYEE_TRANSFER">Employee → Employee</option>
                <option value="SALE">Sale / Invoice</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="REVERSAL">Reversal</option>
              </select>
            </div>
          </div>

          {/* Log Table */}
          {filteredLogs.length > 0 ? (
            <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-4 px-6">Date</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Product</th>
                      <th className="py-4 px-6 text-center">Quantity</th>
                      <th className="py-4 px-6">From</th>
                      <th className="py-4 px-6">To</th>
                      <th className="py-4 px-6">Reference</th>
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 text-gray-500">{log.date}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${log.badge?.color}`}>
                            {log.badge?.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-[#111]">
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const logProd = products.find(p => p.id === log.productId || p.productName === log.productName);
                              const logImg = log.productImage || logProd?.image;
                              return logImg ? (
                                <img src={logImg} alt={log.productName} className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 border border-gray-200">
                                  <FiPackage className="text-sm" />
                                </div>
                              );
                            })()}
                            <span>{log.productName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-[#111] font-['Poppins']">
                          {log.quantity} {log.unit}
                        </td>
                        <td className="py-4 px-6 text-gray-600">{log.from}</td>
                        <td className="py-4 px-6 text-gray-600">{log.to}</td>
                        <td className="py-4 px-6 font-mono text-[11px] text-gray-500">{log.reference}</td>
                        <td className="py-4 px-6 text-gray-700">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const logEmp = employees.find(e => e.uid === log.rawIssue?.createdByUid || e.uid === log.rawInvoice?.createdByUid || e.name === log.userName);
                              return (
                                <EmployeeAvatar emp={logEmp || { name: log.userName }} className="w-7 h-7" roundedClassName="rounded-full" textClassName="text-[10px]" />
                              );
                            })()}
                            <span>{log.userName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isAdmin && (
                            <div className="flex items-center justify-end gap-1.5">
                              {(log.rawIssue || log.rawInvoice || log.type === "SALE") && (
                                <button
                                  type="button"
                                  onClick={() => handleEditLog(log)}
                                  title="Edit Transaction"
                                  className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <FiEdit className="text-sm" />
                                </button>
                              )}

                              {log.type !== "SALE" && log.type !== "REVERSAL" && (
                                <button
                                  type="button"
                                  onClick={() => setReversalTargetLog(log)}
                                  title="Reverse Transaction"
                                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <FiRefreshCw className="text-sm" />
                                </button>
                              )}

                              {(log.rawIssue || log.rawInvoice || log.type === "SALE") && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingTargetLog(log)}
                                  title="Delete Transaction"
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <FiTrash2 className="text-sm" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">
              No stock log entries found matching filter.
            </div>
          )}
        </motion.div>
      )}

      {/* EMPLOYEE TAB 1: MY STOCK INVENTORY */}
      {!isAdmin && activeTab === "my_stock" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <div className="relative flex items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 w-full md:w-80">
              <FiSearch className="text-gray-400 mr-2 text-base" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search My Stock..."
                className="bg-transparent outline-none text-xs font-semibold text-[#111] w-full placeholder-gray-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={matrixCategoryFilter}
                onChange={(e) => setMatrixCategoryFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#111] outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={matrixStatusFilter}
                onChange={(e) => setMatrixStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#111] outline-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="available">Available Only</option>
                <option value="out_of_stock">Out of Stock Only</option>
              </select>
            </div>
          </div>

          {/* Product Cards Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#111]"></div>
            </div>
          ) : filteredMyProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMyProducts.map((p) => (
                <div
                  key={p.productId}
                  className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.productName}
                            className="w-12 h-12 rounded-2xl object-cover border border-gray-200 shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-lg border border-gray-200 shrink-0">
                            {p.productName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.category}</span>
                          <h4 className="font-bold text-[#111] text-base font-['Poppins']">{p.productName}</h4>
                          <span className="text-xs text-gray-400">₹{p.unitPrice || 0} / {p.unit || "KG"}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${p.status.color}`}>
                        {p.status.label}
                      </span>
                    </div>

                    {/* Stock Metrics Grid */}
                    <div className="grid grid-cols-4 gap-2 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 text-center mb-3">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Issued</span>
                        <span className="text-sm font-bold text-[#111] font-['Poppins']">{p.issued ?? ((p.receivedFromCompany || 0) + (p.receivedFromEmployees || 0))}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Sold</span>
                        <span className="text-sm font-bold text-[#D4AF37] font-['Poppins']">{p.sold}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Balance</span>
                        <span className={`text-sm font-bold font-['Poppins'] ${p.balance < 0 ? "text-red-600" : "text-[#111]"}`}>
                          {p.balance}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Sold %</span>
                        <span className="text-sm font-bold text-amber-600 font-['Poppins']">{p.utilizationFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock Value */}
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500 border-t border-gray-100 pt-3">
                    <span>Stock Valuation:</span>
                    <span className="text-base font-bold text-emerald-600 font-['Poppins']">
                      ₹{(p.stockValue || Math.max(0, p.balance) * (p.unitPrice || 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">
              No stock assigned matching search criteria.
            </div>
          )}
        </motion.div>
      )}

      {/* EMPLOYEE TAB 2: MY STOCK LOG */}
      {!isAdmin && activeTab === "my_log" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <div className="relative flex items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 w-full md:w-80">
              <FiSearch className="text-gray-400 mr-2 text-base" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search My Log (Product, Ref)..."
                className="bg-transparent outline-none text-xs font-semibold text-[#111] w-full placeholder-gray-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#111] outline-none cursor-pointer"
              >
                <option value="all">All Transaction Types</option>
                <option value="STOCK_IN">Stock Issued / Received</option>
                <option value="TRANSFER">Company → Employee</option>
                <option value="EMPLOYEE_TRANSFER">Employee → Employee</option>
                <option value="SALE">Sale / Invoice</option>
              </select>
            </div>
          </div>

          {/* My Log Table */}
          {filteredMyLogs.length > 0 ? (
            <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-4 px-6">Date</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Product</th>
                      <th className="py-4 px-6 text-center">Quantity</th>
                      <th className="py-4 px-6">From</th>
                      <th className="py-4 px-6">To</th>
                      <th className="py-4 px-6">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                    {filteredMyLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 text-gray-500">{log.date}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${log.badge?.color}`}>
                            {log.badge?.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-[#111]">
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const logProd = products.find(p => p.id === log.productId || p.productName === log.productName);
                              const logImg = log.productImage || logProd?.image;
                              return logImg ? (
                                <img src={logImg} alt={log.productName} className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 border border-gray-200">
                                  <FiPackage className="text-sm" />
                                </div>
                              );
                            })()}
                            <span>{log.productName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-[#111] font-['Poppins']">
                          {log.quantity} {log.unit}
                        </td>
                        <td className="py-4 px-6 text-gray-600">{log.from}</td>
                        <td className="py-4 px-6 text-gray-600">{log.to}</td>
                        <td className="py-4 px-6 font-mono text-[11px] text-gray-500">{log.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">
              No stock log entries found for your account.
            </div>
          )}
        </motion.div>
      )}

      {/* MODAL 1: ADD STOCK */}
      {isAddStockOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative font-['Inter']">
            <button onClick={() => { setIsAddStockOpen(false); setEditingStockInId(null); }} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] bg-gray-50 rounded-full p-2 transition-colors cursor-pointer">
              <FiX className="text-xl" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-xl">
                <FiPackage />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#111] font-['Poppins']">
                  {editingStockInId ? "Edit Stock Addition" : "+ Add Stock to Company"}
                </h3>
                <p className="text-xs text-gray-400">Receive new physical stock into Company inventory</p>
              </div>
            </div>

            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Select Product *</label>
                <select
                  value={addStockProduct}
                  onChange={(e) => handleSelectAddStockProduct(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-semibold text-[#111] outline-none cursor-pointer"
                >
                  <option value="">Choose Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName} • {p.category}
                    </option>
                  ))}
                </select>

                {addStockProduct && (() => {
                  const selP = products.find(p => p.id === addStockProduct);
                  return selP ? (
                    <div className="mt-2.5 flex items-center gap-3 p-2.5 bg-gray-50 rounded-2xl border border-gray-200">
                      {selP.image ? (
                        <img src={selP.image} alt={selP.productName} className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {selP.productName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-xs text-[#111]">{selP.productName}</p>
                        <span className="text-[10px] text-gray-400">{selP.category} • ₹{selP.sellingPrice}/{selP.unit || "KG"}</span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="e.g. 3"
                    value={addStockQty}
                    onChange={(e) => setAddStockQty(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-bold text-[#111] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Unit *</label>
                  <div className="space-y-2">
                    <select
                      value={["KG", "Gram", "Piece", "Pack", "Packet", "Box", "Bottle", "Bag", "Dozen", "Litre", "Meter", "Carton"].includes(addStockUnit) ? addStockUnit : "CUSTOM"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "CUSTOM") {
                          setAddStockUnit("");
                        } else {
                          setAddStockUnit(val);
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-semibold text-[#111] outline-none cursor-pointer"
                    >
                      <option value="KG">KG</option>
                      <option value="Gram">Gram</option>
                      <option value="Piece">Piece</option>
                      <option value="Pack">Pack</option>
                      <option value="Packet">Packet</option>
                      <option value="Box">Box</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Bag">Bag</option>
                      <option value="Dozen">Dozen</option>
                      <option value="Litre">Litre</option>
                      <option value="Meter">Meter</option>
                      <option value="Carton">Carton</option>
                      <option value="CUSTOM">+ Custom Unit...</option>
                    </select>

                    {!["KG", "Gram", "Piece", "Pack", "Packet", "Box", "Bottle", "Bag", "Dozen", "Litre", "Meter", "Carton"].includes(addStockUnit) && (
                      <input
                        type="text"
                        placeholder="Enter custom unit (e.g. Roll, Container)..."
                        value={addStockUnit}
                        onChange={(e) => setAddStockUnit(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs font-bold text-[#111] outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stock Valuation Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Rate per unit"
                  value={addStockPrice}
                  onChange={(e) => setAddStockPrice(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-bold text-[#111] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FiCalendar className="text-[#D4AF37]" /> Stock Addition Date *
                </label>
                <input
                  type="date"
                  value={addStockDate}
                  onChange={(e) => setAddStockDate(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-semibold text-[#111] outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Source / Supplier</label>
                <input
                  type="text"
                  placeholder="Supplier name"
                  value={addStockSource}
                  onChange={(e) => setAddStockSource(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-medium text-[#111] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Batch details..."
                  value={addStockNotes}
                  onChange={(e) => setAddStockNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-medium text-[#111] outline-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button type="button" onClick={() => { setIsAddStockOpen(false); setEditingStockInId(null); }} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={savingAddStock} className="flex-1 bg-[#111] text-[#D4AF37] py-3.5 rounded-2xl font-bold text-xs shadow-lg cursor-pointer disabled:opacity-50">
                  {savingAddStock ? "Saving..." : editingStockInId ? "Update Stock Addition" : "Save Company Stock"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: TRANSFER STOCK */}
      <TransferStockModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        employeesList={employees}
        productsList={products}
        stockIssues={stockIssues}
        invoices={invoices}
      />

      {/* MODAL 3: STOCK ADJUSTMENT */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative font-['Inter']">
            <button onClick={() => setIsAdjustmentModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] bg-gray-50 rounded-full p-2 transition-colors cursor-pointer">
              <FiX className="text-xl" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-xl">
                <FiSliders />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#111] font-['Poppins']">Stock Adjustment</h3>
                <p className="text-xs text-gray-400">Reconcile physical stock count with system stock</p>
              </div>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Select Product *</label>
                <select
                  value={adjProductId}
                  onChange={(e) => setAdjProductId(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-semibold text-[#111] outline-none cursor-pointer"
                >
                  <option value="">Choose Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName}
                    </option>
                  ))}
                </select>
              </div>

              {adjProductId && (() => {
                const adjProd = products.find(p => p.id === adjProductId);
                return (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-2">
                    <div className="flex items-center gap-3">
                      {adjProd?.image ? (
                        <img src={adjProd.image} alt={adjProd.productName} className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-200 text-gray-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {adjProd?.productName?.charAt(0) || <FiPackage />}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-xs text-[#111]">{adjProd?.productName}</p>
                        <span className="text-[10px] text-gray-400">{adjProd?.category} • ₹{adjProd?.sellingPrice}/{adjProd?.unit || "KG"}</span>
                      </div>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-gray-500 font-semibold">Current System Company Stock:</span>
                      <span className="font-bold text-[#111] font-['Poppins']">
                        {stockLedger.productsLedger[adjProductId]?.companyStock || 0} {stockLedger.productsLedger[adjProductId]?.unit || "KG"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Actual Physical Quantity *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Enter physical count"
                  value={adjPhysicalQty}
                  onChange={(e) => setAdjPhysicalQty(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-bold text-[#111] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Reason</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-semibold text-[#111] outline-none cursor-pointer"
                >
                  <option value="Physical Audit Correction">Physical Audit Correction</option>
                  <option value="Damaged Goods">Damaged Goods</option>
                  <option value="Lost Stock">Lost Stock</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Audit comments..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-medium text-[#111] outline-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={savingAdj} className="flex-1 bg-[#111] text-[#D4AF37] py-3.5 rounded-2xl font-bold text-xs shadow-lg cursor-pointer disabled:opacity-50">
                  {savingAdj ? "Applying..." : "Apply Adjustment"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 4: REVERSAL CONFIRMATION */}
      {reversalTargetLog && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <FiRefreshCw />
            </div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins'] mb-2">Reverse Transaction?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              This will create a corrective reversal transaction for <span className="font-bold text-[#111]">{reversalTargetLog.productName} ({reversalTargetLog.quantity} {reversalTargetLog.unit})</span> without mutating historical ledger audit records.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReversalTargetLog(null)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmReversal} className="flex-1 bg-amber-500 text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg hover:bg-amber-600 transition-colors cursor-pointer">
                Confirm Reversal
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 5: DELETE TRANSACTION CONFIRMATION */}
      {deletingTargetLog && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <FiAlertTriangle />
            </div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins'] mb-2">Delete Transaction?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this stock transaction (<span className="font-bold text-[#111]">{deletingTargetLog.productName} - {deletingTargetLog.quantity} {deletingTargetLog.unit}</span>)? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTargetLog(null)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmDeleteLog} className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg hover:bg-red-600 transition-colors cursor-pointer">
                Delete Permanently
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 5B: DELETE PRODUCT CONFIRMATION */}
      {deletingProductTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <FiAlertTriangle />
            </div>
            <h3 className="text-xl font-bold text-[#111] font-['Poppins'] mb-2">Delete Product?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to permanently delete product <span className="font-bold text-[#111]">{deletingProductTarget.productName}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingProductTarget(null)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-bold text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmDeleteProduct} className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg hover:bg-red-600 transition-colors cursor-pointer">
                Delete Product
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 6: EDIT STOCK ISSUE / ALLOCATION */}
      <IssueStockModal
        isOpen={!!editingIssueForModal}
        onClose={() => setEditingIssueForModal(null)}
        employeesList={employees}
        productsList={products}
        stockIssues={stockIssues}
        invoices={invoices}
        editingIssue={editingIssueForModal}
      />

      {/* MODAL 7: EMPLOYEE STOCK DETAIL MODAL */}
      {selectedEmployeeForDetail && (
        <EmployeeStockDetailModal
          employee={fullSelectedEmployeeRecon || selectedEmployeeForDetail}
          isOpen={!!selectedEmployeeForDetail}
          onClose={() => setSelectedEmployeeForDetail(null)}
          isAdmin={isAdmin}
          onEditIssue={(iss) => {
            setSelectedEmployeeForDetail(null);
            setEditingIssueForModal(iss);
          }}
          onDeleteIssue={(issueId) => {
            setSelectedEmployeeForDetail(null);
            setDeletingTargetLog({ id: issueId, rawIssue: { id: issueId }, productName: "Stock Allocation", quantity: "", unit: "" });
          }}
        />
      )}
    </div>
  );
}
