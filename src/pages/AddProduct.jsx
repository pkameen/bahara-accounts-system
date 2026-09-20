import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, push, onValue } from "firebase/database";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { 
  FiPackage, 
  FiDollarSign, 
  FiLayers, 
  FiImage, 
  FiAlignLeft, 
  FiCheckCircle, 
  FiStar,
  FiFolderPlus,
  FiAlertTriangle
} from "react-icons/fi";

import toast, { Toaster } from "react-hot-toast";
import CategoryModal from "../components/CategoryModal";

const AddProduct = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [categories, setCategories] = useState([]);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);

  const [product, setProduct] = useState({
    productName: "",
    category: "",
    sellingPrice: "",
    stock: "",
    description: "",
    status: "Available",
    featured: false,
    image: "",
  });

  const [loading, setLoading] = useState(false);

  // Fetch Categories real-time from Firebase RTDB
  useEffect(() => {
    const catRef = ref(db, "categories");
    const unsub = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategories(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setCategories([]);
      }
    });

    return () => unsub();
  }, []);

  // Filter Active Categories Only for New Product creation
  const activeCategories = categories.filter((c) => c.status === "active");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProduct({
      ...product,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Convert Image to Base64
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProduct({ ...product, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !product.productName ||
      !product.category ||
      !product.sellingPrice || 
      !product.stock
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const productRef = ref(db, "products");
      const matchedCategory = categories.find((c) => c.name === product.category);

      await push(productRef, {
        ...product,
        categoryId: matchedCategory?.id || "",
        sellingPrice: Number(product.sellingPrice),
        stock: Number(product.stock),
        createdAt: Date.now(),
      });

      toast.success("Product Added Successfully", {
        style: { borderRadius: "14px", background: "#111", color: "#D4AF37" }
      });

      setProduct({
        productName: "",
        category: "",
        sellingPrice: "",
        stock: "",
        description: "",
        status: "Available",
        featured: false,
        image: "",
      });
    } catch (error) {
      toast.error("Failed to add product");
      console.log(error);
    }
    setLoading(false);
  };

  // Auto select category after adding new one from modal
  const handleCategoryCreated = (newCat) => {
    if (newCat && newCat.name) {
      setProduct((prev) => ({ ...prev, category: newCat.name }));
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 font-['Inter']">
      <Toaster />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <h1 className="text-4xl font-bold text-[#111] tracking-tight font-['Poppins']">New Product</h1>
        <p className="text-gray-500 mt-2 font-medium">Add a new Product to your luxury Bahara collection.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-8 max-w-5xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Image Upload */}
          <div className="lg:col-span-4 space-y-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Product Image</label>
            <div className="w-full aspect-[4/5] bg-gray-50 rounded-[20px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-gray-100 hover:border-[#D4AF37]/50 transition-all">
              {product.image ? (
                <img src={product.image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-gray-400 gap-2">
                  <FiImage className="text-4xl" />
                  <span className="text-sm font-semibold">Upload Image</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            {product.image && (
              <button type="button" onClick={() => setProduct({...product, image: ""})} className="text-xs font-bold text-red-500 hover:text-red-600 w-full text-center mt-2 cursor-pointer">
                Remove Image
              </button>
            )}
          </div>

          {/* Right Column: Form Fields */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Product Name */}
            <div className="md:col-span-2 relative group/input">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Product Name *</label>
              <div className="relative flex items-center">
                <FiPackage className="absolute left-4 text-gray-400 group-focus-within/input:text-[#D4AF37] transition-colors" />
                <input type="text" name="productName" placeholder="e.g. Premium Cardamom / Black Pepper" value={product.productName} onChange={handleChange} className="w-full bg-gray-50/80 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 pl-11" required />
              </div>
            </div>

            {/* Dynamic Category Selector */}
            <div className="relative group/input md:col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Category *</label>
                {isAdmin && (
                  <button 
                    type="button" 
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    className="text-[11px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FiFolderPlus /> + Add Category
                  </button>
                )}
              </div>

              {/* Warning Banner if No Active Categories exist */}
              {activeCategories.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="text-lg text-amber-600 shrink-0" />
                    <span>No categories available. Please create a category before adding a product.</span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryModalOpen(true)}
                      className="bg-[#111] text-[#D4AF37] px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-black cursor-pointer"
                    >
                      + Add Category
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative flex items-center">
                  <FiLayers className="absolute left-4 text-gray-400 group-focus-within/input:text-[#D4AF37] transition-colors z-10 pointer-events-none" />
                  <select
                    name="category"
                    value={product.category}
                    onChange={(e) => {
                      if (e.target.value === "__ADD_NEW__") {
                        setIsAddCategoryModalOpen(true);
                      } else {
                        handleChange(e);
                      }
                    }}
                    className="w-full bg-gray-50/80 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 pl-11 appearance-none cursor-pointer relative z-0"
                    required
                  >
                    <option value="" disabled>Select Category</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    {isAdmin && (
                      <option value="__ADD_NEW__" className="font-bold text-[#D4AF37]">
                        + Add Category...
                      </option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="relative group/input">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Status *</label>
              <div className="relative flex items-center">
                <FiCheckCircle className="absolute left-4 text-gray-400 group-focus-within/input:text-[#D4AF37] transition-colors z-10" />
                <select name="status" value={product.status} onChange={handleChange} className="w-full bg-gray-50/80 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 pl-11 appearance-none cursor-pointer relative z-0" required>
                  <option value="Available">Available</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
            </div>

            {/* Selling Price */}
            <div className="relative group/input">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Selling Price (₹) *</label>
              <div className="relative flex items-center">
                <FiDollarSign className="absolute left-4 text-gray-400 group-focus-within/input:text-[#D4AF37] transition-colors" />
                <input type="number" min="0" name="sellingPrice" placeholder="0" value={product.sellingPrice} onChange={handleChange} className="w-full bg-gray-50/80 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 pl-11" required />
              </div>
            </div>

            {/* Stock Quantity */}
            <div className="relative group/input">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Stock Quantity *</label>
              <div className="relative flex items-center">
                <FiLayers className="absolute left-4 text-gray-400 group-focus-within/input:text-[#D4AF37] transition-colors" />
                <input type="number" min="0" name="stock" placeholder="0" value={product.stock} onChange={handleChange} className="w-full bg-gray-50/80 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 pl-11" required />
              </div>
            </div>

            {/* Product Description */}
            <div className="md:col-span-2 relative group/input">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Product Description</label>
              <div className="relative flex items-start">
                <FiAlignLeft className="absolute left-4 top-5 text-gray-400 group-focus-within/input:text-[#D4AF37] transition-colors" />
                <textarea name="description" placeholder="Optional product description..." value={product.description} onChange={handleChange} rows="3" className="w-full bg-gray-50/80 hover:bg-gray-100/50 border border-transparent focus:bg-white focus:border-[#D4AF37]/40 rounded-2xl text-sm font-semibold text-[#111] outline-none transition-all p-4 pl-11 resize-none"></textarea>
              </div>
            </div>

            {/* Featured Toggle */}
            <div className="md:col-span-2 flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${product.featured ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-gray-200 text-gray-500'}`}>
                  <FiStar className={product.featured ? "fill-current" : ""} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#111]">Featured Product</p>
                  <p className="text-xs font-medium text-gray-500">Highlight this item in the premium collection.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="featured" checked={product.featured} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
              </label>
            </div>

            <div className="md:col-span-2 pt-4">
              <button type="submit" disabled={loading} className="w-full sm:w-auto ml-auto bg-[#111] text-[#D4AF37] px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#D4AF37] hover:text-[#111] transition-colors shadow-lg shadow-black/10 disabled:opacity-70 cursor-pointer">
                {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : "Publish Product"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>

      {/* Category Modal */}
      <CategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        existingCategories={categories}
        onSuccess={handleCategoryCreated}
      />
    </div>
  );
};

export default AddProduct;