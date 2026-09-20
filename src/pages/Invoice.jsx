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
  FiShare2,
  FiClock,
  FiAlertTriangle
} from "react-icons/fi";
import logoIcon from '../assets/bahara.logo.jpg';  

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

// Custom Searchable Product Selector enforcing Admin Products selection ONLY
const ProductSelector = ({ selectedProductId, selectedProductName, onSelectProduct, availableProducts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
    (ap) => ap.id === selectedProductId || ap.productName === selectedProductName
  );

  const filteredProducts = availableProducts.filter((ap) =>
    ap.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ap.category && ap.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {selectedProduct ? (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <FiPackage className="text-[#D4AF37] shrink-0" />
            <div className="truncate">
              <span className="font-bold text-sm text-[#111] block truncate">{selectedProduct.productName}</span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase">
                {selectedProduct.category || "General"} • Stock: {selectedProduct.stock ?? "N/A"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectProduct(null);
              setSearchTerm("");
              setIsOpen(true);
            }}
            className="text-xs font-bold text-[#D4AF37] hover:underline shrink-0 ml-2 cursor-pointer"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly={availableProducts.length === 0}
              placeholder={
                availableProducts.length === 0
                  ? "No products available. Please add products from Admin."
                  : "Search & Select Product ▼"
              }
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => {
                if (availableProducts.length > 0) setIsOpen(true);
              }}
              className={`w-full bg-white border border-gray-200 focus:border-[#D4AF37]/50 rounded-xl text-sm font-semibold text-[#111] outline-none transition-all p-3.5 pr-10 ${
                availableProducts.length === 0 ? "bg-gray-100 cursor-not-allowed text-gray-400" : ""
              }`}
            />
            <FiPackage className="absolute right-3.5 text-gray-400 pointer-events-none" />
          </div>

          {isOpen && availableProducts.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((ap) => (
                  <div
                    key={ap.id}
                    onClick={() => {
                      onSelectProduct(ap);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className="p-3.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-sm text-[#111]">{ap.productName}</div>
                      <div className="text-xs text-gray-400">
                        {ap.category || "General"} • Stock: {ap.stock ?? "N/A"}
                      </div>
                    </div>
                    <div className="font-bold text-sm text-[#D4AF37]">₹{ap.sellingPrice}</div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs font-semibold text-gray-400">
                  No matching product found.
                </div>
              )}
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
    phone: "",
    address: "",
    place: "",
    pincode: ""
  });
  const [editId, setEditId] = useState(null);

  const [invoiceProducts, setInvoiceProducts] = useState([
    { id: 1, productId: "", productName: "", price: "", quantity: 1, category: "" }
  ]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("BHR-100");
  const [loading, setLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
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

  // Filter selectable products for new invoices (exclude Out of Stock items for new invoices)
  const selectableProducts = availableProducts.filter(ap => {
    if (editId) return true; // Include all items when editing
    return ap.status !== "Out of Stock";
  });

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
        phone: editInvoice.phone || "",
        address: editInvoice.address || "",
        place: editInvoice.place || "",
        pincode: editInvoice.pincode || "",
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

  // Auto-detect Post Office & District via India Pincode API
  const handlePincodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCustomer({ ...customer, pincode: val });

    if (val.length === 6) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === "Success") {
          const postOffice = data[0].PostOffice[0];
          setCustomer(prev => ({
            ...prev,
            place: `${postOffice.Name}, ${postOffice.District}`
          }));
          toast.success(`Location matched: ${postOffice.District}`, { icon: '📍', style: { borderRadius: '14px', background: '#111', color: '#fff' }});
        } else {
          toast.error("Invalid Pincode", { style: { borderRadius: '14px', background: '#111', color: '#fff' }});
        }
      } catch {
        toast.error("Failed to verify pincode");
      }
      setPincodeLoading(false);
    }
  };

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

    // STRICT VALIDATION: All products MUST come from Admin Products
    const invalidProducts = processedProducts.filter(p => !p.productId || !p.productName.trim() || Number(p.price) <= 0 || Number(p.qty) <= 0);
    if (invalidProducts.length > 0) {
      toast.error("Please select a valid product from Admin → Products for all item rows", {
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
      
      // Subtract newly defined quantities
      processedProducts.forEach(newP => {
        if (newP.productId) {
          stockChanges[newP.productId] = (stockChanges[newP.productId] || 0) - Number(newP.qty);
        }
      });

      // Validate real stock capacities before saving
      for (let pid of Object.keys(stockChanges)) {
        if (!pid) continue;
        const dbP = availableProducts.find(p => p.id === pid);
        if (dbP) {
          const resultingStock = Number(dbP.stock || 0) + stockChanges[pid];
          if (resultingStock < 0) {
            toast.error(`Not enough stock for ${dbP.productName} (Shortfall: ${Math.abs(resultingStock)})`);
            setLoading(false);
            return;
          }
        }
      }

      const finalProducts = processedProducts.map((p) => {
        const productGrandTotal = p.total;
        const matchedDbProduct = availableProducts.find(ap => ap.id === p.productId);

        return {
          productId: p.productId,
          customerName: customer.name,
          productName: p.productName,
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

      const currentUserName = userProfile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Admin";

      const invoiceData = {
        invoiceNumber: invoiceNumber,
        customerName: customer.name,
        phone: customer.phone,
        address: customer.address,
        place: customer.place,
        pincode: customer.pincode,
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
        const dbP = availableProducts.find(p => p.id === pid);
        if (dbP) {
          updates[`products/${pid}/stock`] = Number(dbP.stock || 0) + stockChanges[pid];
        }
      }

      await update(ref(db), updates);
      toast.success(editId ? "Invoice Updated Successfully!" : "Luxury Invoice Generated!", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }});

      if (editId) {
        navigate('/reports');
      } else {
        setCustomer({ name: "", phone: "", address: "", place: "", pincode: "" });
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

  // Native Share & Fallback
  const handleShare = async () => {
    setIsSharing(true);
    try {
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, { scale: 3, useCORS: true });
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
      
      const pdfFilename = `${invoiceNumber.replace('-', ' -')}.pdf`;
      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], pdfFilename, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoiceNumber}`,  
        });
      } else {
        pdf.save(pdfFilename);
        toast("Sharing not supported on this device", {
          icon: '⚠️',
          style: { borderRadius: '14px', background: '#111', color: '#D4AF37' }
        });
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error sharing:", error);
        toast.error("Failed to share invoice");
      }
    }
    setIsSharing(false);
  };

  // PDF Download
  const downloadPDF = async () => {
    const element = invoiceRef.current;
    const canvas = await html2canvas(element, { scale: 3, useCORS: true });
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
    pdf.save(`Bahara_International_Invoice_${invoiceNumber}.pdf`);
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
              <div className="md:col-span-2 flex flex-col md:flex-row gap-6">
                <input type="text" name="name" placeholder="Customer Name *" value={customer.name} onChange={handleCustomerChange} className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4" required />
                <input type="tel" name="phone" placeholder="Phone Number *" value={customer.phone} onChange={handleCustomerChange} className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4" required />
              </div>
              <div className="md:col-span-2">
                <textarea name="address" placeholder="Full Postal Address" value={customer.address} onChange={handleCustomerChange} rows="2" className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 resize-none"></textarea>
              </div>
              <div className="relative group/input">
                <input type="text" name="pincode" placeholder="Pincode (Auto Detect)" value={customer.pincode} onChange={handlePincodeChange} maxLength={6} className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4" />
                {pincodeLoading && <FiLoader className="absolute right-4 top-4 text-lg text-[#D4AF37] animate-spin" />}
              </div>
              <input type="text" name="place" placeholder="Post Office / District" value={customer.place} onChange={handleCustomerChange} className="w-full bg-gray-50 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4" />
            </div>
          </motion.div>

          {/* Order Items */}
          <motion.div variants={itemVariants} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#111] tracking-tight flex items-center gap-2"><FiPackage className="text-[#D4AF37]"/> Order Items</h3>
              <button onClick={addProductRow} className="bg-[#111] text-[#D4AF37] px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-black transition-colors shadow-md cursor-pointer">
                <FiPlus/> Add Product
              </button>
            </div>

            {/* Warning Banner if No Products Available in Admin -> Products */}
            {selectableProducts.length === 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-sm font-semibold">
                <FiAlertTriangle className="text-xl text-amber-600 shrink-0" />
                <span>
                  {role === "employee"
                    ? "No products available. Please contact administrator to add products from Admin → Products before creating an invoice."
                    : "No products available. Please add products from Admin → Products before creating an invoice."}
                </span>
              </div>
            )}

            <div className="space-y-4">
              {invoiceProducts.map((p) => (
                <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-gray-50/70 p-4 rounded-[20px] border border-gray-100 hover:bg-white hover:border-[#D4AF37]/40 transition-colors group">
                  
                  {/* Product Search & Selection (Admin Products ONLY) */}
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Product (Admin Catalog)</label>
                    <ProductSelector
                      selectedProductId={p.productId}
                      selectedProductName={p.productName}
                      onSelectProduct={(ap) => handleSelectProductInRow(p.id, ap)}
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
          <motion.div variants={itemVariants} className="bg-[#111] p-6 rounded-[30px] premium-shadow flex flex-col sm:flex-row gap-4 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#D4AF37] blur-[70px] opacity-20 rounded-full"></div>
            <button onClick={handleSaveInvoice} disabled={loading} className="flex-1 bg-[#D4AF37] text-[#111] px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all shadow-[0_10px_30px_-10px_rgba(212,175,55,0.4)] disabled:opacity-70 z-10 text-lg tracking-wide cursor-pointer">
              {loading ? <FiLoader className="animate-spin text-xl"/> : <><FiSave className="text-xl"/> {editId ? "Update & Save Invoice" : "Generate & Save Invoice"}</>}
            </button>
          <button onClick={handleShare} disabled={isSharing} className="bg-white/10 border border-white/5 text-white hover:bg-[#D4AF37] hover:text-[#111] hover:border-[#D4AF37] px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all z-10 disabled:opacity-70 cursor-pointer">
            {isSharing ? <FiLoader className="animate-spin text-xl"/> : <><FiShare2 className="text-xl"/> Share</>}
            </button>
          <button onClick={downloadPDF} className="bg-white/10 border border-white/5 text-white hover:bg-[#D4AF37] hover:text-[#111] hover:border-[#D4AF37] px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all z-10 cursor-pointer">
              <FiDownload className="text-xl"/> PDF
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
                {customer.address && <p className="text-[11px] text-gray-500 font-semibold mt-0.5 leading-relaxed">{customer.address}</p>}
                {(customer.place || customer.pincode) && <p className="text-[11px] text-gray-500 font-semibold mt-0.5">{customer.place} {customer.pincode && `- ${customer.pincode}`}</p>}
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