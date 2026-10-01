import {
  isSameDay,
  isSameWeek,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
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
    const photo = emp.photoURL || emp.photoUrl || emp.photo || emp.profilePhoto || emp.imageUrl || emp.avatarUrl || "";
    empMap[emp.uid] = {
      ...emp,
      uid: emp.uid,
      name: emp.name,
      phone: emp.phone,
      email: emp.email || "",
      userId: emp.userId || "",
      photoURL: photo,
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

/**
 * Product Sales Performance Calculation Engine
 * Aggregates product-wise sales distribution dynamically from invoices
 */
export const calculateProductSales = (invoices = [], productsList = []) => {
  const prodMap = {};

  // Build product lookup maps for matching products stored in DB
  const dbProdLookupById = {};
  const dbProdLookupByName = {};

  if (Array.isArray(productsList)) {
    productsList.forEach((p) => {
      if (p && p.id) {
        dbProdLookupById[p.id] = p;
      }
      if (p && (p.productName || p.name)) {
        const nameKey = (p.productName || p.name).trim().toLowerCase();
        dbProdLookupByName[nameKey] = p;
      }
    });
  }

  invoices.forEach((inv) => {
    const products = inv.products || [];
    products.forEach((lineItem) => {
      const qty = Number(lineItem.quantity) || 0;
      if (qty <= 0) return;

      const rawId = (lineItem.productId || "").trim();
      const rawName = (lineItem.productName || lineItem.name || "Unknown Product").trim();
      const normName = rawName.toLowerCase();

      // Attempt matching with database product records
      const dbProd = (rawId && dbProdLookupById[rawId]) || dbProdLookupByName[normName] || null;

      // Grouping key: Product ID if available, else normalized product name
      const groupKey = dbProd?.id || (rawId !== "" ? rawId : normName);
      const displayName = dbProd?.productName || dbProd?.name || lineItem.productName || lineItem.name || "Unknown Product";
      const image = dbProd?.image || dbProd?.imageUrl || dbProd?.photo || lineItem.image || null;
      const category = dbProd?.category || lineItem.category || "General";
      const unitPrice = Number(lineItem.price || dbProd?.sellingPrice || 0);
      const lineTotal = Number(lineItem.total) || (qty * unitPrice);

      if (!prodMap[groupKey]) {
        prodMap[groupKey] = {
          id: groupKey,
          name: displayName,
          image: image,
          category: category,
          quantity: 0,
          revenue: 0,
          count: 0
        };
      }

      prodMap[groupKey].quantity += qty;
      prodMap[groupKey].revenue += lineTotal;
      prodMap[groupKey].count += 1;

      // Update missing image if found on subsequent items
      if (!prodMap[groupKey].image && image) {
        prodMap[groupKey].image = image;
      }
    });
  });

  const productList = Object.values(prodMap)
    .filter((p) => p.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

  const totalQuantitySold = productList.reduce((sum, p) => sum + p.quantity, 0);
  const totalRevenue = productList.reduce((sum, p) => sum + p.revenue, 0);

  productList.forEach((p) => {
    p.percentage = totalQuantitySold > 0 ? (p.quantity / totalQuantitySold) * 100 : 0;
    p.percentageFormatted = p.percentage.toFixed(1) + "%";
  });

  const topProduct = productList.length > 0 ? productList[0] : null;

  return {
    products: productList,
    totalQuantitySold,
    totalRevenue,
    totalProductsCount: productList.length,
    topProduct
  };
};

/**
 * Dynamic Admin Central Company Stock Engine
 * Calculates live Company Stock from Stock Management ledger records
 * strictly as: Total Company Stock Added - Company->Employee Transfers - Valid Admin Invoice Deductions
 */
/**
 * SINGLE SOURCE OF TRUTH INVENTORY TRANSACTION LEDGER ENGINE
 * Computes exact Company Stock, Employee Stock, Product Matrix, Stock Values,
 * and Transaction Logs from valid stock transactions and invoices.
 */
export const calculateStockLedger = ({
  productsList = [],
  stockIssues = [],
  invoices = [],
  employeesList = []
}) => {
  const normalizeStr = (str) => (str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const prodLookupById = {};
  const prodLookupByName = {};
  const prodLookupByNormalized = {};
  const empLookupByUid = {};
  const empLookupByAlias = {};

  if (Array.isArray(employeesList)) {
    employeesList.forEach((emp) => {
      if (emp && emp.uid) {
        empLookupByUid[emp.uid] = emp;
        const cleanUid = String(emp.uid).trim().toLowerCase();
        empLookupByAlias[cleanUid] = emp;
        if (emp.userId) {
          empLookupByAlias[String(emp.userId).trim().toLowerCase()] = emp;
        }
        if (emp.name) {
          empLookupByAlias[String(emp.name).trim().toLowerCase()] = emp;
        }
        if (emp.email) {
          empLookupByAlias[String(emp.email).trim().toLowerCase()] = emp;
        }
      }
    });
  }

  const resolveEmpUid = (rawId, defaultName = "") => {
    if (!rawId) return null;
    const str = String(rawId).trim();
    if (str === "company" || str === "admin_stock" || str === "admin") return null;

    if (empLookupByUid[str]) return empLookupByUid[str].uid;

    const cleanStr = str.toLowerCase();
    if (empLookupByAlias[cleanStr]) return empLookupByAlias[cleanStr].uid;

    if (defaultName) {
      const cleanName = String(defaultName).trim().toLowerCase();
      if (empLookupByAlias[cleanName]) return empLookupByAlias[cleanName].uid;
    }

    return str;
  };

  const productsLedger = {};

  if (Array.isArray(productsList)) {
    productsList.forEach((prod) => {
      if (!prod || !prod.id) return;
      prodLookupById[prod.id] = prod;
      const pName = prod.productName || prod.name;
      if (pName) {
        const nameKey = pName.trim().toLowerCase();
        prodLookupByName[nameKey] = prod;
        prodLookupByNormalized[normalizeStr(pName)] = prod;
      }

      const price = Number(prod.sellingPrice || prod.price || 0);

      productsLedger[prod.id] = {
        id: prod.id,
        productId: prod.id,
        productName: pName || "Product",
        category: prod.category || "General",
        sellingPrice: price,
        unit: prod.unit || "KG",
        image: prod.image || null,

        // Quantities
        totalStockAdded: 0,
        totalSold: 0,
        totalAdjustments: 0,
        companyStock: 0,
        employeeStock: 0,
        totalCurrentBalance: 0,

        // Valuation Values
        companyStockValue: 0,
        employeeStockValue: 0,
        totalStockValue: 0,

        status: "OUT OF STOCK"
      };
    });
  }

  const employeeStockMap = {};

  const ensureEmployee = (rawId, defaultName = "Employee") => {
    const canonicalUid = resolveEmpUid(rawId, defaultName) || rawId;
    if (!canonicalUid) return null;

    if (!employeeStockMap[canonicalUid]) {
      const empDb = empLookupByUid[canonicalUid] || empLookupByAlias[String(rawId).trim().toLowerCase()];
      const name = empDb?.name || defaultName || "Employee";
      const photo = empDb?.photoURL || empDb?.photoUrl || empDb?.photo || empDb?.profilePhoto || empDb?.avatarUrl || "";
      employeeStockMap[canonicalUid] = {
        uid: canonicalUid,
        userId: empDb?.userId || canonicalUid,
        name: name,
        email: empDb?.email || "",
        phone: empDb?.phone || "",
        photoURL: photo,
        role: empDb?.role || "employee",
        status: empDb?.status || "active",
        products: {},
        totalIssued: 0,
        totalSold: 0,
        currentBalance: 0,
        overallUtilization: 0,
        overallUtilizationFormatted: "0%",
        totalStockValue: 0,
        issueRecords: [],
        salesRecords: []
      };

      // Alias mapping so subsequent checks point to canonical UID
      if (empDb) {
        if (empDb.userId) empLookupByAlias[String(empDb.userId).trim().toLowerCase()] = empDb;
        if (empDb.name) empLookupByAlias[String(empDb.name).trim().toLowerCase()] = empDb;
      }
    }
    return employeeStockMap[canonicalUid];
  };

  if (Array.isArray(employeesList)) {
    employeesList.forEach((emp) => {
      if (emp && emp.uid) {
        ensureEmployee(emp.uid, emp.name);
      }
    });
  }

  const findProduct = (item) => {
    if (!item) return null;
    const rawId = (item.productId || "").trim();
    const rawName = (item.productName || item.name || "").trim();
    const normName = rawName.toLowerCase();
    const normClean = normalizeStr(rawName);

    return (rawId && prodLookupById[rawId]) ||
      (normName && prodLookupByName[normName]) ||
      (normClean && prodLookupByNormalized[normClean]) || null;
  };

  const processedLogs = [];

  // Helper to resolve product ledger entry
  const getProductEntry = (item) => {
    const dbProd = findProduct(item);
    const rawId = (item.productId || "").trim();
    const rawName = (item.productName || item.name || "Unknown Product").trim();
    const normName = rawName.toLowerCase();
    const pId = dbProd?.id || (rawId !== "" ? rawId : normName);

    if (!productsLedger[pId]) {
      const price = Number(item.price || dbProd?.sellingPrice || 0);
      productsLedger[pId] = {
        id: pId,
        productId: pId,
        productName: dbProd?.productName || dbProd?.name || item.productName || item.name || "Product",
        category: dbProd?.category || item.category || "General",
        sellingPrice: price,
        unit: item.unit || dbProd?.unit || "KG",
        image: dbProd?.image || null,

        totalStockAdded: 0,
        totalSold: 0,
        totalAdjustments: 0,
        companyStock: 0,
        employeeStock: 0,
        totalCurrentBalance: 0,

        companyStockValue: 0,
        employeeStockValue: 0,
        totalStockValue: 0,

        status: "OUT OF STOCK"
      };
    }
    return productsLedger[pId];
  };

  // Sort stockIssues chronologically
  const sortedIssues = [...stockIssues].sort((a, b) => {
    const tA = a.createdAt || Date.now();
    const tB = b.createdAt || Date.now();
    return tA - tB;
  });

  // 1. Process Stock Ledger Issues & Additions & Transfers & Adjustments
  sortedIssues.forEach((issue) => {
    if (issue.status === "REVERSED") return; // Skip reversed if flagged

    const isEmployeeToEmployee =
      issue.transferType === "EMPLOYEE_TO_EMPLOYEE" ||
      (issue.fromEmployeeId &&
        issue.fromEmployeeId !== "company" &&
        issue.fromEmployeeId !== "admin_stock" &&
        issue.fromEmployeeId !== "admin" &&
        issue.toEmployeeId &&
        issue.fromEmployeeId !== issue.toEmployeeId &&
        issue.fromEmployeeId !== issue.employeeId);

    const isAddition =
      issue.type === "STOCK_IN" ||
      issue.type === "addition" ||
      issue.type === "received" ||
      issue.type === "add" ||
      issue.type === "stock_add" ||
      ((issue.employeeId === "admin_stock" || issue.employeeId === "company") &&
        issue.type !== "TRANSFER" && issue.type !== "transfer" && issue.type !== "issue") ||
      (issue.from && (
        issue.from.toLowerCase().includes("purchase") ||
        issue.from.toLowerCase().includes("supplier") ||
        issue.from.toLowerCase().includes("warehouse") ||
        issue.from.toLowerCase().includes("vendor") ||
        issue.from.toLowerCase().includes("factory") ||
        issue.from.toLowerCase().includes("external")
      ));

    const isAdjustment = issue.type === "ADJUSTMENT" || issue.type === "adjustment";
    const isReversal = issue.type === "REVERSAL" || issue.type === "reversal";

    const isCompanyToEmployeeTransfer = !isAddition && !isAdjustment && !isReversal && !isEmployeeToEmployee && (
      issue.type === "TRANSFER" ||
      issue.type === "transfer" ||
      issue.type === "issue" ||
      issue.transferType === "COMPANY_TO_EMPLOYEE" ||
      issue.fromEmployeeId === "company" ||
      issue.fromEmployeeId === "admin_stock" ||
      issue.fromEmployeeId === "admin"
    );

    const items = Array.isArray(issue.products) && issue.products.length > 0
      ? issue.products
      : (issue.quantity ? [{
        productId: issue.productId,
        productName: issue.productName,
        category: issue.category,
        quantity: issue.quantity,
        unit: issue.unit,
        price: issue.price
      }] : []);

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      if (qty === 0) return;

      const prodEntry = getProductEntry(item);
      const pId = prodEntry.id;
      const unitRate = Number(item.price || prodEntry.sellingPrice || 0);

      if (isAddition) {
        // Stock In to Company Stock
        prodEntry.totalStockAdded += Math.abs(qty);
        prodEntry.companyStock += Math.abs(qty);

        processedLogs.push({
          id: issue.id || `TX-${Math.random()}`,
          date: issue.date || new Date(issue.createdAt || Date.now()).toLocaleDateString(),
          createdAt: issue.createdAt || Date.now(),
          type: "STOCK_IN",
          badge: { label: "STOCK IN", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
          productId: pId,
          productName: prodEntry.productName,
          category: prodEntry.category,
          quantity: Math.abs(qty),
          unit: item.unit || prodEntry.unit,
          price: unitRate,
          value: Math.abs(qty) * unitRate,
          from: issue.from || "Supplier / External",
          to: "Company Stock",
          reference: issue.issueNumber || issue.id || "N/A",
          userName: issue.createdByName || "Admin",
          notes: issue.notes || "",
          status: "COMPLETED",
          rawIssue: issue
        });
      } else if (isCompanyToEmployeeTransfer) {
        // Company -> Employee Transfer
        const toUid = issue.toEmployeeId || issue.employeeId;
        const empObj = toUid ? ensureEmployee(toUid, issue.employeeName || issue.to || "Employee") : null;

        prodEntry.companyStock -= Math.abs(qty);

        if (empObj) {
          if (!empObj.products[pId]) {
            empObj.products[pId] = {
              productId: pId,
              productName: prodEntry.productName,
              image: prodEntry.image || null,
              category: prodEntry.category || "General",
              unit: item.unit || prodEntry.unit,
              unitPrice: unitRate,
              receivedFromCompany: 0,
              receivedFromEmployees: 0,
              transferredToEmployees: 0,
              sold: 0,
              balance: 0,
              stockValue: 0
            };
          }
          empObj.products[pId].receivedFromCompany += Math.abs(qty);
          empObj.products[pId].balance += Math.abs(qty);
          empObj.totalIssued += Math.abs(qty);
          empObj.issueRecords.push(issue);
        }

        processedLogs.push({
          id: issue.id || `TX-${Math.random()}`,
          date: issue.date || new Date(issue.createdAt || Date.now()).toLocaleDateString(),
          createdAt: issue.createdAt || Date.now(),
          type: "TRANSFER",
          transferType: "COMPANY_TO_EMPLOYEE",
          badge: { label: "COMPANY → EMPLOYEE", color: "bg-blue-100 text-blue-800 border-blue-200" },
          productId: pId,
          productName: prodEntry.productName,
          category: prodEntry.category,
          quantity: Math.abs(qty),
          unit: item.unit || prodEntry.unit,
          price: unitRate,
          value: Math.abs(qty) * unitRate,
          from: "Company Stock",
          to: empObj?.name || issue.to || "Employee",
          reference: issue.transferId || issue.issueNumber || issue.id || "N/A",
          userName: issue.createdByName || "Admin",
          notes: issue.notes || "",
          status: "COMPLETED",
          rawIssue: issue
        });
      } else if (isEmployeeToEmployee) {
        // Employee -> Employee Transfer (Does NOT change Company Stock!)
        const fromUid = issue.fromEmployeeId;
        const toUid = issue.toEmployeeId || issue.employeeId;

        const fromEmpObj = fromUid ? ensureEmployee(fromUid, issue.from || "Employee A") : null;
        const toEmpObj = toUid ? ensureEmployee(toUid, issue.to || "Employee B") : null;

        if (fromEmpObj) {
          if (!fromEmpObj.products[pId]) {
            fromEmpObj.products[pId] = {
              productId: pId,
              productName: prodEntry.productName,
              image: prodEntry.image || null,
              category: prodEntry.category || "General",
              unit: item.unit || prodEntry.unit,
              unitPrice: unitRate,
              receivedFromCompany: 0,
              receivedFromEmployees: 0,
              transferredToEmployees: 0,
              sold: 0,
              balance: 0,
              stockValue: 0
            };
          }
          fromEmpObj.products[pId].transferredToEmployees += Math.abs(qty);
          fromEmpObj.products[pId].balance -= Math.abs(qty);
          fromEmpObj.issueRecords.push(issue);
        }

        if (toEmpObj) {
          if (!toEmpObj.products[pId]) {
            toEmpObj.products[pId] = {
              productId: pId,
              productName: prodEntry.productName,
              image: prodEntry.image || null,
              category: prodEntry.category || "General",
              unit: item.unit || prodEntry.unit,
              unitPrice: unitRate,
              receivedFromCompany: 0,
              receivedFromEmployees: 0,
              transferredToEmployees: 0,
              sold: 0,
              balance: 0,
              stockValue: 0
            };
          }
          toEmpObj.products[pId].receivedFromEmployees += Math.abs(qty);
          toEmpObj.products[pId].balance += Math.abs(qty);
          toEmpObj.totalIssued += Math.abs(qty);
          toEmpObj.issueRecords.push(issue);
        }

        processedLogs.push({
          id: issue.id || `TX-${Math.random()}`,
          date: issue.date || new Date(issue.createdAt || Date.now()).toLocaleDateString(),
          createdAt: issue.createdAt || Date.now(),
          type: "EMPLOYEE_TRANSFER",
          transferType: "EMPLOYEE_TO_EMPLOYEE",
          badge: { label: "EMPLOYEE → EMPLOYEE", color: "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40" },
          productId: pId,
          productName: prodEntry.productName,
          category: prodEntry.category,
          quantity: Math.abs(qty),
          unit: item.unit || prodEntry.unit,
          price: unitRate,
          value: Math.abs(qty) * unitRate,
          from: fromEmpObj?.name || issue.from || "Employee A",
          to: toEmpObj?.name || issue.to || "Employee B",
          reference: issue.transferId || issue.issueNumber || issue.id || "N/A",
          userName: issue.createdByName || "Admin",
          notes: issue.notes || "",
          status: "COMPLETED",
          rawIssue: issue
        });
      } else if (isAdjustment) {
        const adjQty = Number(item.quantity) || 0;
        prodEntry.companyStock += adjQty;
        prodEntry.totalAdjustments += adjQty;

        processedLogs.push({
          id: issue.id || `TX-${Math.random()}`,
          date: issue.date || new Date(issue.createdAt || Date.now()).toLocaleDateString(),
          createdAt: issue.createdAt || Date.now(),
          type: "ADJUSTMENT",
          badge: { label: "ADJUSTMENT", color: "bg-purple-100 text-purple-800 border-purple-200" },
          productId: pId,
          productName: prodEntry.productName,
          category: prodEntry.category,
          quantity: adjQty,
          unit: item.unit || prodEntry.unit,
          price: unitRate,
          value: Math.abs(adjQty) * unitRate,
          from: "System Audit",
          to: "Company Stock",
          reference: issue.id || "N/A",
          userName: issue.createdByName || "Admin",
          notes: issue.notes || issue.reason || "Physical stock adjustment",
          status: "COMPLETED",
          rawIssue: issue
        });
      } else if (isReversal) {
        const revQty = Number(item.quantity) || 0;
        prodEntry.companyStock += revQty;

        processedLogs.push({
          id: issue.id || `TX-${Math.random()}`,
          date: issue.date || new Date(issue.createdAt || Date.now()).toLocaleDateString(),
          createdAt: issue.createdAt || Date.now(),
          type: "REVERSAL",
          badge: { label: "REVERSAL", color: "bg-amber-100 text-amber-800 border-amber-200" },
          productId: pId,
          productName: prodEntry.productName,
          category: prodEntry.category,
          quantity: revQty,
          unit: item.unit || prodEntry.unit,
          price: unitRate,
          value: Math.abs(revQty) * unitRate,
          from: "Reversal",
          to: "Company Stock",
          reference: issue.referenceId || issue.id || "N/A",
          userName: issue.createdByName || "Admin",
          notes: issue.notes || "Transaction Reversal",
          status: "COMPLETED",
          rawIssue: issue
        });
      }
    });
  });

  // 2. Process Sales / Consumption from Invoices
  if (Array.isArray(invoices)) {
    invoices.forEach((inv) => {
      const creatorUid = inv.createdByUid;
      const creatorRole = inv.createdByRole;
      const creatorUserId = inv.createdByUserId;
      const creatorName = inv.createdByName;

      const isAdminInvoice =
        creatorRole === "admin" ||
        creatorUid === "admin_uid_2026" ||
        creatorUid === "admin_legacy" ||
        creatorUserId === "admin" ||
        (!creatorUid && creatorName === "Admin");

      const prods = inv.products || [];
      prods.forEach((lineItem) => {
        const qty = Number(lineItem.quantity) || 0;
        if (qty <= 0) return;

        const prodEntry = getProductEntry(lineItem);
        const pId = prodEntry.id;
        const unitRate = Number(lineItem.price || prodEntry.sellingPrice || 0);

        prodEntry.totalSold += qty;

        if (isAdminInvoice) {
          // Direct Admin Sales deduct from Company Stock
          prodEntry.companyStock -= qty;
        } else if (creatorUid) {
          // Employee Sales deduct from Employee Stock
          const empObj = ensureEmployee(creatorUid, creatorName || "Employee");
          if (empObj) {
            if (!empObj.products[pId]) {
              empObj.products[pId] = {
                productId: pId,
                productName: prodEntry.productName,
                image: prodEntry.image || null,
                category: prodEntry.category || "General",
                unit: lineItem.unit || prodEntry.unit,
                unitPrice: unitRate,
                receivedFromCompany: 0,
                receivedFromEmployees: 0,
                transferredToEmployees: 0,
                sold: 0,
                balance: 0,
                stockValue: 0
              };
            }
            empObj.products[pId].sold += qty;
            empObj.products[pId].balance -= qty;
            empObj.totalSold += qty;
            empObj.salesRecords.push(inv);
          }
        }

        processedLogs.push({
          id: `INV-${inv.id}-${pId}`,
          rawInvoice: inv,
          date: inv.invoiceDate || new Date(inv.createdAt || Date.now()).toLocaleDateString(),
          createdAt: inv.createdAt || Date.now(),
          type: "SALE",
          badge: { label: "SALE", color: "bg-rose-100 text-rose-800 border-rose-200" },
          productId: pId,
          productName: prodEntry.productName,
          category: prodEntry.category,
          quantity: qty,
          unit: lineItem.unit || prodEntry.unit,
          price: unitRate,
          value: Number(lineItem.total) || (qty * unitRate),
          from: isAdminInvoice ? "Company Stock" : (creatorName || "Employee Stock"),
          to: inv.customerName || "Customer",
          reference: inv.invoiceNumber || inv.id,
          userName: creatorName || "Sales Rep",
          notes: `Invoice #${inv.invoiceNumber || inv.id}`,
          status: "COMPLETED"
        });
      });
    });
  }

  // 3. Compute Employee Balances & Total Employee Stock
  let totalEmployeeStockValue = 0;
  let totalEmployeeStockQty = 0;

  Object.values(employeeStockMap).forEach((emp) => {
    let empBal = 0;
    let empVal = 0;

    const productList = Object.values(emp.products).map((p) => {
      p.balance = (p.receivedFromCompany || 0) + (p.receivedFromEmployees || 0) - (p.transferredToEmployees || 0) - (p.sold || 0);
      p.stockValue = Math.max(0, p.balance) * p.unitPrice;
      p.utilization = p.receivedFromCompany + p.receivedFromEmployees > 0
        ? Number(((p.sold / (p.receivedFromCompany + p.receivedFromEmployees)) * 100).toFixed(1))
        : (p.sold > 0 ? 100 : 0);
      p.utilizationFormatted = `${p.utilization}%`;

      p.status = p.balance > 0
        ? { label: "Available", color: "bg-emerald-100 text-emerald-800 border-emerald-200" }
        : { label: "Out of Stock", color: "bg-red-100 text-red-800 border-red-200" };

      empBal += p.balance;
      empVal += p.stockValue;
      return p;
    }).sort((a, b) => b.sold - a.sold || b.balance - a.balance);

    emp.productList = productList;
    emp.currentBalance = empBal;
    emp.totalStockValue = empVal;

    emp.overallUtilization = emp.totalIssued > 0
      ? Number(((emp.totalSold / emp.totalIssued) * 100).toFixed(1))
      : 0;
    emp.overallUtilizationFormatted = `${emp.overallUtilization}%`;

    emp.status = emp.currentBalance > 0
      ? { label: "Stock Remaining", color: "bg-amber-100 text-amber-700 border-amber-200" }
      : { label: "Normal", color: "bg-green-100 text-green-700 border-green-200" };

    totalEmployeeStockQty += Math.max(0, empBal);
    totalEmployeeStockValue += empVal;
  });

  // 4. Compute Final Product Balances, Values & Status
  let totalCompanyStockValue = 0;
  let totalCompanyStockQty = 0;

  Object.values(productsLedger).forEach((prod) => {
    let productEmpStock = 0;
    Object.values(employeeStockMap).forEach((emp) => {
      if (emp.products[prod.id]) {
        productEmpStock += Math.max(0, emp.products[prod.id].balance);
      }
    });

    prod.employeeStock = productEmpStock;
    prod.totalCurrentBalance = prod.companyStock + productEmpStock;

    prod.companyStockValue = prod.companyStock * prod.sellingPrice;
    prod.employeeStockValue = productEmpStock * prod.sellingPrice;
    prod.totalStockValue = prod.totalCurrentBalance * prod.sellingPrice;

    prod.status = prod.totalCurrentBalance > 0 ? "AVAILABLE" : "OUT OF STOCK";

    totalCompanyStockQty += prod.companyStock;
    totalCompanyStockValue += prod.companyStockValue;
  });

  const grandTotalStockValue = totalCompanyStockValue + totalEmployeeStockValue;
  const grandTotalCurrentBalance = totalCompanyStockQty + totalEmployeeStockQty;

  // Sort logs latest first
  processedLogs.sort((a, b) => b.createdAt - a.createdAt);

  return {
    productsLedger,
    productsList: Object.values(productsLedger),
    employeeStockMap,
    employeesList: Object.values(employeeStockMap),
    resolveEmpUid,
    summary: {
      companyStockQty: totalCompanyStockQty,
      companyStockValue: totalCompanyStockValue,
      employeeStockQty: totalEmployeeStockQty,
      totalEmployeeStockValue: totalEmployeeStockValue,
      totalStockQty: grandTotalCurrentBalance,
      totalStockValue: grandTotalStockValue
    },
    transactionsLog: processedLogs
  };
};

/**
 * Dynamic Admin Central Company Stock Engine
 * Wrapper around single-source-of-truth calculateStockLedger
 */
export const calculateAdminCentralStock = ({
  productsList = [],
  stockIssues = [],
  invoices = []
}) => {
  const ledger = calculateStockLedger({
    productsList,
    stockIssues,
    invoices
  });

  const adminStockMap = {};
  Object.values(ledger.productsLedger).forEach((p) => {
    adminStockMap[p.id] = {
      id: p.id,
      productId: p.id,
      productName: p.productName,
      category: p.category,
      sellingPrice: p.sellingPrice,
      unit: p.unit,
      image: p.image,
      totalStockAdded: p.totalStockAdded,
      totalStockTransferred: p.employeeStock,
      totalAdminInvoiced: p.totalSold,
      currentAdminStock: p.companyStock,
      totalStockValue: p.companyStockValue
    };
  });

  return {
    adminStockMap,
    adminProducts: Object.values(adminStockMap),
    totalAdminStockQty: ledger.summary.companyStockQty,
    totalAdminStockValue: ledger.summary.companyStockValue
  };
};

/**
 * Employee Product Stock & Sales Reconciliation Calculation Engine
 * Single Source of Truth delegate
 */
export const calculateEmployeeStockReconciliation = ({
  stockIssues = [],
  invoices = [],
  employeesList = [],
  productsList = [],
  filterType = "all",
  startDate = "",
  endDate = "",
  targetEmployeeUid = null
}) => {
  const ledger = calculateStockLedger({
    productsList,
    stockIssues,
    invoices,
    employeesList
  });

  let employeesReconciliation = ledger.employeesList;

  if (targetEmployeeUid) {
    const canonicalUid = ledger.resolveEmpUid(targetEmployeeUid) || targetEmployeeUid;
    const empObj = ledger.employeeStockMap[canonicalUid];
    if (empObj) {
      employeesReconciliation = [empObj];
    } else {
      // Fallback matching
      const found = ledger.employeesList.find(e =>
        e.uid === targetEmployeeUid ||
        e.userId === targetEmployeeUid ||
        e.name?.toLowerCase() === String(targetEmployeeUid).toLowerCase() ||
        e.email?.toLowerCase() === String(targetEmployeeUid).toLowerCase()
      );
      employeesReconciliation = found ? [found] : [];
    }
  }

  const overallIssued = employeesReconciliation.reduce((sum, e) => sum + e.totalIssued, 0);
  const overallSold = employeesReconciliation.reduce((sum, e) => sum + e.totalSold, 0);
  const overallBalance = overallIssued - overallSold;
  const overallStockUtilization = overallIssued > 0 ? Number(((overallSold / overallIssued) * 100).toFixed(1)) : 0;
  const overallStockUtilizationFormatted = `${overallStockUtilization}%`;
  const totalEmployeeStockValue = employeesReconciliation.reduce((sum, e) => sum + e.totalStockValue, 0);

  return {
    employees: employeesReconciliation,
    overallIssued,
    overallSold,
    overallBalance,
    overallStockUtilization,
    overallStockUtilizationFormatted,
    totalCentralStockQty: ledger.summary.companyStockQty,
    totalCentralStockValue: ledger.summary.companyStockValue,
    totalEmployeeStockValue,
    totalCompanyControlledStockQty: ledger.summary.totalStockQty,
    totalCompanyStockValue: ledger.summary.totalStockValue,
    stockMismatchCount: employeesReconciliation.filter(e => e.currentBalance < 0).length,
    paymentDiffCount: 0,
    employeesWithBalanceCount: employeesReconciliation.filter(e => e.currentBalance > 0).length
  };
};

/**
 * Period Timestamp Generator for Admin Reports
 */
export const getPeriodTimestamps = (filterType = "month", startDateStr = "", endDateStr = "") => {
  const now = new Date();
  let startMs = 0;
  let endMs = Infinity;

  if (filterType === "today") {
    startMs = startOfDay(now).getTime();
    endMs = endOfDay(now).getTime();
  } else if (filterType === "week") {
    startMs = startOfWeek(now, { weekStartsOn: 1 }).getTime();
    endMs = endOfWeek(now, { weekStartsOn: 1 }).getTime();
  } else if (filterType === "month") {
    startMs = startOfMonth(now).getTime();
    endMs = endOfMonth(now).getTime();
  } else if (filterType === "custom") {
    if (startDateStr) startMs = startOfDay(new Date(startDateStr)).getTime();
    if (endDateStr) endMs = endOfDay(new Date(endDateStr)).getTime();
  } else {
    // "all"
    startMs = 0;
    endMs = Infinity;
  }

  return { startMs, endMs };
};

/**
 * Dynamic Admin Employee Sales & Stock Report Calculation Engine
 * Period-based continuous ledger report for opening stock, stock issued, stock sold, remaining, sales %, revenue, expenses & net balance.
 */
export const calculatePeriodEmployeeStockReport = ({
  stockIssues = [],
  invoices = [],
  expenses = [],
  employeesList = [],
  productsList = [],
  filterType = "month",
  startDate = "",
  endDate = ""
}) => {
  const { startMs, endMs } = getPeriodTimestamps(filterType, startDate, endDate);

  const empMap = {};
  if (Array.isArray(employeesList)) {
    employeesList.forEach(e => {
      if (e && e.uid) empMap[e.uid] = e;
    });
  }

  const prodMapById = {};
  const prodMapByName = {};
  if (Array.isArray(productsList)) {
    productsList.forEach(p => {
      if (p && p.id) prodMapById[p.id] = p;
      if (p && (p.productName || p.name)) {
        prodMapByName[(p.productName || p.name).trim().toLowerCase()] = p;
      }
    });
  }

  const employeesData = {};

  const ensureEmp = (uid, defaultName = "Employee") => {
    if (!employeesData[uid]) {
      const eDb = empMap[uid];
      const photo = eDb?.photoURL || eDb?.photoUrl || eDb?.photo || eDb?.profilePhoto || eDb?.avatarUrl || "";
      employeesData[uid] = {
        uid,
        name: eDb?.name || defaultName,
        photoURL: photo,
        email: eDb?.email || "",
        phone: eDb?.phone || "",
        role: eDb?.role || "employee",
        status: eDb?.status || "active",
        openingStock: 0,
        issuedDuringPeriod: 0,
        totalAvailable: 0,
        soldDuringPeriod: 0,
        remainingStock: 0,
        salesPercentage: 0,
        salesPercentageFormatted: "0%",
        revenue: 0,
        expenses: 0,
        netBalance: 0,
        products: {}
      };
    }
    return employeesData[uid];
  };

  // Pre-initialize from employees list
  if (Array.isArray(employeesList)) {
    employeesList.forEach(e => {
      if (e && e.uid) ensureEmp(e.uid, e.name);
    });
  }

  // 1. Process Stock Issues
  stockIssues.forEach(issue => {
    const uid = issue.employeeId;
    if (!uid) return;

    let issueTs = issue.createdAt || Date.now();
    if (issue.date) {
      const [y, m, d] = issue.date.split('-');
      if (y && m && d) issueTs = new Date(y, m - 1, d).getTime();
    }

    const empObj = ensureEmp(uid, issue.employeeName);
    const items = Array.isArray(issue.products) && issue.products.length > 0
      ? issue.products
      : (issue.quantity ? [{
        productId: issue.productId,
        productName: issue.productName,
        quantity: issue.quantity,
        unit: issue.unit,
        price: issue.price
      }] : []);

    items.forEach(item => {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return;

      const rawId = (item.productId || "").trim();
      const rawName = (item.productName || "Unknown Product").trim();
      const normName = rawName.toLowerCase();
      const dbProd = (rawId && prodMapById[rawId]) || prodMapByName[normName] || null;

      const pId = dbProd?.id || (rawId !== "" ? rawId : normName);
      const pName = dbProd?.productName || dbProd?.name || item.productName || "Product";
      const image = dbProd?.image || dbProd?.imageUrl || dbProd?.photo || null;
      const category = dbProd?.category || "General";
      const unit = item.unit || dbProd?.unit || "units";
      const price = Number(item.price || dbProd?.sellingPrice || 0);

      if (!empObj.products[pId]) {
        empObj.products[pId] = {
          productId: pId,
          productName: pName,
          image,
          category,
          unit,
          unitPrice: price,
          openingStock: 0,
          issuedDuringPeriod: 0,
          totalAvailable: 0,
          soldDuringPeriod: 0,
          remainingStock: 0,
          salesPercentage: 0,
          salesPercentageFormatted: "0%",
          revenue: 0,
          invoiceCount: 0,
          firstSaleDate: null,
          lastSaleDate: null
        };
      }
      const prodObj = empObj.products[pId];
      if (!prodObj.image && image) prodObj.image = image;
      if (price > 0) prodObj.unitPrice = price;

      if (issueTs < startMs) {
        prodObj.openingStock += qty;
      } else if (issueTs >= startMs && issueTs <= endMs) {
        prodObj.issuedDuringPeriod += qty;
      }
    });
  });

  // 2. Process Invoices / Sales (using historical invoice item total and price)
  invoices.forEach(inv => {
    const uid = inv.createdByUid;
    if (!uid) return;

    let saleTs = inv.createdAt || Date.now();
    if (inv.invoiceDate) {
      const [y, m, d] = inv.invoiceDate.split('-');
      if (y && m && d) saleTs = new Date(y, m - 1, d).getTime();
    }

    const empObj = ensureEmp(uid, inv.createdByName);
    const prods = inv.products || [];

    prods.forEach(p => {
      const qty = Number(p.quantity) || 0;
      if (qty <= 0) return;

      const rawId = (p.productId || "").trim();
      const rawName = (p.productName || p.name || "Unknown Product").trim();
      const normName = rawName.toLowerCase();
      const dbProd = (rawId && prodMapById[rawId]) || prodMapByName[normName] || null;

      const pId = dbProd?.id || (rawId !== "" ? rawId : normName);
      const pName = dbProd?.productName || dbProd?.name || p.productName || "Product";
      const image = dbProd?.image || dbProd?.imageUrl || dbProd?.photo || null;
      const category = dbProd?.category || p.category || "General";
      const unitPrice = Number(p.price || dbProd?.sellingPrice || 0);
      const lineTotal = Number(p.total) || (qty * unitPrice);

      if (!empObj.products[pId]) {
        empObj.products[pId] = {
          productId: pId,
          productName: pName,
          image,
          category,
          unit: "units",
          unitPrice,
          openingStock: 0,
          issuedDuringPeriod: 0,
          totalAvailable: 0,
          soldDuringPeriod: 0,
          remainingStock: 0,
          salesPercentage: 0,
          salesPercentageFormatted: "0%",
          revenue: 0,
          invoiceCount: 0,
          firstSaleDate: null,
          lastSaleDate: null
        };
      }
      const prodObj = empObj.products[pId];
      if (!prodObj.image && image) prodObj.image = image;

      if (saleTs < startMs) {
        prodObj.openingStock -= qty;
      } else if (saleTs >= startMs && saleTs <= endMs) {
        prodObj.soldDuringPeriod += qty;
        prodObj.revenue += lineTotal;
        prodObj.invoiceCount += 1;

        if (!prodObj.firstSaleDate || saleTs < prodObj.firstSaleDate) {
          prodObj.firstSaleDate = saleTs;
        }
        if (!prodObj.lastSaleDate || saleTs > prodObj.lastSaleDate) {
          prodObj.lastSaleDate = saleTs;
        }
      }
    });
  });

  // 3. Process Expenses during period
  expenses.forEach(exp => {
    const uid = exp.createdByUid;
    if (!uid) return;

    let expTs = exp.createdAt || Date.now();
    if (exp.date) {
      const [y, m, d] = exp.date.split('-');
      if (y && m && d) expTs = new Date(y, m - 1, d).getTime();
    }

    if (expTs >= startMs && expTs <= endMs) {
      const empObj = ensureEmp(uid, exp.createdByName);
      empObj.expenses += Number(exp.amount) || 0;
    }
  });

  // 4. Calculate Final Product and Employee Totals
  const reportList = Object.values(employeesData).map(emp => {
    let empOpening = 0;
    let empIssued = 0;
    let empSold = 0;
    let empRevenue = 0;

    const productList = Object.values(emp.products).map(p => {
      p.openingStock = Math.max(0, p.openingStock);
      p.totalAvailable = p.openingStock + p.issuedDuringPeriod;
      p.remainingStock = p.totalAvailable - p.soldDuringPeriod;

      p.salesPercentage = p.totalAvailable > 0
        ? Number(((p.soldDuringPeriod / p.totalAvailable) * 100).toFixed(1))
        : (p.soldDuringPeriod > 0 ? 100 : 0);
      p.salesPercentageFormatted = `${p.salesPercentage}%`;

      p.avgSellingRate = p.soldDuringPeriod > 0
        ? Math.round(p.revenue / p.soldDuringPeriod)
        : p.unitPrice;

      empOpening += p.openingStock;
      empIssued += p.issuedDuringPeriod;
      empSold += p.soldDuringPeriod;
      empRevenue += p.revenue;

      return p;
    }).sort((a, b) => b.soldDuringPeriod - a.soldDuringPeriod || b.revenue - a.revenue);

    emp.productsList = productList;
    emp.openingStock = empOpening;
    emp.issuedDuringPeriod = empIssued;
    emp.totalAvailable = empOpening + empIssued;
    emp.soldDuringPeriod = empSold;
    emp.remainingStock = emp.totalAvailable - empSold;
    emp.salesPercentage = emp.totalAvailable > 0
      ? Number(((empSold / emp.totalAvailable) * 100).toFixed(1))
      : (empSold > 0 ? 100 : 0);
    emp.salesPercentageFormatted = `${emp.salesPercentage}%`;

    emp.revenue = empRevenue;
    emp.netBalance = emp.revenue - emp.expenses;

    return emp;
  }).sort((a, b) => b.revenue - a.revenue || b.soldDuringPeriod - a.soldDuringPeriod);

  // Overall Grand Totals across all employees for period
  const totalOpeningStock = reportList.reduce((sum, e) => sum + e.openingStock, 0);
  const totalIssued = reportList.reduce((sum, e) => sum + e.issuedDuringPeriod, 0);
  const totalAvailable = reportList.reduce((sum, e) => sum + e.totalAvailable, 0);
  const totalSold = reportList.reduce((sum, e) => sum + e.soldDuringPeriod, 0);
  const totalRemaining = reportList.reduce((sum, e) => sum + e.remainingStock, 0);
  const totalRevenue = reportList.reduce((sum, e) => sum + e.revenue, 0);
  const totalExpenses = reportList.reduce((sum, e) => sum + e.expenses, 0);
  const totalNetBalance = totalRevenue - totalExpenses;
  const overallSalesPercentage = totalAvailable > 0
    ? Number(((totalSold / totalAvailable) * 100).toFixed(1))
    : 0;

  // Aggregate overall product sales distribution for visual chart
  const overallProductMap = {};
  reportList.forEach(e => {
    e.productsList.forEach(p => {
      if (p.soldDuringPeriod <= 0 && p.revenue <= 0) return;
      if (!overallProductMap[p.productId]) {
        overallProductMap[p.productId] = {
          productId: p.productId,
          productName: p.productName,
          category: p.category,
          quantitySold: 0,
          revenue: 0
        };
      }
      overallProductMap[p.productId].quantitySold += p.soldDuringPeriod;
      overallProductMap[p.productId].revenue += p.revenue;
    });
  });

  const overallProductSalesList = Object.values(overallProductMap)
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue);

  overallProductSalesList.forEach(p => {
    p.percentage = totalSold > 0 ? Number(((p.quantitySold / totalSold) * 100).toFixed(1)) : 0;
    p.percentageFormatted = `${p.percentage}%`;
  });

  const highestSoldProduct = overallProductSalesList.length > 0 ? overallProductSalesList[0] : null;

  return {
    employeesReport: reportList,
    summary: {
      openingStock: totalOpeningStock,
      stockIssued: totalIssued,
      totalAvailable: totalAvailable,
      totalSold: totalSold,
      remainingStock: totalRemaining,
      overallSalesPercentage,
      overallSalesPercentageFormatted: `${overallSalesPercentage}%`,
      totalRevenue,
      totalExpenses,
      netBalance: totalNetBalance
    },
    productDistribution: overallProductSalesList,
    highestSoldProduct
  };
};




