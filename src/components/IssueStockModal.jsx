import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, push, update } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { FiX, FiPackage, FiUser, FiCalendar, FiFileText, FiSave, FiPlus, FiTrash2, FiDollarSign, FiLayers } from "react-icons/fi";

export default function IssueStockModal({
  isOpen,
  onClose,
  employeesList = [],
  productsList = [],
  editingIssue = null
}) {
  const { currentUser, userProfile } = useAuth();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([
    { id: 1, productId: "", productName: "", quantity: 1, unit: "units", price: 0, lineValue: 0 }
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingIssue) {
      setSelectedEmployeeId(editingIssue.employeeId || "");
      setDate(editingIssue.date || new Date().toISOString().split("T")[0]);
      setNotes(editingIssue.notes || "");

      if (Array.isArray(editingIssue.products) && editingIssue.products.length > 0) {
        setItems(
          editingIssue.products.map((p, idx) => ({
            id: p.id || Date.now() + idx,
            productId: p.productId || "",
            productName: p.productName || "",
            quantity: p.quantity || 1,
            unit: p.unit || "units",
            price: p.price || 0,
            lineValue: (p.quantity || 1) * (p.price || 0)
          }))
        );
      } else if (editingIssue.productId) {
        setItems([
          {
            id: Date.now(),
            productId: editingIssue.productId,
            productName: editingIssue.productName || "",
            quantity: editingIssue.quantity || 1,
            unit: editingIssue.unit || "units",
            price: editingIssue.price || 0,
            lineValue: (editingIssue.quantity || 1) * (editingIssue.price || 0)
          }
        ]);
      }
    } else {
      setSelectedEmployeeId("");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setItems([{ id: Date.now(), productId: "", productName: "", quantity: 1, unit: "units", price: 0, lineValue: 0 }]);
    }
  }, [editingIssue, isOpen]);

  if (!isOpen) return null;

  const handleAddProductRow = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), productId: "", productName: "", quantity: 1, unit: "units", price: 0, lineValue: 0 }
    ]);
  };

  const handleRemoveProductRow = (id) => {
    if (items.length <= 1) {
      toast.error("At least one product is required in a stock issue transaction");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectProduct = (rowId, productId) => {
    const selectedProd = productsList.find((p) => p.id === productId);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          const price = Number(selectedProd?.sellingPrice || selectedProd?.price || 0);
          const unit = selectedProd?.unit || "units";
          const qty = item.quantity || 1;
          return {
            ...item,
            productId: productId,
            productName: selectedProd?.productName || selectedProd?.name || "",
            unit: unit,
            price: price,
            lineValue: qty * price
          };
        }
        return item;
      })
    );
  };

  const handleItemChange = (rowId, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "price") {
            const qty = Number(field === "quantity" ? value : item.quantity) || 0;
            const price = Number(field === "price" ? value : item.price) || 0;
            updated.lineValue = qty * price;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalTransactionValue = items.reduce((sum, item) => sum + (Number(item.lineValue) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        toast.error(`Please select a product for row #${i + 1}`);
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        toast.error(`Please enter a valid quantity > 0 for row #${i + 1}`);
        return;
      }
    }

    const selectedEmp = employeesList.find((emp) => emp.uid === selectedEmployeeId);
    const empName = selectedEmp?.name || "Employee";

    setSaving(true);

    try {
      const stockUpdates = {};
      const stockIssueNumber = editingIssue?.issueNumber || `STK-${Math.floor(10000 + Math.random() * 90000)}`;

      // Format line items
      const formattedProducts = items.map((item) => {
        const prodObj = productsList.find((p) => p.id === item.productId);
        const price = Number(item.price || prodObj?.sellingPrice || 0);
        const qty = Number(item.quantity) || 1;
        return {
          productId: item.productId,
          productName: prodObj?.productName || prodObj?.name || item.productName || "Product",
          category: prodObj?.category || "General",
          quantity: qty,
          unit: item.unit || prodObj?.unit || "units",
          price: price,
          lineValue: qty * price
        };
      });

      // Calculate stock changes for Central Company Stock
      const netCentralStockChanges = {};

      // If editing existing stock issue, credit back old items first
      if (editingIssue) {
        const oldProducts = Array.isArray(editingIssue.products) && editingIssue.products.length > 0
          ? editingIssue.products
          : (editingIssue.productId ? [{ productId: editingIssue.productId, quantity: editingIssue.quantity }] : []);

        oldProducts.forEach((oldP) => {
          if (oldP.productId) {
            netCentralStockChanges[oldP.productId] = (netCentralStockChanges[oldP.productId] || 0) + Number(oldP.quantity || 0);
          }
        });
      }

      // Deduct new issued items
      formattedProducts.forEach((newP) => {
        if (newP.productId) {
          netCentralStockChanges[newP.productId] = (netCentralStockChanges[newP.productId] || 0) - Number(newP.quantity || 0);
        }
      });

      // Stock issue ledger entries will serve as source of truth

      const issueData = {
        issueNumber: stockIssueNumber,
        employeeId: selectedEmployeeId,
        employeeName: empName,
        date: date || new Date().toISOString().split("T")[0],
        notes: notes ? notes.trim() : "",
        products: formattedProducts,
        totalQuantity: totalQuantity,
        totalValue: totalTransactionValue,
        // Legacy fallback properties for first product
        productId: formattedProducts[0].productId,
        productName: formattedProducts[0].productName,
        quantity: totalQuantity,
        unit: formattedProducts[0].unit,
        price: formattedProducts[0].price,

        createdByUid: currentUser?.uid || "admin",
        createdByName: userProfile?.name || currentUser?.displayName || "Admin",
        createdAt: editingIssue?.createdAt || Date.now(),
        updatedAt: Date.now(),
        type: "issue"
      };

      if (editingIssue && editingIssue.id) {
        stockUpdates[`employeeStockIssues/${editingIssue.id}`] = issueData;
      } else {
        const newIssueRef = push(ref(db, "employeeStockIssues"));
        stockUpdates[`employeeStockIssues/${newIssueRef.key}`] = issueData;
      }

      await update(ref(db), stockUpdates);

      toast.success(
        editingIssue
          ? `Stock Issue ${stockIssueNumber} updated successfully!`
          : `Issued ${totalQuantity} units (${formattedProducts.length} items) to ${empName}`,
        { style: { borderRadius: "14px", background: "#111", color: "#D4AF37" } }
      );

      onClose();
    } catch (err) {
      console.error("Error saving stock issue transaction:", err);
      toast.error("Failed to save stock issue transaction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-[32px] shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#111111] text-white p-6 sm:p-7 flex items-center justify-between border-b border-gray-800 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37] blur-[60px] opacity-20 rounded-full pointer-events-none"></div>

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/10 text-[#D4AF37] flex items-center justify-center text-xl border border-white/10 shadow-md">
              <FiPackage />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight font-['Poppins']">
                {editingIssue ? `Edit Stock Bill (${editingIssue.issueNumber || editingIssue.id})` : "Issue Stock to Employee"}
              </h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Multi-product inventory allocation bill
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          
          {/* Employee & Issue Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiCalendar className="text-[#D4AF37]" /> Issue Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] p-3.5 outline-none transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Product Items Table Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <FiLayers className="text-[#D4AF37]" /> Stock Issue Products List *
              </label>
              <span className="text-[11px] text-gray-400 font-semibold">
                Select from Product Master only
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedProd = productsList.find((p) => p.id === item.productId);
                const availableCompanyStock = Number(selectedProd?.stock ?? selectedProd?.companyStock ?? 0);

                return (
                  <div
                    key={item.id}
                    className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200 hover:border-[#D4AF37]/40 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Item #{index + 1}
                      </span>
                      {selectedProd && (
                        <span className="text-[11px] font-semibold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                          Central Stock: <span className="font-bold text-[#111]">{availableCompanyStock} units</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Product Selector */}
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Product *
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleSelectProduct(item.id, e.target.value)}
                          required
                          className="w-full bg-white border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl text-xs font-semibold text-[#111] p-3 outline-none transition-all cursor-pointer"
                        >
                          <option value="">Choose Admin Product...</option>
                          {productsList.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.productName} • ₹{prod.sellingPrice || 0} ({prod.category || "General"})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Issue Qty *
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                          required
                          className="w-full bg-white border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl text-xs font-bold text-[#111] p-3 outline-none transition-all text-center"
                        />
                      </div>

                      {/* Unit */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          placeholder="units"
                          value={item.unit}
                          onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                          className="w-full bg-white border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl text-xs font-semibold text-[#111] p-3 outline-none transition-all"
                        />
                      </div>

                      {/* Rate */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.price}
                          onChange={(e) => handleItemChange(item.id, "price", e.target.value)}
                          className="w-full bg-white border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-xl text-xs font-bold text-[#111] p-3 outline-none transition-all text-right"
                        />
                      </div>

                      {/* Line Value & Remove */}
                      <div className="sm:col-span-1 flex items-center justify-end pb-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveProductRow(item.id)}
                          className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Remove Row"
                        >
                          <FiTrash2 className="text-sm" />
                        </button>
                      </div>
                    </div>

                    {/* Line Total Summary */}
                    <div className="text-right text-xs font-semibold text-gray-500 pt-1 border-t border-gray-200/50">
                      Line Stock Value: <span className="font-bold text-[#111] font-['Poppins']">₹{(Number(item.lineValue) || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* + Add Product Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddProductRow}
                className="w-full sm:w-auto bg-gray-100 hover:bg-[#111] text-gray-800 hover:text-[#D4AF37] border border-gray-200 px-5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <FiPlus className="text-sm text-[#D4AF37]" /> + Add Product
              </button>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FiFileText className="text-[#D4AF37]" /> Notes / Batch Details
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Morning van load allocation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 hover:border-[#D4AF37]/50 focus:border-[#D4AF37] rounded-2xl text-sm font-medium text-[#111] p-3.5 outline-none transition-all resize-none"
            ></textarea>
          </div>

          {/* Summary Bar */}
          <div className="bg-[#111111] text-white p-4 rounded-2xl flex items-center justify-between gap-4 text-xs font-bold border border-gray-800">
            <div>
              <span className="text-gray-400 block uppercase text-[10px] tracking-widest">Total Transaction Items</span>
              <span className="text-sm font-bold text-white font-['Poppins']">
                {items.length} product(s) • {totalQuantity} total units
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block uppercase text-[10px] tracking-widest">Total Stock Issue Value</span>
              <span className="text-lg font-bold text-[#D4AF37] font-['Poppins']">
                ₹{totalTransactionValue.toLocaleString('en-IN')}
              </span>
            </div>
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
              <FiSave className="text-sm" />
              {saving ? "Saving..." : editingIssue ? "Update Stock Bill" : "Save Stock Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
