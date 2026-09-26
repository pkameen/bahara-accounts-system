/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";

import { db } from "../firebase";
import { ref, push, update } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { FiX, FiFolderPlus, FiEdit, FiCheckCircle, FiUsers, FiLock } from "react-icons/fi";

export default function ExpenseCategoryModal({
  isOpen,
  onClose,
  categoryToEdit = null,
  existingCategories = [],
  onSuccess
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [allowEmployee, setAllowEmployee] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name || "");
      setDescription(categoryToEdit.description || "");
      setStatus(categoryToEdit.status || "active");
      setAllowEmployee(categoryToEdit.allowEmployee !== false);
    } else {
      setName("");
      setDescription("");
      setStatus("active");
      setAllowEmployee(true);
    }
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      toast.error("Category Name is required");
      return;
    }

    // Check duplicate name
    const exists = existingCategories.some(
      cat => cat.name.toLowerCase() === cleanName.toLowerCase() && cat.id !== categoryToEdit?.id
    );
    if (exists) {
      toast.error(`Category '${cleanName}' already exists.`);
      return;
    }

    setLoading(true);
    try {
      const nowTime = Date.now();
      let createdCatObj = null;

      if (categoryToEdit && categoryToEdit.id) {
        await update(ref(db, `expenseCategories/${categoryToEdit.id}`), {
          name: cleanName,
          description: description.trim(),
          status,
          allowEmployee,
          updatedAt: nowTime
        });
        toast.success("Expense Category Updated", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
        createdCatObj = { id: categoryToEdit.id, name: cleanName, description, status, allowEmployee };
      } else {
        const newRef = push(ref(db, "expenseCategories"));
        const newCategoryData = {
          name: cleanName,
          description: description.trim(),
          status,
          allowEmployee,
          createdAt: nowTime,
          updatedAt: nowTime
        };
        await update(ref(db, `expenseCategories/${newRef.key}`), newCategoryData);
        toast.success(`Expense Category '${cleanName}' Created`, { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
        createdCatObj = { id: newRef.key, ...newCategoryData };
      }

      if (onSuccess) {
        onSuccess(createdCatObj);
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(categoryToEdit ? "Failed to update category" : "Failed to create category");
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-[30px] p-6 sm:p-8 w-full max-w-md shadow-2xl relative border border-gray-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-lg shadow-md">
                {categoryToEdit ? <FiEdit /> : <FiFolderPlus />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#111] font-['Poppins']">
                  {categoryToEdit ? "Edit Expense Category" : "Add Expense Category"}
                </h3>
                <p className="text-xs text-gray-400 font-medium">
                  {categoryToEdit ? "Modify category details & permissions" : "Create dynamic expense category"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
            >
              <FiX />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Category Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Courier, Travel, Marketing"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-3.5"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Description <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                placeholder="Brief description of expenses for this category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-sm font-medium text-[#111] outline-none transition-all p-3.5 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    status === "active"
                      ? "bg-[#111] text-[#D4AF37] border-[#111] shadow-md"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <FiCheckCircle className={status === "active" ? "text-[#D4AF37]" : "text-gray-400"} />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("inactive")}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    status === "inactive"
                      ? "bg-red-500 text-white border-red-500 shadow-md"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Employee Access</span>
                <span className="text-[10px] text-gray-400 font-normal">Employee visibility</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAllowEmployee(true)}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    allowEmployee
                      ? "bg-[#111] text-[#D4AF37] border-[#111] shadow-md"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <FiUsers className={allowEmployee ? "text-[#D4AF37]" : "text-gray-400"} />
                  Authorized
                </button>
                <button
                  type="button"
                  onClick={() => setAllowEmployee(false)}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    !allowEmployee
                      ? "bg-amber-600 text-white border-amber-600 shadow-md"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <FiLock className={!allowEmployee ? "text-white" : "text-gray-400"} />
                  Admin Only
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3.5 rounded-2xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#111] hover:bg-black text-[#D4AF37] py-3.5 rounded-2xl font-bold text-sm transition-colors shadow-lg disabled:opacity-70"
              >
                {loading ? "Saving..." : categoryToEdit ? "Update Category" : "Add Category"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
