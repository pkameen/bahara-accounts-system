import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { db } from "../firebase";
import { ref, onValue, push, update } from "firebase/database";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  FiDownload,
  FiPlus,
  FiTrash2,
  FiSave,
  FiMapPin,
  FiPackage,
  FiLoader,
  FiClock
} from "react-icons/fi";
import logoIcon from '../assets/bahara.logo.jpg';

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

// Searchable Product Selector supporting both Admin Catalog products and Custom Items / Songs
const ProductSelector = ({
  productName,
  productId,
  onSelectProduct,
  onProductNameChange,
  availableProducts = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedProduct = availableProducts.find(
    (ap) => ap.id === productId || (productId && ap.productName?.toLowerCase() === productName?.toLowerCase())
  );

  const trimmedQuery = (productName || "").trim().toLowerCase();
  const filteredProducts = trimmedQuery === ""
    ? availableProducts.slice(0, 8)
    : availableProducts.filter((ap) =>
        ap.productName?.toLowerCase().includes(trimmedQuery) ||
        (ap.category && ap.category.toLowerCase().includes(trimmedQuery))
      );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="Search catalog or type item / song name..."
          value={productName || ""}
          onChange={(e) => {
            onProductNameChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (availableProducts.length > 0) setIsOpen(true);
          }}
          className="w-full bg-white border border-gray-200 focus:border-[#D4AF37]/50 rounded-xl text-sm font-semibold text-[#111] outline-none transition-all p-3.5 pr-20 placeholder:text-gray-400"
        />

        <div className="absolute right-3.5 flex items-center gap-1.5 pointer-events-none">
          {selectedProduct && (
            <span className="text-[10px] font-bold bg-[#D4AF37]/15 text-[#8c7118] px-2 py-0.5 rounded-md hidden sm:inline-block">
              Catalog
            </span>
          )}
          <FiPackage className="text-gray-400" />
        </div>
      </div>

      {/* Suggested Products Dropdown */}
      {isOpen && availableProducts.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((ap) => (
              <div
                key={ap.id}
                onMouseDown={() => {
                  onSelectProduct(ap);
                  setIsOpen(false);
                }}
                className="p-3.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="font-bold text-sm text-[#111]">{ap.productName}</div>
                  <div className="text-xs text-gray-400">
                    {ap.category || "General"} {typeof ap.stock === "number" && ap.stock > 0 ? `• Stock: ${ap.stock}` : ""}
                  </div>
                </div>
                <div className="font-bold text-sm text-[#D4AF37]">₹{ap.sellingPrice}</div>
              </div>
            ))
          ) : (
            <div className="p-3.5 text-xs text-gray-500 flex items-center justify-between">
              <span>Billing custom item: <strong className="text-[#111]">"{productName}"</strong></span>
              <span className="text-[10px] font-bold text-[#D4AF37] uppercase">Custom</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Invoice = () => {
  const invoiceRef = useRef();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, role } = useAuth();

  const [customer, setCustomer] = useState({
    name: "",
    phone: ""
  });
  const [editId, setEditId] = useState(null);

  const [invoiceProducts, setInvoiceProducts] = useState([
    { id: 1, productId: "", productName: "", price: "", quantity: 1, category: "" }
  ]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("BHR-100");
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });

  // Fetch Products from Admin -> Products
  useEffect(() => {
    const prodRef = ref(db, "products");
    onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.keys(data).map(k => ({ id: k, ...data[k] }));
        setAvailableProducts(loaded);
      } else {
        setAvailableProducts([]);
      }
    });
  }, []);

  // Available catalog products
  const selectableProducts = availableProducts;

  // Prefill Data if Editing
  useEffect(() => {
    const editInvoice = location.state?.editInvoice;

    if (!editInvoice) return;

    const formattedDate = editInvoice.invoiceDate
      ? editInvoice.invoiceDate
      : editInvoice.createdAt
        ? new Date(
          new Date(editInvoice.createdAt).getTime() -
          new Date(editInvoice.createdAt).getTimezoneOffset() * 60000
        )
          .toISOString()
          .split("T")[0]
        : "";

    Promise.resolve().then(() => {
      setEditId(editInvoice.id);
      setInvoiceNumber(editInvoice.invoiceNumber || "");
      setCustomer({
        name: editInvoice.customerName || "",
        phone: editInvoice.phone || ""
      });

      setPaymentStatus(editInvoice.paymentStatus || "paid");
      setInvoiceDate(formattedDate);

      if (editInvoice.products && editInvoice.products.length > 0) {
        setInvoiceProducts(
          editInvoice.products.map((p) => ({
            id: p.id || Date.now() + Math.random(),
            productId: p.productId || "",
            productName: p.productName || "",
            price: p.price || "",
            quantity: p.quantity || 1,
            category: p.category || ""
          }))
        );
      }
    });
  }, [location.state?.editInvoice]);

  // Fetch Invoices for Auto-increment Number
  useEffect(() => {
    const invRef = ref(db, "invoices");
    if (editId || location.state?.editInvoice) return;
    onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const invoicesList = Object.values(data);
        let maxNum = 99;
        invoicesList.forEach(inv => {
          if (inv.invoiceNumber) {
            let num = NaN;
            if (inv.invoiceNumber.startsWith("BHR-")) {
              num = parseInt(inv.invoiceNumber.replace("BHR-", ""));
            } else if (inv.invoiceNumber.startsWith("WE-")) {
              num = parseInt(inv.invoiceNumber.replace("WE-", ""));
            }
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
        setInvoiceNumber(`BHR-${maxNum + 1}`);
      } else {
        setInvoiceNumber("BHR-100");
      }
    });
  }, [location.state, editId]);

  const handleCustomerChange = (e) => setCustomer({ ...customer, [e.target.name]: e.target.value });

  const addProductRow = () => {
    setInvoiceProducts([...invoiceProducts, { id: Date.now(), productId: "", productName: "", price: "", quantity: 1, category: "" }]);
  };

  const removeProductRow = (id) => {
    if (invoiceProducts.length > 1) {
      setInvoiceProducts(invoiceProducts.filter(p => p.id !== id));
    }
  };

  const updateProductRow = (id, field, value) => {
    setInvoiceProducts(invoiceProducts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSelectProductInRow = (rowId, adminProduct) => {
    if (adminProduct) {
      setInvoiceProducts(prev => prev.map(p => p.id === rowId ? {
        ...p,
        productId: adminProduct.id,
        productName: adminProduct.productName,
        price: adminProduct.sellingPrice,
        category: adminProduct.category || "General"
      } : p));
    } else {
      setInvoiceProducts(prev => prev.map(p => p.id === rowId ? {
        ...p,
        productId: "",
        productName: "",
        price: "",
        category: ""
      } : p));
    }
  };

  const handleCustomProductNameChange = (rowId, newName) => {
    // Check if newName matches any available catalog product
    const matched = availableProducts.find(
      ap => ap.productName?.toLowerCase() === newName.trim().toLowerCase()
    );

    setInvoiceProducts(prev => prev.map(p => p.id === rowId ? {
      ...p,
      productName: newName,
      productId: matched ? matched.id : "",
      category: matched ? (matched.category || "General") : (p.category || "General"),
      price: (matched && (!p.price || p.price === "" || Number(p.price) === 0)) ? matched.sellingPrice : p.price
    } : p));
  };

  // Calculations
  const processedProducts = invoiceProducts.map(ip => {
    const price = Number(ip.price) || 0;
    const qty = Number(ip.quantity) || 0;
    const total = price * qty;
    return { ...ip, price, total, qty };
  });

  const subtotal = processedProducts.reduce((sum, p) => sum + p.total, 0);
  const grandTotal = subtotal;

  const displayDateStr = invoiceDate ? invoiceDate.split('-').reverse().join('/') : '';

  // Save Invoice & Update Stock
  const handleSaveInvoice = async (e) => {
    e.preventDefault();

    if (!customer.name || !customer.phone) {
      toast.error("Please fill required customer details");
      return;
    }

    // Validation: All product rows must have an item or product name
    const emptyItems = processedProducts.filter(p => !p.productName.trim());
    if (emptyItems.length > 0) {
      toast.error("Please enter an item or product name for all rows", {
        style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }
      });
      return;
    }

    const invalidItems = processedProducts.filter(p => Number(p.price) < 0 || Number(p.qty) <= 0);
    if (invalidItems.length > 0) {
      toast.error("Please enter a valid rate and quantity for all item rows", {
        style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }
      });
      return;
    }

    setLoading(true);
    try {
      const stockChanges = {};

      // If editing, add back old stock to offset the difference
      if (editId && location.state?.editInvoice?.products) {
        location.state.editInvoice.products.forEach(oldP => {
          if (oldP.productId) {
            stockChanges[oldP.productId] = (stockChanges[oldP.productId] || 0) + Number(oldP.quantity);
          }
        });
      }

      // Map Final Products (supports custom items / songs as well as catalog products)
      const finalProducts = processedProducts.map((p) => {
        const productGrandTotal = p.total;
        const matchedDbProduct = availableProducts.find(
          ap => (p.productId && ap.id === p.productId) || ap.productName?.toLowerCase() === p.productName?.toLowerCase()
        );

        return {
          productId: p.productId || matchedDbProduct?.id || "",
          customerName: customer.name,
          productName: p.productName.trim(),
          category: p.category || matchedDbProduct?.category || "General",
          quantity: p.qty,
          price: p.price,
          subtotal: p.total,
          shippingCharge: 0,
          grandTotal: productGrandTotal,
          total: productGrandTotal,
          date: displayDateStr,
          invoiceDate: invoiceDate,
          status: editId ? location.state.editInvoice.status : "Completed",
          invoiceNumber: invoiceNumber
        };
      });

      // Subtract newly defined quantities for products tracked in catalog
      finalProducts.forEach(newP => {
        if (newP.productId) {
          stockChanges[newP.productId] = (stockChanges[newP.productId] || 0) - Number(newP.quantity);
        }
      });

      // Validate real stock capacities only if the product actually has positive stock tracked in DB
      for (let pid of Object.keys(stockChanges)) {
        if (!pid) continue;
        const dbP = availableProducts.find(p => p.id === pid);
        if (dbP && typeof dbP.stock === 'number' && dbP.stock > 0) {
          const resultingStock = Number(dbP.stock || 0) + stockChanges[pid];
          if (resultingStock < 0) {
            toast.error(`Not enough stock for ${dbP.productName} (Available: ${dbP.stock})`);
            setLoading(false);
            return;
          }
        }
      }

      const currentUserName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Admin";

      const invoiceData = {
        invoiceNumber: invoiceNumber,
        customerName: customer.name,
        phone: customer.phone,
        address: "",
        place: "",
        pincode: "",
        products: finalProducts,
        shippingType: "none",
        shippingCharge: 0,
        subtotal: subtotal,
        totalAmount: grandTotal,
        paymentStatus: paymentStatus,
        createdAt: editId ? location.state.editInvoice.createdAt : Date.now(),
        date: displayDateStr,
        invoiceDate: invoiceDate,
        status: editId ? location.state.editInvoice.status : "Completed",
        // Creator identity & role preservation
        createdByUid: editId ? (location.state.editInvoice.createdByUid || currentUser?.uid || "admin_legacy") : (currentUser?.uid || "admin_legacy"),
        createdByName: editId ? (location.state.editInvoice.createdByName || currentUserName) : currentUserName,
        createdByUserId: editId ? (location.state.editInvoice.createdByUserId || userProfile?.userId || "admin") : (userProfile?.userId || "admin"),
        createdByRole: editId ? (location.state.editInvoice.createdByRole || role || "admin") : (role || "admin"),
        ...(editId ? {
          updatedByUid: currentUser?.uid || "admin",
          updatedByName: currentUserName,
          updatedAt: Date.now()
        } : {})
      };

      const updates = {};
      if (editId) {
        updates[`invoices/${editId}`] = invoiceData;
      } else {
        const newInvoiceRef = push(ref(db, "invoices"));
        updates[`invoices/${newInvoiceRef.key}`] = invoiceData;
      }

      for (let pid of Object.keys(stockChanges)) {
        if (!pid) continue;
        const dbP = availableProducts.find(p => p.id === pid);
        if (dbP && typeof dbP.stock === 'number') {
          updates[`products/${pid}/stock`] = Math.max(0, Number(dbP.stock || 0) + stockChanges[pid]);
        }
      }

      await update(ref(db), updates);
      toast.success(editId ? "Invoice Updated Successfully!" : "Luxury Invoice Generated!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });

      if (editId) {
        navigate('/reports');
      } else {
        setCustomer({ name: "", phone: "" });
        setInvoiceProducts([{ id: Date.now(), productId: "", productName: "", price: "", quantity: 1, category: "" }]);
        setPaymentStatus("paid");
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        setInvoiceDate(new Date(d.getTime() - offset).toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save invoice");
    }
    setLoading(false);
  };

  // Helper to generate Invoice PDF from live preview
  const generateInvoicePdf = async () => {
    const element = invoiceRef.current;
    if (!element) {
      throw new Error("Invoice preview element not found");
    }
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const data = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let imgHeight = (canvas.height * pdfWidth) / canvas.width;
    let imgWidth = pdfWidth;

    if (imgHeight > pageHeight) {
      const ratio = pageHeight / imgHeight;
      imgHeight = pageHeight;
      imgWidth = pdfWidth * ratio;
    }

    const offsetX = (pdfWidth - imgWidth) / 2;
    pdf.addImage(data, "PNG", offsetX, 0, imgWidth, imgHeight);
    return pdf;
  };

  // PDF Download
  const downloadPDF = async () => {
    try {
      const pdf = await generateInvoicePdf();
      const formattedInvNum = (invoiceNumber || "100").replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`Bahara_International_Invoice_${formattedInvNum}.pdf`);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 font-['Inter']">
      <Toaster />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">{editId ? "Edit Invoice" : "Create Invoice"}</h1>
          <p className="text-gray-500 mt-2 font-medium">Create premium invoices, manage stock, and generate professional customer billing for Bahara International.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* Left Column - Form */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="xl:col-span-7 space-y-8">

          {/* Customer Details */}
          <motion.div variants={itemVariants} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] blur-[80px] opacity-10 rounded-full group-hover:opacity-20 transition-opacity"></div>
            <h3 className="text-xl font-bold text-[#111] mb-6 tracking-tight flex items-center gap-2"><FiMapPin className="text-[#D4AF37]" /> Customer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <input type="text" name="name" placeholder="Customer Name *" value={customer.name} onChange={handleCustomerChange} className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4" required />
              <input type="tel" name="phone" placeholder="Phone Number *" value={customer.phone} onChange={handleCustomerChange} className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4" required />
            </div>
          </motion.div>

          {/* Order Items */}
          <motion.div variants={itemVariants} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#111] tracking-tight flex items-center gap-2"><FiPackage className="text-[#D4AF37]" /> Order Items</h3>
              <button onClick={addProductRow} className="bg-[#111] text-[#D4AF37] px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-black transition-colors shadow-md cursor-pointer">
                <FiPlus /> Add Product
              </button>
            </div>

              <div className="space-y-4">
                {invoiceProducts.map((p) => (
                  <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-gray-50/70 p-4 rounded-[20px] border border-gray-100 hover:bg-white hover:border-[#D4AF37]/40 transition-colors group">

                    {/* Product Search & Selection / Custom Item input */}
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Item Description / Product</label>
                      <ProductSelector
                        productId={p.productId}
                        productName={p.productName}
                        onSelectProduct={(ap) => handleSelectProductInRow(p.id, ap)}
                        onProductNameChange={(val) => handleCustomProductNameChange(p.id, val)}
                        availableProducts={selectableProducts}
                      />
                    </div>

                  {/* Automatically Populated Price (MANUALLY EDITABLE FOR THIS INVOICE ONLY) */}
                  <div className="w-full md:w-32 relative">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Rate (₹)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-gray-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={p.price}
                        onChange={(e) => updateProductRow(p.id, "price", e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-[#D4AF37]/50 text-sm font-bold text-[#111] rounded-xl p-3.5 pl-8 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>


                  {/* Quantity (EDITABLE) */}
                  <div className="w-full md:w-24 relative">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 text-center">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={p.quantity}
                      onChange={(e) => updateProductRow(p.id, "quantity", e.target.value)}
                      className="w-full bg-white border border-gray-200 focus:border-[#D4AF37]/50 rounded-xl text-sm font-semibold text-[#111] outline-none transition-all p-3.5 text-center"
                      placeholder="Qty"
                    />
                  </div>

                  {/* Line Total */}
                  <div className="w-full md:w-28 text-right pr-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total</p>
                    <span className="font-bold text-[#111] text-lg">₹{(Number(p.price) || 0) * (Number(p.quantity) || 0)}</span>
                  </div>

                  {/* Remove Button */}
                  <button onClick={() => removeProductRow(p.id)} className="w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shrink-0 md:opacity-0 group-hover:opacity-100 cursor-pointer">
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Payment Status & Invoice Date */}
          <motion.div variants={itemVariants} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-[#111] mb-6 tracking-tight flex items-center gap-2">
                  <FiClock className="text-[#D4AF37]" /> Payment Status
                </h3>
                <div className="flex items-center gap-3 bg-gray-50/80 p-2 rounded-2xl border border-gray-100 w-fit">
                  <button type="button" onClick={() => setPaymentStatus("paid")} className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all cursor-pointer ${paymentStatus === "paid" ? "bg-[#111] text-[#D4AF37] shadow-md" : "text-gray-400 hover:text-[#111]"}`}>
                    🟢 Paid
                  </button>
                  <button type="button" onClick={() => setPaymentStatus("pending")} className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all cursor-pointer ${paymentStatus === "pending" ? "bg-orange-50 text-orange-600 shadow-md border border-orange-200/50" : "text-gray-400 hover:text-[#111]"}`}>
                    🟠 Pending
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#111] mb-6 tracking-tight flex items-center gap-2">
                  <FiClock className="text-[#D4AF37]" /> Invoice Date
                </h3>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4"
                  required
                />
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div variants={itemVariants} className="bg-[#111] p-6 rounded-[30px] premium-shadow flex flex-col sm:flex-row gap-4 relative overflow-hidden flex-wrap">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#D4AF37] blur-[70px] opacity-20 rounded-full"></div>
            <button onClick={handleSaveInvoice} disabled={loading} className="flex-1 min-w-[200px] bg-[#D4AF37] text-[#111] px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all shadow-[0_10px_30px_-10px_rgba(212,175,55,0.4)] disabled:opacity-70 z-10 text-lg tracking-wide cursor-pointer">
              {loading ? <FiLoader className="animate-spin text-xl" /> : <><FiSave className="text-xl" /> {editId ? "Update & Save Invoice" : "Generate & Save Invoice"}</>}
            </button>
            <button onClick={downloadPDF} className="bg-white/10 border border-white/5 text-white hover:bg-[#D4AF37] hover:text-[#111] hover:border-[#D4AF37] px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all z-10 cursor-pointer">
              <FiDownload className="text-xl" /> PDF
            </button>
          </motion.div>
        </motion.div>

        {/* Right Column - Invoice Preview */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="xl:col-span-5 flex flex-col h-auto overflow-visible">
          <h3 className="text-xl font-bold text-[#111] tracking-tight mb-6 font-['Poppins']">Live Preview</h3>

          <div className="w-full h-auto overflow-visible">
            <div ref={invoiceRef} className="bg-white w-full h-auto p-6 sm:p-8 flex flex-col relative text-[#111] rounded-[20px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-[#D4AF37]/20 overflow-visible font-['Poppins']">

              {/* Accent Header Bar */}
              <div className="absolute top-0 left-0 w-full h-1.5 sm:p-2 bg-gradient-to-r from-[#111] via-[#1d164a] to-[#111] rounded-t-[20px]"></div>

              {/* Company Logo & Invoice Info */}
              <div className="flex justify-between items-start mt-2 mb-6 gap-6">
                <div className="flex flex-col max-w-[55%]">
                  <img src={logoIcon} alt="Bahara Logo" className="h-12 object-contain object-left mix-blend-multiply" />
                  <h2 className="text-lg font-bold text-[#111] tracking-tight font-['Poppins'] mt-1.5 uppercase">Bahara</h2>
                  <p className="text-[11px] font-semibold text-gray-600 mt-0.5">Mob: 7594990433</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-[#202687] tracking-widest uppercase mb-1.5">Invoice</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">No: <span className="text-[#111]">{invoiceNumber}</span></p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Date: <span className="text-[#111]">{displayDateStr}</span></p>
                </div>
              </div>

              {/* Billed To Customer */}
              <div className="mb-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-[9px] font-bold text-[#202687] uppercase tracking-widest mb-2 border-b border-gray-200 pb-2">Billed To Customer</h3>
                <p className="font-bold text-base mb-0.5 tracking-tight text-[#111] uppercase">{customer.name || "Customer Name"}</p>
                {customer.phone && <p className="text-[11px] text-gray-500 font-semibold">{customer.phone}</p>}
              </div>

              {/* Products Table */}
              <div className="flex-1 overflow-visible mb-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 text-[9px] font-bold uppercase tracking-widest text-[#202687]">Description</th>
                      <th className="pb-2 text-[9px] font-bold uppercase tracking-widest text-[#202687] text-center w-12 sm:w-16">Qty</th>
                      <th className="pb-2 text-[9px] font-bold uppercase tracking-widest text-[#202687] text-right w-20 sm:w-24">Price</th>
                      <th className="pb-2 text-[9px] font-bold uppercase tracking-widest text-[#202687] text-right w-24 sm:w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedProducts.filter(p => p.productName.trim() !== "").length > 0 ? (
                      processedProducts.filter(p => p.productName.trim() !== "").map((p, i) => (
                        <tr key={i} className="transition-colors">
                          <td className="py-3 pr-2 sm:pr-4">
                            <p className="font-bold text-[13px] text-[#111] leading-snug">{p.productName}</p>
                          </td>
                          <td className="py-3 text-center font-bold text-gray-600 text-[13px]">{p.qty}</td>
                          <td className="py-3 text-right font-bold text-gray-600 text-[13px]">₹{p.price}</td>
                          <td className="py-3 text-right font-bold text-[#111] text-[13px]">₹{p.total}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-xs font-semibold text-gray-400">No items added to the invoice yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="ml-auto w-full sm:w-2/3 lg:w-3/4 pt-2 border-t-2 border-[#111]">
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <span>Subtotal</span>
                    <span className="text-[#111]">₹{subtotal}</span>
                  </div>
                  <div className="pt-2 mt-2 flex justify-between items-end border-t border-gray-100">
                    <span className="text-[10px] font-bold text-[#202687] uppercase tracking-widest mb-1">Grand Total</span>
                    <span className="text-3xl font-black text-[#111] tracking-tighter">₹{grandTotal}</span>
                  </div>
                </div>
              </div>
              <h3 className="text-[8px] font-bold text-gray-400 text-center uppercase tracking-widest mt-8">Thank you for choosing Bahara</h3>

              {/* Accent footer Bar */}
              <div className="absolute bottom-0 left-0 w-full h-1.5 sm:p-2 bg-gradient-to-r from-[#111] via-[#322873] to-[#111] rounded-b-[20px]"></div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Invoice;