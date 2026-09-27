import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, push, update } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  FiX,
  FiPackage,
  FiUser,
  FiCalendar,
  FiFileText,
  FiSend,
  FiAlertTriangle,
  FiCheckCircle,
  FiTrendingDown
} from "react-icons/fi";

export default function TransferStockModal({
  isOpen,
  onClose,
  employeesList = [],
  productsList = [],
  preSelectedProduct = null
}) {
  const { currentUser, userProfile } = useAuth();

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("units");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (preSelectedProduct) {
        setSelectedProductId(preSelectedProduct.id || "");
        setUnit(preSelectedProduct.unit || "units");
      } else {
        setSelectedProductId("");
      }
      setSelectedEmployeeId("");
      setQuantity("");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [isOpen, preSelectedProduct]);

  if (!isOpen) return null;

  const selectedProd = productsList.find((p) => p.id === selectedProductId);
  const selectedEmp = employeesList.find((emp) => emp.uid === selectedEmployeeId);

  // Admin Available Stock from Stock Management
  const availableAdminStock = Number(selectedProd?.currentAdminStock ?? selectedProd?.stock ?? selectedProd?.companyStock ?? 0);
  const transferQty = Number(quantity) || 0;
  const remainingAdminStock = availableAdminStock - transferQty;
  const isExceedingStock = transferQty > availableAdminStock;

  const handleProductSelect = (pId) => {
    setSelectedProductId(pId);
    const prod = productsList.find((p) => p.id === pId);
    if (prod) {
      setUnit(prod.unit || "units");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error("Please select a product to transfer");
      return;
    }

    if (!selectedEmployeeId) {
      toast.error("Please select an employee to receive the stock");
      return;
    }

    if (!quantity || transferQty <= 0) {
      toast.error("Please enter a valid transfer quantity greater than 0");
      return;
    }

    if (isExceedingStock) {
      toast.error(`Cannot transfer ${transferQty} ${unit}. Available Admin stock is only ${availableAdminStock} ${unit}.`);
      return;
    }

    setSaving(true);

    try {
      const stockUpdates = {};
      const transferIdNumber = `TRF-${Math.floor(10000 + Math.random() * 90000)}`;

      const prodName = selectedProd?.productName || selectedProd?.name || "Product";
      const empName = selectedEmp?.name || selectedEmp?.email || "Employee";
      const category = selectedProd?.category || "General";
      const unitRate = Number(selectedProd?.sellingPrice || selectedProd?.price || 0);
      const totalVal = transferQty * unitRate;

      // 1. Format Stock Movement Record for Stock Management Ledger
      const transferRecord = {
        transferId: transferIdNumber,
        issueNumber: transferIdNumber,
        from: "Admin (Central Stock)",
        employeeId: selectedEmployeeId,
        employeeName: empName,
        date: date || new Date().toISOString().split("T")[0],
        notes: notes ? notes.trim() : "",
        products: [
          {
            productId: selectedProductId,
            productName: prodName,
            category: category,
            quantity: transferQty,
            unit: unit || selectedProd?.unit || "units",
            price: unitRate,
            lineValue: totalVal
          }
        ],
        totalQuantity: transferQty,
        totalValue: totalVal,

        // Legacy fallbacks for compatibility
        productId: selectedProductId,
        productName: prodName,
        quantity: transferQty,
        unit: unit || selectedProd?.unit || "units",
        price: unitRate,

        createdByUid: currentUser?.uid || "admin",
        createdByName: userProfile?.name || currentUser?.displayName || "Admin",
        createdAt: Date.now(),
        type: "transfer"
      };

      // Push to employeeStockIssues (for continuous employee ledger calculation)
      const newIssueRef = push(ref(db, "employeeStockIssues"));
      stockUpdates[`employeeStockIssues/${newIssueRef.key}`] = transferRecord;

      // Push to stockTransfers (permanent movement log)
      const newTransferRef = push(ref(db, "stockTransfers"));
      stockUpdates[`stockTransfers/${newTransferRef.key}`] = transferRecord;

      await update(ref(db), stockUpdates);

      toast.success(
        `Transferred ${transferQty} ${unit} of ${prodName} to ${empName}!`,
        { style: { borderRadius: "14px", background: "#111", color: "#D4AF37" } }
      );

      onClose();
    } catch (err) {
      console.error("Error creating stock transfer:", err);
      toast.error("Failed to complete stock transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-['Inter']">
      <div className="bg-white rounded-[32px] shadow-2xl border border-gray-100 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#111111] text-white p-6 sm:p-7 flex items-center justify-between border-b border-gray-800 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37] blur-[60px] opacity-20 rounded-full pointer-events-none"></div>

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/10 text-[#D4AF37] flex items-center justify-center text-xl border border-white/10 shadow-md">
              <FiSend />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight font-['Poppins']">
                Transfer Stock to Employee
              </h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Deduct from Admin Central Stock & allocate to Employee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer relative z-10"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 overflow-y-auto custom-scrollbar space-y-5 flex-1">
          
          {/* Select Product */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiPackage className="text-[#D4AF37]" /> Select Product *
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all cursor-pointer"
            >
              <option value="">Choose Admin Product...</option>
              {productsList.map((prod) => {
                const stockQty = Number(prod.stock ?? prod.companyStock ?? 0);
                return (
                  <option key={prod.id} value={prod.id}>
                    {prod.productName} • Admin Stock: {stockQty} {prod.unit || "units"}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Select Employee */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiUser className="text-[#D4AF37]" /> Select Employee *
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all cursor-pointer"
            >
              <option value="">Choose Employee...</option>
              {employeesList.map((emp) => (
                <option key={emp.uid} value={emp.uid}>
                  {emp.name || emp.email} ({emp.role || "Employee"})
                </option>
              ))}
            </select>
          </div>

          {/* Transfer Quantity & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiTrendingDown className="text-[#D4AF37]" /> Transfer Quantity *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="e.g. 1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className={`w-full bg-gray-50 border rounded-2xl text-sm font-bold text-[#111] p-3.5 outline-none transition-all ${
                  isExceedingStock ? "border-red-500 focus:border-red-500 bg-red-50/50" : "border-gray-200 focus:border-[#D4AF37]"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Unit
              </label>
              <input
                type="text"
                placeholder="KG / units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all"
              />
            </div>
          </div>

          {/* Transfer Date */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiCalendar className="text-[#D4AF37]" /> Transfer Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all cursor-pointer"
            />
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiFileText className="text-[#D4AF37]" /> Optional Transfer Note
            </label>
            <input
              type="text"
              placeholder="e.g. Cardamom dispatch for field sales"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-medium text-[#111] p-3.5 outline-none transition-all"
            />
          </div>

          {/* LIVE STOCK BREAKDOWN PREVIEW */}
          {selectedProd && (
            <div className={`p-4 rounded-2xl border transition-all ${
              isExceedingStock
                ? "bg-red-50/80 border-red-200 text-red-900"
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-3 pb-2 border-b border-gray-200/60">
                <span>Stock Movement Preview</span>
                <span className="font-['Poppins'] text-[#111]">{selectedProd.productName}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">Admin Available</span>
                  <span className="font-bold text-[#111] font-['Poppins'] text-sm">
                    {availableAdminStock} {unit}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">Transfer Qty</span>
                  <span className="font-bold text-[#D4AF37] font-['Poppins'] text-sm">
                    {transferQty} {unit}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border shadow-sm ${
                  remainingAdminStock < 0 ? "bg-red-100 border-red-300 text-red-700" : "bg-white border-gray-100 text-emerald-700"
                }`}>
                  <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">Remaining Admin</span>
                  <span className="font-bold font-['Poppins'] text-sm">
                    {remainingAdminStock} {unit}
                  </span>
                </div>
              </div>

              {isExceedingStock && (
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600 bg-red-100/80 p-2.5 rounded-xl border border-red-200">
                  <FiAlertTriangle className="text-base shrink-0" />
                  <span>Transfer quantity exceeds available Admin stock ({availableAdminStock} {unit}). Cannot proceed.</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || isExceedingStock}
              className="px-7 py-3.5 rounded-2xl bg-[#111] text-[#D4AF37] hover:bg-black font-bold text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FiSend className="text-sm" />
              {saving ? "Transferring..." : "Confirm Stock Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
