import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, push, update } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  FiX,
  FiPackage,
  FiCalendar,
  FiFileText,
  FiPlusCircle,
  FiDollarSign,
  FiTrendingUp
} from "react-icons/fi";

export default function AddStockModal({
  isOpen,
  onClose,
  productsList = [],
  preSelectedProduct = null
}) {
  const { currentUser, userProfile } = useAuth();

  const [selectedProductId, setSelectedProductId] = useState("");
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
      setQuantity("");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [isOpen, preSelectedProduct]);

  if (!isOpen) return null;

  const selectedProd = productsList.find((p) => p.id === selectedProductId);
  const qtyAdded = Number(quantity) || 0;

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
      toast.error("Please select a product");
      return;
    }

    if (!quantity || qtyAdded <= 0) {
      toast.error("Please enter a valid stock quantity > 0");
      return;
    }

    setSaving(true);

    try {
      const stockUpdates = {};
      const stockAdditionId = `ADD-${Math.floor(10000 + Math.random() * 90000)}`;

      const prodName = selectedProd?.productName || selectedProd?.name || "Product";
      const category = selectedProd?.category || "General";
      const unitRate = Number(selectedProd?.sellingPrice || selectedProd?.price || 0);
      const totalVal = qtyAdded * unitRate;

      // Stock Addition Record for Stock Management Source of Truth
      const additionRecord = {
        issueNumber: stockAdditionId,
        transferId: stockAdditionId,
        type: "addition",
        from: "Supplier / Warehouse Purchase",
        employeeId: "admin_stock",
        employeeName: "Admin / Central Warehouse",
        date: date || new Date().toISOString().split("T")[0],
        notes: notes ? notes.trim() : "Stock received into Central Warehouse",
        products: [
          {
            productId: selectedProductId,
            productName: prodName,
            category: category,
            quantity: qtyAdded,
            unit: unit || selectedProd?.unit || "units",
            price: unitRate,
            lineValue: totalVal
          }
        ],
        totalQuantity: qtyAdded,
        totalValue: totalVal,

        // Legacy fallbacks
        productId: selectedProductId,
        productName: prodName,
        quantity: qtyAdded,
        unit: unit || selectedProd?.unit || "units",
        price: unitRate,

        createdByUid: currentUser?.uid || "admin",
        createdByName: userProfile?.name || currentUser?.displayName || "Admin",
        createdAt: Date.now()
      };

      // Push to employeeStockIssues & stockTransfers
      const newIssueRef = push(ref(db, "employeeStockIssues"));
      stockUpdates[`employeeStockIssues/${newIssueRef.key}`] = additionRecord;

      const newTransferRef = push(ref(db, "stockTransfers"));
      stockUpdates[`stockTransfers/${newTransferRef.key}`] = additionRecord;

      await update(ref(db), stockUpdates);

      toast.success(
        `Added ${qtyAdded} ${unit} of ${prodName} to Central Warehouse!`,
        { style: { borderRadius: "14px", background: "#111", color: "#D4AF37" } }
      );

      onClose();
    } catch (err) {
      console.error("Error adding central stock:", err);
      toast.error("Failed to record central stock addition");
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
              <FiPlusCircle />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight font-['Poppins']">
                Add Stock to Central Warehouse
              </h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Record new inventory received/purchased into Stock Management
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
              {productsList.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.productName} • Category: {prod.category || "General"}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Received & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiTrendingUp className="text-[#D4AF37]" /> Quantity Received *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="e.g. 20"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#D4AF37] rounded-2xl text-sm font-bold text-[#111] p-3.5 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Unit *
              </label>
              <div className="flex gap-2">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all cursor-pointer"
                >
                  <option value="KG">KG</option>
                  <option value="Gram">Gram</option>
                  <option value="Pack">Pack</option>
                  <option value="Piece">Piece</option>
                  <option value="Box">Box</option>
                  <option value="Litre">Litre</option>
                  <option value="Meter">Meter</option>
                  <option value="Bottle">Bottle</option>
                  <option value="Carton">Carton</option>
                  {!["KG","Gram","Pack","Piece","Box","Litre","Meter","Bottle","Carton"].includes(unit) && (
                    <option value={unit}>{unit}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Date Received */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiCalendar className="text-[#D4AF37]" /> Date Received *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all cursor-pointer"
            />
          </div>

          {/* Supplier / Batch Note */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiFileText className="text-[#D4AF37]" /> Supplier / Batch Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Received 20 KG cardamom batch #402 from supplier"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-medium text-[#111] p-3.5 outline-none transition-all"
            />
          </div>

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
              disabled={saving}
              className="px-7 py-3.5 rounded-2xl bg-[#111] text-[#D4AF37] hover:bg-black font-bold text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FiPlusCircle className="text-sm" />
              {saving ? "Saving..." : "Add Central Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
