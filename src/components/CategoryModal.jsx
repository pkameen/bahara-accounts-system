/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";

import { db } from "../firebase";
import { ref, push, update } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { FiX, FiFolderPlus, FiEdit, FiCheckCircle } from "react-icons/fi";

export default function CategoryModal({
  isOpen,
  onClose,
  categoryToEdit = null,
  existingCategories = [],
  onSuccess
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (categoryToEdit) {

      setName(categoryToEdit.name || "");
      setDescription(categoryToEdit.description || "");
      setStatus(categoryToEdit.status || "active");
    } else {
      setName("");
      setDescription("");
      setStatus("active");
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

    // Duplicate Check (Case-insensitive & trimmed)
    const isDuplicate = existingCategories.some(
      (c) =>
        c.id !== categoryToEdit?.id &&
        c.name?.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      toast.error("Category already exists.");
      return;
    }

    setLoading(true);
    try {
      if (categoryToEdit && categoryToEdit.id) {
        // Edit Mode
        await update(ref(db, `categories/${categoryToEdit.id}`), {
          name: cleanName,
          description: description.trim(),
          status,
          updatedAt: Date.now()
        });
        toast.success(`Category '${cleanName}' updated successfully!`, {
          style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
        });
        if (onSuccess) onSuccess({ id: categoryToEdit.id, name: cleanName });
      } else {
        // Add Mode
        const newRef = push(ref(db, "categories"));
        const newCategoryObj = {
          id: newRef.key,
          name: cleanName,
          description: description.trim(),
          status,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await update(ref(db, `categories/${newRef.key}`), newCategoryObj);
        toast.success(`Category '${cleanName}' created successfully!`, {
          style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
        });
        if (onSuccess) onSuccess(newCategoryObj);
      }

      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-['Inter']">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-400 hover:text-[#111] bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors cursor-pointer"
          >
            <FiX className="text-xl" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-xl shadow-md">
              {categoryToEdit ? <FiEdit /> : <FiFolderPlus />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#111] font-['Poppins']">
                {categoryToEdit ? "Edit Category" : "Add Category"}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                {categoryToEdit ? "Update category details" : "Create a new product collection category"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cardamom, Spices, Dry Fruits"
                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37]/50 rounded-2xl p-4 text-sm font-semibold text-[#111] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Category Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this product collection..."
                rows="2"
                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37]/50 rounded-2xl p-4 text-sm font-semibold text-[#111] outline-none transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Status
              </label>
              <div className="relative flex items-center">
                <FiCheckCircle className="absolute left-4 text-gray-400 pointer-events-none" />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#D4AF37]/50 rounded-2xl p-4 pl-11 text-sm font-bold text-[#111] outline-none transition-all cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#111] text-[#D4AF37] py-4 rounded-2xl font-bold hover:bg-black transition-colors shadow-lg shadow-black/10 disabled:opacity-70 cursor-pointer"
              >
                {loading
                  ? "Saving..."
                  : categoryToEdit
                  ? "Save Changes"
                  : "Add Category"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
