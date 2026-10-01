import { motion } from "framer-motion";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";

export default function SalesCard({ 
  title, 
  amount, 
  icon, 
  percentage, 
  color = "text-white",
  bgClass = "bg-white border-gray-100",
  iconBgClass,
  subtext
}) {
  // Determine trend direction
  const isPositive = percentage && percentage.toString().startsWith("+");
  const isNegative = percentage && percentage.toString().startsWith("-");
  const isCustomBg = bgClass && !bgClass.includes("bg-white");

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`${bgClass} rounded-[30px] p-6 relative overflow-hidden group transition-all duration-300 cursor-default border ${isCustomBg ? "shadow-2xl" : "border-gray-100 hover:border-[#D4AF37]/40 shadow-sm"}`}
    >
      {/* Ambient background glow blob on hover */}
      <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-gradient-to-br from-white/20 to-transparent rounded-full group-hover:scale-[2.5] transition-transform duration-700 opacity-50 z-0 pointer-events-none"></div>
      
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className={`${isCustomBg ? "text-gray-300 font-semibold" : "text-gray-400 font-bold"} text-[11px] uppercase tracking-widest mb-2 font-['Inter']`}>
            {title}
          </p>
          <h2 className={`text-2xl sm:text-3xl font-bold ${color} tracking-tight font-['Poppins']`}>
            {amount}
          </h2>
          {subtext && (
            <p className={`text-[10px] font-medium mt-1.5 ${isCustomBg ? "text-gray-300 opacity-90" : "text-gray-400"}`}>
              {subtext}
            </p>
          )}
        </div>
        
        <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-2xl transition-all duration-300 shadow-md border shrink-0 ${
          iconBgClass 
            ? iconBgClass 
            : isCustomBg 
              ? "bg-white/15 text-white border-white/20 group-hover:bg-white group-hover:text-[#111]" 
              : "bg-gray-50 text-[#111] border-gray-100 group-hover:bg-[#111] group-hover:text-[#D4AF37] group-hover:border-[#111]"
        }`}>
          {icon}
        </div>
      </div>

      {percentage && (
        <div className="relative z-10 mt-5 flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
            isPositive 
              ? isCustomBg ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30" : "bg-green-50 text-green-600" 
              : isNegative 
                ? isCustomBg ? "bg-rose-400/20 text-rose-300 border border-rose-400/30" : "bg-red-50 text-red-600" 
                : isCustomBg ? "bg-white/15 text-white border border-white/20" : "bg-gray-50 text-gray-600"
          }`}>
            {isPositive && <FiTrendingUp className="text-[10px]" />}
            {isNegative && <FiTrendingDown className="text-[10px]" />}
            {percentage}
          </span>
          <span className={`text-xs font-medium ${isCustomBg ? "text-gray-300" : "text-gray-400"} font-['Inter']`}>
            vs last period
          </span>
        </div>
      )}
    </motion.div>
  );
}