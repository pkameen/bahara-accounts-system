import { useState, useMemo } from "react";
import EmployeeAvatar from "./EmployeeAvatar";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  FiX,
  FiPackage,
  FiTrendingUp,
  FiDollarSign,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiCalendar,
  FiFileText,
  FiPhone,
  FiPieChart,
  FiAward,
  FiChevronDown,
  FiChevronUp,
  FiLayers,
  FiTrash2,
  FiEdit
} from "react-icons/fi";

const PRODUCT_COLORS = [
  "#D4AF37", // Gold
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EF4444", // Red
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#14B8A6"  // Teal
];

const ChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#111111] text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 text-xs backdrop-blur-md">
        <p className="font-bold text-sm text-[#D4AF37] mb-1 font-['Poppins']">{data.productName}</p>
        <div className="space-y-1 text-gray-300">
          <p className="flex items-center justify-between gap-4 font-medium">
            <span>Sold Quantity:</span>
            <span className="font-bold text-white font-['Poppins']">{data.sold} units</span>
          </p>
          <p className="flex items-center justify-between gap-4 font-medium">
            <span>Sales Share:</span>
            <span className="font-bold text-[#D4AF37]">{data.salesShareFormatted}</span>
          </p>
          <p className="flex items-center justify-between gap-4 font-medium">
            <span>Stock Utilization:</span>
            <span className="font-bold text-green-400">{data.utilizationFormatted}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function EmployeeStockDetailModal({ employee, isOpen, onClose, onEditIssue, onDeleteIssue, isAdmin }) {
  const [activeTab, setActiveTab] = useState("breakdown"); // "breakdown" | "issues" | "sales" | "reconciliation"
  const [expandedIssueId, setExpandedIssueId] = useState(null);
  const [activePieIndex, setActivePieIndex] = useState(null);

  if (!isOpen || !employee) return null;

  const productList = employee.productList || [];
  const totalSold = employee.totalSold || 0;
  const totalIssued = employee.totalIssued || 0;
  const currentBalance = employee.currentBalance || 0;
  const totalStockValue = employee.totalStockValue || 0;
  const totalSalesValue = employee.totalSalesValue || 0;
  const overallUtilizationFormatted = employee.overallUtilizationFormatted || `${employee.overallUtilization || 0}%`;

  // Filter products that have sales for pie chart
  const productsWithSales = productList.filter((p) => p.sold > 0);

  // Highest selling product
  const highestSellingProduct = employee.highestSellingProduct || (productsWithSales.length > 0 ? productsWithSales[0] : null);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-['Inter']">
      <div className="bg-white rounded-[32px] shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Employee Profile Header */}
        <div className="bg-[#111111] text-white p-6 sm:p-7 flex items-center justify-between border-b border-gray-800 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-44 h-44 bg-[#D4AF37] blur-[80px] opacity-20 rounded-full pointer-events-none"></div>

          <div className="flex items-center gap-4 relative z-10">
            <EmployeeAvatar emp={employee} className="w-14 h-14 sm:w-16 sm:h-16 shadow-xl border-2 border-[#D4AF37]/50" textClassName="text-xl font-bold" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight font-['Poppins']">{employee.name}</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${employee.status?.color}`}>
                  {employee.status?.icon} {employee.status?.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-1">
                {employee.email || "Employee"} • {employee.phone || "No Phone"} • <span className="capitalize">{employee.role || "Sales Representative"}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer relative z-10"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar space-y-7 flex-1">
          
          {/* Top KPI Cards Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            
            {/* Total Issued */}
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Issued</span>
              <span className="text-lg font-bold text-[#111] font-['Poppins']">
                {totalIssued.toLocaleString('en-IN')} <span className="text-xs text-gray-400 font-normal">units</span>
              </span>
            </div>

            {/* Total Sold */}
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Sold</span>
              <span className="text-lg font-bold text-[#D4AF37] font-['Poppins']">
                {totalSold.toLocaleString('en-IN')} <span className="text-xs text-gray-400 font-normal">units</span>
              </span>
            </div>

            {/* Current Balance */}
            <div className={`p-3.5 rounded-2xl border ${currentBalance < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50/80 border-gray-100"}`}>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Stock Balance</span>
              <span className={`text-lg font-bold font-['Poppins'] ${currentBalance < 0 ? "text-red-600" : "text-[#111]"}`}>
                {currentBalance.toLocaleString('en-IN')} <span className="text-xs font-normal">units</span>
              </span>
            </div>

            {/* Stock Value */}
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Stock Value</span>
              <span className="text-lg font-bold text-[#111] font-['Poppins']">
                ₹{totalStockValue.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Sales Value */}
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Sales Turnover</span>
              <span className="text-lg font-bold text-green-600 font-['Poppins']">
                ₹{totalSalesValue.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Sold % / Stock Utilization */}
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/60">
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-widest block mb-1">Sold / Utilization</span>
              <span className="text-lg font-bold text-amber-700 font-['Poppins']">
                {overallUtilizationFormatted}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-100 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab("breakdown")}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "breakdown"
                  ? "border-[#D4AF37] text-[#111]"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              Product Stock & Sales ({productList.length})
            </button>
            <button
              onClick={() => setActiveTab("issues")}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "issues"
                  ? "border-[#D4AF37] text-[#111]"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              Stock Allocations ({employee.issueRecords?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("sales")}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "sales"
                  ? "border-[#D4AF37] text-[#111]"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              Sales History ({employee.salesRecords?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("reconciliation")}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "reconciliation"
                  ? "border-[#D4AF37] text-[#111]"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              Cash Reconciliation
            </button>
          </div>

          {/* TAB 1: PRODUCT STOCK & PRODUCT SALES PERCENTAGE GRAPH */}
          {activeTab === "breakdown" && (
            <div className="space-y-8">
              
              {/* Product Stock Cards List */}
              <div>
                <h4 className="text-base font-bold text-[#111] font-['Poppins'] mb-4">Assigned Product Stock Ledger</h4>
                {productList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {productList.map((prod) => (
                      <div
                        key={prod.productId}
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-[#D4AF37]/40 transition-all flex flex-col justify-between"
                      >
                        {/* Product Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            {prod.image ? (
                              <img
                                src={prod.image}
                                alt={prod.productName}
                                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center shrink-0 text-lg border border-gray-200">
                                <FiPackage />
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] text-gray-400 font-semibold uppercase">{prod.category}</span>
                              <h5 className="font-bold text-[#111] text-base font-['Poppins']">{prod.productName}</h5>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${prod.status.color}`}>
                            {prod.status.label}
                          </span>
                        </div>

                        {/* Stock Numbers Table */}
                        <div className="grid grid-cols-4 gap-2 bg-gray-50/80 p-3 rounded-xl border border-gray-100 text-center mb-4">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Issued</span>
                            <span className="text-sm font-bold text-[#111] font-['Poppins']">{prod.issued}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Sold</span>
                            <span className="text-sm font-bold text-[#D4AF37] font-['Poppins']">{prod.sold}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Balance</span>
                            <span className={`text-sm font-bold font-['Poppins'] ${prod.balance < 0 ? "text-red-600" : "text-[#111]"}`}>
                              {prod.balance}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Stock Value</span>
                            <span className="text-sm font-bold text-green-600 font-['Poppins']">₹{prod.stockValue.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        {/* Dual Percentages Row */}
                        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs">
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">
                              Stock Utilization
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#D4AF37] font-['Poppins']">{prod.utilizationFormatted}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#D4AF37] rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, prod.utilization))}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">
                              Product Sales Share
                            </span>
                            <span className="font-bold text-[#111] font-['Poppins']">
                              {prod.salesShareFormatted}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl">
                    No products issued or sold for this employee.
                  </div>
                )}
              </div>

              {/* Product Sales Percentage Donut Graph */}
              <div className="bg-white border border-gray-100 rounded-[28px] p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-bold text-[#111] font-['Poppins'] flex items-center gap-2">
                      <FiPieChart className="text-[#D4AF37]" /> Product Sales Distribution Chart
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Percentage breakdown of products sold by {employee.name}
                    </p>
                  </div>

                  {highestSellingProduct && (
                    <div className="bg-[#111111] text-white px-4 py-2 rounded-2xl flex items-center gap-3 border border-gray-800 shadow-md">
                      <FiAward className="text-[#D4AF37] text-lg shrink-0" />
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Highest Selling</span>
                        <span className="text-xs font-bold text-white font-['Poppins']">
                          {highestSellingProduct.productName} ({highestSellingProduct.sold} units • {highestSellingProduct.salesShareFormatted})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {productsWithSales.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    
                    {/* Donut Chart View */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                      <div className="w-full h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={productsWithSales}
                              dataKey="sold"
                              nameKey="productName"
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={95}
                              paddingAngle={3}
                              cornerRadius={4}
                              onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                              onMouseLeave={() => setActivePieIndex(null)}
                            >
                              {productsWithSales.map((entry, idx) => {
                                const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
                                const isHovered = activePieIndex === idx;
                                return (
                                  <Cell
                                    key={entry.productId}
                                    fill={color}
                                    stroke={isHovered ? "#111" : "#ffffff"}
                                    strokeWidth={isHovered ? 3 : 2}
                                    className="transition-all duration-300 outline-none cursor-pointer"
                                  />
                                );
                              })}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* Center Readout */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total Products Sold</span>
                          <span className="text-2xl font-bold text-[#111] font-['Poppins'] tracking-tight">
                            {totalSold.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Legend Grid */}
                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                      {productsWithSales.map((prod, idx) => {
                        const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
                        const isHovered = activePieIndex === idx;

                        return (
                          <div
                            key={prod.productId}
                            onMouseEnter={() => setActivePieIndex(idx)}
                            onMouseLeave={() => setActivePieIndex(null)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isHovered
                                ? "bg-[#111] text-white border-gray-800 shadow-md"
                                : "bg-gray-50/80 hover:bg-gray-100 text-[#111] border-gray-100"
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate pr-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                              <div className="truncate">
                                <p className={`font-bold text-xs truncate ${isHovered ? "text-white" : "text-[#111]"}`}>
                                  {prod.productName}
                                </p>
                                <span className={`text-[10px] block ${isHovered ? "text-gray-400" : "text-gray-500"}`}>
                                  {prod.sold} units sold
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={`font-bold text-xs font-['Poppins'] ${isHovered ? "text-[#D4AF37]" : "text-[#111]"}`}>
                                {prod.salesShareFormatted}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 font-medium">
                    No sales realized yet to render distribution chart.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: STOCK ALLOCATION TRANSACTIONS */}
          {activeTab === "issues" && (
            <div className="space-y-4">
              {employee.issueRecords && employee.issueRecords.length > 0 ? (
                <div className="space-y-3">
                  {employee.issueRecords.map((iss) => {
                    const isExpanded = expandedIssueId === iss.id;
                    const issueProducts = Array.isArray(iss.products) && iss.products.length > 0
                      ? iss.products
                      : (iss.quantity ? [{
                          productId: iss.productId,
                          productName: iss.productName,
                          quantity: iss.quantity,
                          unit: iss.unit,
                          price: iss.price,
                          lineValue: (iss.quantity || 0) * (iss.price || 0)
                        }] : []);

                    const transactionNumber = iss.issueNumber || iss.id || "STK-ALLOCATION";
                    const totalVal = iss.totalValue || issueProducts.reduce((sum, p) => sum + (p.lineValue || (p.quantity * p.price) || 0), 0);

                    return (
                      <div
                        key={iss.id || Math.random()}
                        className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:border-[#D4AF37]/50 transition-colors"
                      >
                        {/* Transaction Header Bar */}
                        <div
                          onClick={() => setExpandedIssueId(isExpanded ? null : iss.id)}
                          className="p-4 bg-gray-50/80 hover:bg-gray-100/80 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#111] text-[#D4AF37] font-bold flex items-center justify-center text-sm shadow-sm">
                              <FiPackage />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#111] font-['Poppins']">{transactionNumber}</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                  {issueProducts.length} {issueProducts.length === 1 ? 'Product' : 'Products'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 font-medium">
                                Issued on {iss.date || iss.formattedDate} • By {iss.createdByName || "Admin"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs font-bold text-[#D4AF37] font-['Poppins'] block">
                                ₹{totalVal.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold">
                                {iss.totalQuantity || iss.quantity || 0} units
                              </span>
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {onEditIssue && (
                                  <button
                                    type="button"
                                    onClick={() => onEditIssue(iss)}
                                    title="Edit Stock Allocation"
                                    className="p-2 rounded-xl bg-gray-100 hover:bg-[#D4AF37]/20 text-gray-600 hover:text-[#D4AF37] transition-colors cursor-pointer"
                                  >
                                    <FiEdit className="text-sm" />
                                  </button>
                                )}
                                {onDeleteIssue && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteIssue(iss.id)}
                                    title="Delete Stock Allocation"
                                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                                  >
                                    <FiTrash2 className="text-sm" />
                                  </button>
                                )}
                              </div>
                            )}
                            <button className="text-gray-400 text-lg">
                              {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Line Items Table */}
                        {isExpanded && (
                          <div className="p-4 border-t border-gray-100 bg-white space-y-3">
                            {iss.notes && (
                              <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                <span className="font-bold text-gray-700">Notes:</span> {iss.notes}
                              </p>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  <tr>
                                    <th className="p-3">Product Name</th>
                                    <th className="p-3 text-center">Quantity</th>
                                    <th className="p-3 text-right">Unit Rate</th>
                                    <th className="p-3 text-right">Line Stock Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                                  {issueProducts.map((p, idx) => {
                                    const lVal = p.lineValue || (p.quantity * p.price) || 0;
                                    return (
                                      <tr key={idx}>
                                        <td className="p-3 font-bold text-[#111]">{p.productName}</td>
                                        <td className="p-3 text-center font-bold text-[#D4AF37] font-['Poppins']">
                                          {p.quantity} {p.unit || "units"}
                                        </td>
                                        <td className="p-3 text-right text-gray-600">₹{p.price || 0}</td>
                                        <td className="p-3 text-right font-bold text-green-600 font-['Poppins']">
                                          ₹{lVal.toLocaleString('en-IN')}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl">
                  No stock allocations recorded for this employee.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SALES HISTORY */}
          {activeTab === "sales" && (
            <div className="overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-center">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-semibold text-[#111]">
                  {employee.salesRecords && employee.salesRecords.length > 0 ? (
                    employee.salesRecords.map((inv) => (
                      <tr key={inv.id || Math.random()} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4 text-gray-500">{inv.invoiceDate || inv.formattedDate}</td>
                        <td className="p-4 font-bold text-[#111]">#{inv.invoiceNumber || inv.id.slice(-6)}</td>
                        <td className="p-4">
                          <div className="font-bold text-sm text-[#111]">
                            {inv.customerName || inv.customer?.name || "Cash Customer"}
                          </div>
                          {(inv.phone || inv.customerPhone || inv.customer?.phone) ? (
                            <div className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                              <FiPhone className="text-[10px] text-[#D4AF37]" /> {inv.phone || inv.customerPhone || inv.customer?.phone}
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-400">No Phone</div>
                          )}
                        </td>

                        <td className="p-4 text-right font-bold text-[#D4AF37] font-['Poppins']">
                          ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              (inv.paymentStatus || "paid") === "paid"
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {inv.paymentStatus || "paid"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400 font-medium">
                        No sales invoices recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: CASH & PAYMENT RECONCILIATION */}
          {activeTab === "reconciliation" && (
            <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-6 space-y-4">
              <h4 className="text-base font-bold text-[#111] font-['Poppins']">Cash & Payment Realization Audit</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Expected Sales Total</span>
                  <span className="text-xl font-bold text-green-600 font-['Poppins']">
                    ₹{employee.expectedSales.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Received (Paid Invoices)</span>
                  <span className="text-xl font-bold text-emerald-600 font-['Poppins']">
                    ₹{employee.receivedAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Pending Amount</span>
                  <span className={`text-xl font-bold font-['Poppins'] ${employee.paymentDifference > 0 ? "text-rose-600" : "text-gray-700"}`}>
                    ₹{employee.paymentDifference.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
