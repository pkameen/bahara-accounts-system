import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { ref, onValue, update, remove } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  FiPackage,
  FiX,
  FiAlertTriangle,
  FiSave,
  FiImage,
  FiPlus,
  FiFolder,
  FiFolderPlus,
  FiEdit,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiLayers,
  FiSearch
} from "react-icons/fi";
import ProductCard from "../components/ProductCard";
import CategoryModal from "../components/CategoryModal";
import toast, { Toaster } from "react-hot-toast";

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };

const Products = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Category Management State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("all");

  // Fetch Products
  useEffect(() => {
    const productRef = ref(db, "products");
    const unsubProd = onValue(productRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProducts(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setProducts([]);
      }
      setLoading(false);
    });

    return () => unsubProd();
  }, []);

  // Fetch Categories from Firebase RTDB
  useEffect(() => {
    const catRef = ref(db, "categories");
    const unsubCat = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategories(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setCategories([]);
      }
    });

    return () => unsubCat();
  }, []);

  // Active categories list
  const activeCategories = useMemo(() => {
    return categories.filter((c) => c.status === "active");
  }, [categories]);

  // Filtered categories for Category Manager
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name?.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
        cat.description?.toLowerCase().includes(categorySearchQuery.toLowerCase());
      const matchesStatus =
        categoryStatusFilter === "all" || cat.status === categoryStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, categorySearchQuery, categoryStatusFilter]);

  // Count products assigned to each category
  const productCountPerCategory = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.category) {
        const catKey = p.category.trim().toLowerCase();
        counts[catKey] = (counts[catKey] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Handle Update Product
  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = {
        productName: editingProduct.productName,
        category: editingProduct.category,
        sellingPrice: Number(editingProduct.sellingPrice),
        stock: Number(editingProduct.stock),
        description: editingProduct.description || "",
        status: editingProduct.status || "Available",
        featured: editingProduct.featured || false,
        image: editingProduct.image || ""
      };
      await update(ref(db, `products/${editingProduct.id}`), updates);
      toast.success("Product Updated Successfully", { style: { borderRadius: '14px', background: '#111', color: '#D4AF37' } });
      setEditingProduct(null);
    } catch (error) {
      toast.error("Failed to update product");
      console.error(error);
    }
    setSaving(false);
  };

  // Handle Delete Product
  const handleDelete = async () => {
    try {
      await remove(ref(db, `products/${deletingProductId}`));
      toast.success("Product Deleted Successfully");
      setDeletingProductId(null);
    } catch (error) {
      toast.error("Failed to delete product");
      console.error(error);
    }
  };

  // Toggle Category Status (Activate / Deactivate)
  const handleToggleCategoryStatus = async (cat) => {
    if (!isAdmin) return;
    const newStatus = cat.status === "active" ? "inactive" : "active";
    // eslint-disable-next-line react-hooks/purity
    const nowTime = Date.now();
    try {
      await update(ref(db, `categories/${cat.id}`), {
        status: newStatus,
        updatedAt: nowTime
      });
      toast.success(`Category '${cat.name}' marked as ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to change category status");
    }
  };



  // Safe Category Deletion Check
  const handleDeleteCategory = async (cat) => {
    if (!isAdmin) return;

    // Check if any product is using this category
    const catNameClean = cat.name?.trim().toLowerCase();
    const isUsed = products.some(
      (p) =>
        p.category?.trim().toLowerCase() === catNameClean ||
        p.categoryId === cat.id
    );

    if (isUsed) {
      toast.error(
        "This category is currently used by existing products. Deactivate it instead.",
        { duration: 4000, style: { borderRadius: '14px', background: '#111', color: '#fff' } }
      );
      return;
    }

    try {
      await remove(ref(db, `categories/${cat.id}`));
      toast.success(`Category '${cat.name}' Deleted Successfully`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete category");
    }
  };

  // Image to Base64 (For Edit Modal)
  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditingProduct({ ...editingProduct, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 font-['Inter']">
      <Toaster />

      {/* Header Bar */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">Collection & Categories</h1>
          <p className="text-gray-500 mt-1 font-medium">Manage product inventory and Admin-controlled category structure</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
                className="bg-white border border-gray-200 text-[#111] hover:border-[#D4AF37] hover:text-[#D4AF37] px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm cursor-pointer"
              >
                <FiFolderPlus className="text-lg text-[#D4AF37]" /> + Add Category
              </button>

              <button
                type="button"
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                className={`px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                  showCategoryManager
                    ? "bg-[#D4AF37] text-[#111] shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <FiLayers className="text-lg" /> {showCategoryManager ? "Hide Categories" : "Manage Categories"} ({categories.length})
              </button>
            </>
          )}

          <Link
            to="/add-product"
            className="bg-[#111] text-[#D4AF37] hover:bg-[#222] px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-lg cursor-pointer"
          >
            <FiPlus className="text-lg" /> + Add Product
          </Link>
        </div>
      </motion.div>

      {/* ADMIN CATEGORY MANAGEMENT SECTION */}
      <AnimatePresence>
        {showCategoryManager && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-10 bg-white border border-gray-100 rounded-[30px] p-6 sm:p-8 premium-shadow overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-bold text-[#111] font-['Poppins'] flex items-center gap-2">
                  <FiFolder className="text-[#D4AF37]" /> Category Manager
                </h2>
                <p className="text-xs text-gray-400 font-medium">Create, edit, activate/deactivate, and manage product category collections</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-200">
                  <FiSearch className="text-gray-400 mr-2 text-sm" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Search categories..."
                    className="bg-transparent outline-none text-xs font-semibold text-[#111] w-36 sm:w-48 placeholder-gray-400"
                  />
                </div>

                <select
                  value={categoryStatusFilter}
                  onChange={(e) => setCategoryStatusFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-[#111] outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Category Table */}
            {filteredCategories.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3.5 px-6">Category Name</th>
                      <th className="py-3.5 px-6">Description</th>
                      <th className="py-3.5 px-6">Assigned Products</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-medium">
                    {filteredCategories.map((cat) => {
                      const count = productCountPerCategory[cat.name?.trim().toLowerCase()] || 0;
                      return (
                        <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-[#111]">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-gray-100 text-[#D4AF37] font-bold flex items-center justify-center text-xs">
                                {cat.name?.charAt(0).toUpperCase()}
                              </span>
                              <span>{cat.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-xs text-gray-500 font-normal max-w-xs truncate">
                            {cat.description || "—"}
                          </td>
                          <td className="py-4 px-6 font-bold text-[#111]">
                            <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold">
                              {count} {count === 1 ? "product" : "products"}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                                cat.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  cat.status === "active" ? "bg-green-500" : "bg-red-500"
                                }`}
                              />
                              {cat.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                title="Edit Category"
                                className="p-2 text-gray-400 hover:text-[#D4AF37] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                              >
                                <FiEdit className="text-base" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleCategoryStatus(cat)}
                                title={cat.status === "active" ? "Deactivate Category" : "Activate Category"}
                                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                  cat.status === "active"
                                    ? "text-red-500 hover:bg-red-50"
                                    : "text-green-600 hover:bg-green-50"
                                }`}
                              >
                                {cat.status === "active" ? (
                                  <FiXCircle className="text-base" />
                                ) : (
                                  <FiCheckCircle className="text-base" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                title="Delete Category"
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <FiTrash2 className="text-base" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 font-medium text-sm">
                No categories match your search or filter.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRODUCTS DISPLAY */}
      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111]"></div>
        </div>
      ) : products.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-100 premium-shadow rounded-3xl p-16 text-center max-w-2xl mx-auto">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiPackage className="text-4xl text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#111]">No Collection Found</h2>
          <p className="text-gray-500 mt-3 mb-8">Begin curating your premium inventory catalogue.</p>
          <Link to="/add-product" className="inline-block bg-[#111] text-[#D4AF37] px-8 py-3.5 rounded-full font-bold hover:bg-black transition-colors shadow-lg shadow-black/20">
            Add First Product
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <motion.div
              variants={itemVariants}
              key={product.id}
            >
              <ProductCard 
                product={product} 
                onEdit={(p) => setEditingProduct(p)} 
                onDelete={(id) => setDeletingProductId(id)} 
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[30px] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative font-['Inter']">
            <button onClick={() => setEditingProduct(null)} className="absolute top-6 right-6 text-gray-400 hover:text-[#111] bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors cursor-pointer">
              <FiX className="text-xl" />
            </button>
            <h2 className="text-2xl font-bold text-[#111] mb-6 font-['Poppins']">Edit Product</h2>
            
            <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2 flex flex-col items-center mb-4">
                <div className="w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group hover:border-[#D4AF37]/50 transition-colors">
                  {editingProduct.image ? (
                    <img src={editingProduct.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <FiImage className="text-3xl text-gray-400" />
                  )}
                  <input type="file" accept="image/*" onChange={handleEditImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-3">Tap image to change</span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Product Name</label>
                <input type="text" value={editingProduct.productName} onChange={(e) => setEditingProduct({...editingProduct, productName: e.target.value})} className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-xl text-sm font-semibold text-[#111] p-3 outline-none transition-all" required />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Category / Collection</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-xl text-sm font-semibold text-[#111] p-3 outline-none transition-all cursor-pointer"
                  required
                >
                  <option value="" disabled>Select Category</option>
                  {/* If product has a category not currently active in RTDB, preserve it in the dropdown */}
                  {editingProduct.category && !activeCategories.some(c => c.name === editingProduct.category) && (
                    <option value={editingProduct.category}>{editingProduct.category} (Legacy / Saved)</option>
                  )}
                  {activeCategories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Selling Price (₹)</label>
                <input type="number" min="0" value={editingProduct.sellingPrice} onChange={(e) => setEditingProduct({...editingProduct, sellingPrice: e.target.value})} className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-xl text-sm font-semibold text-[#111] p-3 outline-none transition-all" required />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Stock</label>
                <input type="number" min="0" value={editingProduct.stock} onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value})} className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-xl text-sm font-semibold text-[#111] p-3 outline-none transition-all" required />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
                <select value={editingProduct.status || "Available"} onChange={(e) => setEditingProduct({...editingProduct, status: e.target.value})} className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-xl text-sm font-semibold text-[#111] p-3 outline-none transition-all cursor-pointer">
                  <option value="Available">Available</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Featured</span>
                <input type="checkbox" checked={editingProduct.featured || false} onChange={(e) => setEditingProduct({...editingProduct, featured: e.target.checked})} className="w-5 h-5 accent-[#D4AF37] cursor-pointer" />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Description</label>
                <textarea value={editingProduct.description || ""} onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})} rows="2" className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-xl text-sm font-semibold text-[#111] p-3 outline-none transition-all resize-none"></textarea>
              </div>
              
              <div className="md:col-span-2 pt-4 flex gap-4">
                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#111] text-[#D4AF37] py-4 rounded-xl font-bold hover:bg-black transition-colors flex justify-center items-center gap-2 disabled:opacity-70 cursor-pointer">
                  {saving ? <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div> : <><FiSave /> Save Changes</>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-['Inter']">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[30px] p-8 w-full max-w-md text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiAlertTriangle className="text-4xl" />
            </div>
            <h2 className="text-2xl font-bold text-[#111] mb-2 font-['Poppins']">Delete Product?</h2>
            <p className="text-gray-500 mb-8 font-medium text-sm">Are you sure you want to permanently delete this product? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeletingProductId(null)} className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 cursor-pointer">Delete</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CATEGORY MODAL FOR ADDING / EDITING CATEGORIES */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        categoryToEdit={editingCategory}
        existingCategories={categories}
      />
    </div>
  );
};

export default Products;