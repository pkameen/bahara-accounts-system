import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FiUsers, FiTrendingDown, FiDollarSign } from "react-icons/fi";
import { calculateExpensesBySalesman } from "../utils/calculations";

const EXPENSE_PEOPLE_COLORS = [
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#3B82F6", // Royal Blue
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#D4AF37", // Gold
  "#6366F1", // Indigo
  "#F43F5E"  // Coral
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#111111] text-white p-4 rounded-2xl shadow-2xl border border-white/10 text-xs backdrop-blur-md">
        <p className="font-bold text-sm text-[#D4AF37] mb-1 font-['Poppins']">{data.name}</p>
        <div className="space-y-1 text-gray-300">
          <p className="flex items-center justify-between gap-4 font-medium">
            <span>Expenses Handled:</span>
            <span className="font-bold text-white font-['Poppins']">₹{data.amount.toLocaleString('en-IN')}</span>
          </p>
          <p className="flex items-center justify-between gap-4 font-medium">
            <span>Share:</span>
            <span className="font-bold text-[#D4AF37]">{data.percentageFormatted}</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-[10px] text-gray-400 pt-1 border-t border-white/10">
            <span>Records:</span>
            <span>{data.count} {data.count === 1 ? 'expense' : 'expenses'}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ExpenseBySalesmanChart({ expenses = [], employees = [], title = "Expense by Salesman" }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const { expensePeople, totalExpense, topExpenseCreator } = useMemo(() => {
    return calculateExpensesBySalesman(expenses, employees);
  }, [expenses, employees]);

  const hasData = expensePeople.length > 0 && totalExpense > 0;

  return (
    <div className="bg-white premium-shadow border border-gray-100 rounded-[30px] p-6 sm:p-8 w-full transition-all duration-300 hover:border-[#D4AF37]/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#111] text-[#D4AF37] flex items-center justify-center text-sm shadow-md">
              <FiTrendingDown />
            </div>
            <h3 className="text-xl font-bold text-[#111] tracking-tight font-['Poppins']">{title}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-medium">
            Expense creation and management per salesperson / admin
          </p>
        </div>

        {hasData && (
          <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-100 self-start sm:self-auto">
            <FiUsers className="text-[#D4AF37] text-xs" />
            <span className="text-xs font-bold text-gray-600">
              {expensePeople.length} {expensePeople.length === 1 ? 'Person' : 'People'}
            </span>
          </div>
        )}
      </div>

      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* Donut Chart (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="w-full h-[260px] sm:h-[280px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePeople}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                    cornerRadius={5}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {expensePeople.map((entry, index) => {
                      const color = EXPENSE_PEOPLE_COLORS[index % EXPENSE_PEOPLE_COLORS.length];
                      const isHovered = activeIndex === index;
                      return (
                        <Cell
                          key={entry.uid}
                          fill={color}
                          stroke={isHovered ? "#111" : "#ffffff"}
                          strokeWidth={isHovered ? 3 : 2}
                          className="transition-all duration-300 outline-none cursor-pointer"
                          style={{
                            transform: isHovered ? "scale(1.04)" : "scale(1)",
                            transformOrigin: "center center",
                            filter: isHovered ? "drop-shadow(0px 8px 16px rgba(0,0,0,0.15))" : "none"
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Info Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Expenses</span>
                <span className="text-xl sm:text-2xl font-bold text-[#111] font-['Poppins'] tracking-tight">
                  ₹{totalExpense.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Legend and Top Creator Stats (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">

            {/* Top Expense Creator Banner Card */}
            {topExpenseCreator && (
              <div className="bg-[#111111] text-white p-4 sm:p-5 rounded-[22px] relative overflow-hidden group border border-gray-800 shadow-xl">
                <div className="absolute top-0 right-0 w-28 h-28 bg-[#D4AF37] blur-[50px] opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 font-bold text-lg flex items-center justify-center shrink-0 border border-amber-500/30">
                      <FiTrendingDown className="text-xl" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Highest Expense Creator</span>
                      <h4 className="text-lg font-bold text-white tracking-tight font-['Poppins']">{topExpenseCreator.name}</h4>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Expenses Created</span>
                    <span className="text-lg font-bold text-amber-400 font-['Poppins']">
                      ₹{topExpenseCreator.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold block">
                      {topExpenseCreator.percentageFormatted} share
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Legend Grid */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Expenses by Creator</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {expensePeople.map((person, index) => {
                  const color = EXPENSE_PEOPLE_COLORS[index % EXPENSE_PEOPLE_COLORS.length];
                  const isHovered = activeIndex === index;

                  return (
                    <div
                      key={person.uid}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isHovered
                          ? "bg-gray-900 text-white border-gray-800 shadow-lg scale-[1.02]"
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
                            {person.name}
                          </p>
                          <span className={`text-[10px] block ${isHovered ? "text-gray-400" : "text-gray-500"}`}>
                            {person.count} {person.count === 1 ? "expense" : "expenses"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-bold text-xs font-['Poppins'] ${isHovered ? "text-amber-400" : "text-[#111]"}`}>
                          ₹{person.amount.toLocaleString('en-IN')}
                        </p>
                        <p className={`text-[10px] font-bold ${isHovered ? "text-white/80" : "text-amber-500"}`}>
                          {person.percentageFormatted}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* Empty State */
        <div className="py-12 px-4 flex flex-col items-center justify-center text-center text-gray-400">
          <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-300 text-3xl mb-3 border border-gray-100">
            <FiDollarSign />
          </div>
          <h4 className="text-base font-bold text-gray-700 font-['Poppins'] mb-1">No Employee Expenses Recorded</h4>
          <p className="text-xs text-gray-400 max-w-sm">
            There are no expenses attributed to employees or admin for this period.
          </p>
        </div>
      )}
    </div>
  );
}
