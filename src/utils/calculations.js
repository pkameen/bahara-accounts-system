import {
  isSameDay,
  isSameWeek,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  endOfDay
} from "date-fns";

/**
 * Filter items by date filter type (today, week, month, custom)
 */
export const filterItemsByDate = (items, filterType = "today", startDate = "", endDate = "", dateKey = "createdAt", altDateKey = "") => {
  if (!items || !Array.isArray(items)) return [];
  const now = new Date();

  return items.filter(item => {
    let dateVal = item[dateKey] || Date.now();
    if (altDateKey && item[altDateKey]) {
      const [year, month, day] = item[altDateKey].split('-');
      if (year && month && day) {
        dateVal = new Date(year, month - 1, day).getTime();
      }
    }
    const d = new Date(dateVal);

    if (filterType === "today") {
      return isSameDay(d, now);
    } else if (filterType === "week") {
      return isSameWeek(d, now);
    } else if (filterType === "month") {
      return isSameMonth(d, now);
    } else if (filterType === "custom" && startDate && endDate) {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      return isWithinInterval(d, { start, end });
    }
    return true; // default if custom dates not set or all
  });
};

/**
 * Shared sales & performance calculation engine
 */
export const calculateMetrics = ({
  invoices = [],
  expenses = [],
  employeeUid = null,
  paymentFilter = "all"
}) => {
  // 1. Filter by employee UID if provided
  let filteredInvoices = invoices;
  let filteredExpenses = expenses;

  if (employeeUid) {
    filteredInvoices = invoices.filter(inv => inv.createdByUid === employeeUid);
    filteredExpenses = expenses.filter(exp => exp.createdByUid === employeeUid);
  }

  // 2. Filter by payment status if specified
  if (paymentFilter !== "all") {
    filteredInvoices = filteredInvoices.filter(inv => (inv.paymentStatus || "paid") === paymentFilter);
  }

  let totalTurnover = 0;
  let pendingTotal = 0;
  let totalItemsSold = 0;
  const productStats = {};

  filteredInvoices.forEach(inv => {
    const amount = Number(inv.totalAmount) || 0;
    totalTurnover += amount;

    if ((inv.paymentStatus || "paid") === "pending") {
      pendingTotal += amount;
    }

    const products = inv.products || [];
    products.forEach(p => {
      const qty = Number(p.quantity) || 0;
      totalItemsSold += qty;

      const pId = p.productId || p.productName || "custom";
      if (!productStats[pId]) {
        productStats[pId] = {
          id: pId,
          name: p.productName || "Product",
          category: p.category || "General",
          qty: 0,
          revenue: 0
        };
      }
      productStats[pId].qty += qty;
      productStats[pId].revenue += Number(p.total || 0);
    });
  });

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const profit = totalTurnover - totalExpenses;
  const totalInvoices = filteredInvoices.length;
  const averageInvoiceValue = totalInvoices > 0 ? Math.round(totalTurnover / totalInvoices) : 0;

  const topProduct = Object.values(productStats).sort((a, b) => b.qty - a.qty)[0] || null;

  return {
    invoices: filteredInvoices,
    expenses: filteredExpenses,
    totalTurnover,
    pendingTotal,
    totalExpenses,
    profit,
    totalItemsSold,
    totalInvoices,
    averageInvoiceValue,
    topProduct,
    productStats: Object.values(productStats)
  };
};

/**
 * Top Sales Employees Aggregation for Admin View
 */
