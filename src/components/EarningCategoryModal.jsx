/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, push, update } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { FiX, FiFolderPlus, FiEdit, FiCheckCircle, FiInfo } from "react-icons/fi";
import { CLASSIFICATIONS } from "../utils/earningClassifications";

export default function EarningCategoryModal({
  isOpen,
  onClose,
  categoryToEdit = null,
  existingCategories = [],
  onSuccess
}) {
  const [name, setName] = useState("");
  const [classification, setClassification] = useState("OTHER_INCOME");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name || "");
      setClassification(categoryToEdit.classification || "OTHER_INCOME");
      setDescription(categoryToEdit.description || "");
      setStatus(categoryToEdit.status || "active");
    } else {
      setName("");
      setClassification("OTHER_INCOME");
      setDescription("");
      setStatus("active");
    }
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, ' ');

    if (!cleanName) {
      toast.error("Category Name is required");
      return;
    }

    if (!classification) {
      toast.error("Please select an Accounting Classification");
      return;
    }

    // Check duplicate name (ignoring capitalization and unnecessary spaces)
    const exists = existingCategories.some(
      cat => (cat.name || "").trim().replace(/\s+/g, ' ').toLowerCase() === cleanName.toLowerCase() && cat.id !== categoryToEdit?.id
    );
    if (exists) {
      toast.error(`Category '${cleanName}' already exists.`);
      return;
    }

    setLoading(true);
    try {
      const nowTime = Date.now();
      let savedCat = null;

      if (categoryToEdit && categoryToEdit.id) {
        const updateData = {
          name: cleanName,
          classification,
          description: description.trim(),
          status,
          updatedAt: nowTime
        };
        await update(ref(db, `earningCategories/${categoryToEdit.id}`), updateData);
        toast.success("Earning Category Updated", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
        savedCat = { id: categoryToEdit.id, ...updateData };
      } else {
        const newRef = push(ref(db, "earningCategories"));
        const newCategoryData = {
          name: cleanName,
          classification,
          description: description.trim(),
          status,
          createdAt: nowTime,
          updatedAt: nowTime
        };
        await update(ref(db, `earningCategories/${newRef.key}`), newCategoryData);
        toast.success(`Earning Category '${cleanName}' Created`, { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
        savedCat = { id: newRef.key, ...newCategoryData };
      }

      if (onSuccess) {
        onSuccess(savedCat);
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(categoryToEdit ? "Failed to update category" : "Failed to create category");
    }
    setLoading(false);
  };

  const selectedClassificationMeta = CLASSIFICATIONS.find(c => c.id === classification);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-xl shadow-2xl relative border border-gray-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-400 hover:text-[#111] transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <FiX className="text-xl" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-xl shadow-lg border border-gray-800">
              {categoryToEdit ? <FiEdit /> : <FiFolderPlus />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111] font-['Poppins']">
                {categoryToEdit ? "Edit Earning Category" : "Add Earning Category"}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Configure category with strict accounting classification
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Category Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Other Income, GST Refund, Credit Recovery, Partner Capital"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] p-3.5 outline-none transition-all"
                required
              />
            </div>

            {/* Accounting Classification */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Accounting Classification *
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-bold text-[#111] p-3.5 cursor-pointer outline-none transition-all"
                required
              >
                {CLASSIFICATIONS.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.label}
                  </option>
                ))}
              </select>

              {/* Classification helper text */}
              {selectedClassificationMeta && (
                <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-start gap-2.5 text-xs text-amber-900">
                  <FiInfo className="text-base text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">
                    {selectedClassificationMeta.description}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Description / Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Provide details on when to use this earning category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:bg-white focus:border-[#D4AF37] rounded-2xl text-xs font-medium text-[#111] p-3.5 outline-none transition-all resize-none"
              />
            </div>

            {/* Status (Active / Inactive) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Status
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all border ${status === "active"
                      ? "bg-green-50 text-green-700 border-green-300 shadow-sm"
                      : "bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-700"
                    }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("inactive")}
                  className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all border ${status === "inactive"
                      ? "bg-red-50 text-red-700 border-red-300 shadow-sm"
                      : "bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-700"
                    }`}
                >
                  Inactive
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-2xl font-bold text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-2xl font-bold text-xs bg-[#111] hover:bg-black text-[#D4AF37] shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <FiCheckCircle className="text-sm" />
                {loading ? "Saving..." : categoryToEdit ? "Update Category" : "Save Category"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