export const calculateTopSalesEmployees = (invoices = [], expenses = [], employeesList = []) => {
  const empMap = {};

  // Initialize from employee list
  employeesList.forEach(emp => {
    empMap[emp.uid] = {
      uid: emp.uid,
      name: emp.name,
      phone: emp.phone,
      status: emp.status || "active",
      role: emp.role || "employee",
      totalSales: 0,
      revenue: 0,
      expenses: 0,
      profit: 0,
      invoicesCount: 0,
      itemsSold: 0,
      productBreakdown: {}
    };
  });

  // Aggregate Invoices
  invoices.forEach(inv => {
    const creatorUid = inv.createdByUid;
    if (creatorUid) {
      if (!empMap[creatorUid]) {
        empMap[creatorUid] = {
          uid: creatorUid,
          name: inv.createdByName || "Employee",
          phone: "N/A",
          status: "active",
          role: inv.createdByRole || "employee",
          totalSales: 0,
          revenue: 0,
          expenses: 0,
          profit: 0,
          invoicesCount: 0,
          itemsSold: 0,
          productBreakdown: {}
        };
      }
      const amount = Number(inv.totalAmount) || 0;
      empMap[creatorUid].revenue += amount;
      empMap[creatorUid].totalSales += amount;
      empMap[creatorUid].invoicesCount += 1;

      (inv.products || []).forEach(p => {
        const qty = Number(p.quantity) || 0;
        empMap[creatorUid].itemsSold += qty;
        const pName = p.productName || "Unknown Product";
        empMap[creatorUid].productBreakdown[pName] = (empMap[creatorUid].productBreakdown[pName] || 0) + qty;
      });
    }
  });

  // Aggregate Expenses
  expenses.forEach(exp => {
    const creatorUid = exp.createdByUid;
    if (creatorUid && empMap[creatorUid]) {
      empMap[creatorUid].expenses += Number(exp.amount) || 0;
    }
  });

  // Calculate profit
  Object.values(empMap).forEach(emp => {
    emp.profit = emp.revenue - emp.expenses;
  });

  return Object.values(empMap).sort((a, b) => b.revenue - a.revenue);
};

/**
 * Centralized Salesman Revenue & Performance Engine
 * Used across Admin Dashboard, Reports, Top Salesman, and Employee Dashboard
 */
export const calculateSalesmanRevenue = (invoices = [], employeesList = []) => {
  const salesMap = {};

  const empLookup = {};
  if (Array.isArray(employeesList)) {
    employeesList.forEach(emp => {
      if (emp && emp.uid) {
        empLookup[emp.uid] = emp;
      }
    });
  }

  invoices.forEach((inv) => {
    const creatorUid = inv.createdByUid;
    const creatorRole = inv.createdByRole;
    const creatorUserId = inv.createdByUserId;
    const creatorName = inv.createdByName;

    const isAdmin =
      creatorRole === "admin" ||
      creatorUid === "admin_uid_2026" ||
      creatorUid === "admin_legacy" ||
      creatorUserId === "admin" ||
      (!creatorUid && creatorName === "Admin");

    let key;
    let displayName;

    if (isAdmin) {
      key = "admin";
      displayName = "Admin";
    } else if (creatorUid) {
      key = creatorUid;
      displayName = empLookup[creatorUid]?.name || creatorName || "Employee";
    } else if (creatorName) {
      key = creatorName;
      displayName = creatorName;
    } else {
      key = "unknown";
      displayName = "Unknown";
    }


    if (!salesMap[key]) {
      salesMap[key] = {
        uid: key,
        name: displayName,
        revenue: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        invoicesCount: 0,
        itemsSold: 0,
        isAdmin
      };
    }

    const amount = Number(inv.totalAmount) || 0;
    salesMap[key].revenue += amount;
    salesMap[key].invoicesCount += 1;

    if ((inv.paymentStatus || "paid") === "pending") {
      salesMap[key].pendingRevenue += amount;
    } else {
      salesMap[key].paidRevenue += amount;
    }

    const prods = inv.products || [];
    prods.forEach((p) => {
      salesMap[key].itemsSold += Number(p.quantity) || 0;
    });
  });

  const salespeople = Object.values(salesMap)
    .filter((s) => s.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = salespeople.reduce((sum, s) => sum + s.revenue, 0);

  salespeople.forEach((s) => {
    s.percentage = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
    s.percentageFormatted = s.percentage.toFixed(1) + "%";
  });

  const topSalesman = salespeople.length > 0 ? salespeople[0] : null;

  return {
    salespeople,
    totalRevenue,
    totalSalespeopleWithSales: salespeople.length,
    topSalesman
  };
};

/**
 * Expense by Category Calculation Engine
 */
export const calculateExpenseByCategory = (expenses = [], categoriesList = []) => {
  const catMap = {};

  const categoryLookup = {};
  if (Array.isArray(categoriesList)) {
    categoriesList.forEach(c => {
      if (c && c.id) {
        categoryLookup[c.id] = c;
      }
    });
  }

  expenses.forEach((exp) => {
    const amount = Number(exp.amount) || 0;
    const catId = exp.categoryId;
    const catName = exp.categoryName || exp.title || "Uncategorized";

    const key = catId || catName || "uncategorized";
    const name = categoryLookup[catId]?.name || catName;

    if (!catMap[key]) {
      catMap[key] = {
        id: key,
        name: name,
        amount: 0,
        count: 0
      };
    }

    catMap[key].amount += amount;
    catMap[key].count += 1;
  });

  const categories = Object.values(catMap)
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalExpense = categories.reduce((sum, c) => sum + c.amount, 0);

  categories.forEach((c) => {
    c.percentage = totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0;
    c.percentageFormatted = c.percentage.toFixed(1) + "%";
  });

  const topCategory = categories.length > 0 ? categories[0] : null;

  return {
    categories,
    totalExpense,
    totalCategoriesCount: categories.length,
    topCategory
  };
};

/**
 * Expenses by Salesman/Creator Engine
 */
export const calculateExpensesBySalesman = (expenses = [], employeesList = []) => {
  const expensePeopleMap = {};

  const empLookup = {};
  if (Array.isArray(employeesList)) {
    employeesList.forEach(emp => {
      if (emp && emp.uid) {
        empLookup[emp.uid] = emp;
      }
    });
  }

  expenses.forEach((exp) => {
    const creatorUid = exp.createdByUid;
    const creatorRole = exp.createdByRole;
    const creatorUserId = exp.createdByUserId;
    const creatorName = exp.createdByName;

    const isAdmin =
      creatorRole === "admin" ||
      creatorUid === "admin_uid_2026" ||
      creatorUid === "admin_legacy" ||
      creatorUserId === "admin" ||
      (!creatorUid && creatorName === "Admin");

    let key;
    let displayName;

    if (isAdmin) {
      key = "admin";
      displayName = "Admin";
    } else if (creatorUid) {
      key = creatorUid;
      displayName = empLookup[creatorUid]?.name || creatorName || "Employee";
    } else if (creatorName) {
      key = creatorName;
      displayName = creatorName;
    } else {
      key = "unknown";
      displayName = "Unknown";
    }

    if (!expensePeopleMap[key]) {
      expensePeopleMap[key] = {
        uid: key,
        name: displayName,
        amount: 0,
        count: 0,
        isAdmin
      };
    }

    const amt = Number(exp.amount) || 0;
    expensePeopleMap[key].amount += amt;
    expensePeopleMap[key].count += 1;
  });

  const expensePeople = Object.values(expensePeopleMap)
    .filter((p) => p.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalExpense = expensePeople.reduce((sum, p) => sum + p.amount, 0);

  expensePeople.forEach((p) => {
    p.percentage = totalExpense > 0 ? (p.amount / totalExpense) * 100 : 0;
    p.percentageFormatted = p.percentage.toFixed(1) + "%";
  });

  const topExpenseCreator = expensePeople.length > 0 ? expensePeople[0] : null;

  return {
    expensePeople,
    totalExpense,
    topExpenseCreator
  };
};

/**
 * Unified Employee Performance Matrix Engine
 * Computes Revenue, Expenses, and Net Contribution (Profit) per Employee/Admin
 */
export const calculateEmployeePerformance = (invoices = [], expenses = [], employeesList = []) => {
  const salesmanData = calculateSalesmanRevenue(invoices, employeesList);
  const expenseData = calculateExpensesBySalesman(expenses, employeesList);

  const perfMap = {};

  salesmanData.salespeople.forEach((s) => {
    perfMap[s.uid] = {
      uid: s.uid,
      name: s.name,
      revenue: s.revenue,
      expenses: 0,
      profit: s.revenue,
      invoicesCount: s.invoicesCount,
      itemsSold: s.itemsSold,
      isAdmin: s.isAdmin
    };
  });

  expenseData.expensePeople.forEach((e) => {
    if (!perfMap[e.uid]) {
      perfMap[e.uid] = {
        uid: e.uid,
        name: e.name,
        revenue: 0,
        expenses: e.amount,
        profit: -e.amount,
        invoicesCount: 0,
        itemsSold: 0,
        isAdmin: e.isAdmin
      };
    } else {
      perfMap[e.uid].expenses = e.amount;
      perfMap[e.uid].profit = perfMap[e.uid].revenue - e.amount;
    }
  });

  return Object.values(perfMap).sort((a, b) => b.revenue - a.revenue);
};


