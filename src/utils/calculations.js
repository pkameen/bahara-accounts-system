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
 * Employee Product Stock & Sales Reconciliation Calculation Engine
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
  const empMap = {};
  const prodMapById = {};
  const prodMapByName = {};

  if (Array.isArray(employeesList)) {
    employeesList.forEach((emp) => {
      if (emp && emp.uid) {
        empMap[emp.uid] = emp;
      }
    });
  }

  if (Array.isArray(productsList)) {
    productsList.forEach((p) => {
      if (p && p.id) {
        prodMapById[p.id] = p;
      }
      if (p && (p.productName || p.name)) {
        const key = (p.productName || p.name).trim().toLowerCase();
        prodMapByName[key] = p;
      }
    });
  }

  // End date timestamp cutoff if custom end date provided
  let cutoffTimestamp = Infinity;
  if (filterType === "custom" && endDate) {
    cutoffTimestamp = endOfDay(new Date(endDate)).getTime();
  }

  const isDateInPeriod = (dateVal) => {
    if (!filterType || filterType === "all") return true;
    return filterItemsByDate([{ dateVal }], filterType, startDate, endDate, "dateVal").length > 0;
  };

  let filteredIssues = stockIssues;
  let filteredInvoices = invoices;

  if (targetEmployeeUid) {
    filteredIssues = filteredIssues.filter(issue => issue.employeeId === targetEmployeeUid);
    filteredInvoices = filteredInvoices.filter(inv => inv.createdByUid === targetEmployeeUid);
  }

  const ledger = {};

  const ensureEmployee = (uid, defaultName = "Employee") => {
    if (!ledger[uid]) {
      const empDb = empMap[uid];
      const photo = empDb?.photoURL || empDb?.photoUrl || empDb?.photo || empDb?.profilePhoto || empDb?.avatarUrl || "";
      ledger[uid] = {
        uid,
        name: empDb?.name || defaultName,
        email: empDb?.email || "",
        phone: empDb?.phone || "",
        photoURL: photo,
        role: empDb?.role || "employee",
        status: empDb?.status || "active",
        totalIssued: 0,
        totalSold: 0,
        currentBalance: 0,
        overallUtilization: 0,
        overallUtilizationFormatted: "0%",
        totalStockValue: 0,
        totalSalesValue: 0,
        expectedSales: 0,
        receivedAmount: 0,
        pendingAmount: 0,
        paymentDifference: 0,
        products: {},
        issueRecords: [],
        salesRecords: []
      };
    }
    return ledger[uid];
  };

  // Pre-initialize from employees list
  if (Array.isArray(employeesList)) {
    employeesList.forEach((emp) => {
      if (emp && emp.uid) {
        ensureEmployee(emp.uid, emp.name);
      }
    });
  }

  // Process ALL Stock Issues (continuous ledger up to optional cutoff date)
  filteredIssues.forEach((issue) => {
    const empUid = issue.employeeId;
    if (!empUid) return;

    let issueDateVal = issue.createdAt || Date.now();
    if (issue.date) {
      const [y, m, d] = issue.date.split('-');
      if (y && m && d) issueDateVal = new Date(y, m - 1, d).getTime();
    }

    if (issueDateVal > cutoffTimestamp) return;

    const empObj = ensureEmployee(empUid, issue.employeeName);

    const issueRecord = {
      ...issue,
      dateVal: issueDateVal,
      formattedDate: new Date(issueDateVal).toLocaleDateString(),
      inPeriod: isDateInPeriod(issueDateVal)
    };
    empObj.issueRecords.push(issueRecord);

    const itemsToProcess = Array.isArray(issue.products) && issue.products.length > 0
      ? issue.products
      : (issue.quantity ? [{
          productId: issue.productId,
          productName: issue.productName,
          quantity: issue.quantity,
          unit: issue.unit,
          price: issue.price
        }] : []);

    itemsToProcess.forEach((item) => {
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

      empObj.totalIssued += qty;

      if (!empObj.products[pId]) {
        empObj.products[pId] = {
          productId: pId,
          productName: pName,
          image: image,
          category: category,
          unit: unit,
          unitPrice: price,
          issued: 0,
          sold: 0,
          balance: 0,
          utilization: 0,
          utilizationFormatted: "0%",
          salesShare: 0,
          salesShareFormatted: "0%",
          stockValue: 0,
          salesValue: 0,
          invoiceCount: 0
        };
      }

      empObj.products[pId].issued += qty;
      if (price > 0) {
        empObj.products[pId].unitPrice = price;
      }
      if (!empObj.products[pId].image && image) {
        empObj.products[pId].image = image;
      }
    });
  });

  // Process ALL Invoices / Sales (continuous sales tally up to optional cutoff date)
  filteredInvoices.forEach((inv) => {
    const empUid = inv.createdByUid;
    if (!empUid) return;

    let saleDateVal = inv.createdAt || Date.now();
    if (inv.invoiceDate) {
      const [y, m, d] = inv.invoiceDate.split('-');
      if (y && m && d) saleDateVal = new Date(y, m - 1, d).getTime();
    }

    if (saleDateVal > cutoffTimestamp) return;

    const empObj = ensureEmployee(empUid, inv.createdByName);
    const isPaid = (inv.paymentStatus || "paid") === "paid";

    empObj.salesRecords.push({
      ...inv,
      dateVal: saleDateVal,
      formattedDate: new Date(saleDateVal).toLocaleDateString(),
      inPeriod: isDateInPeriod(saleDateVal)
    });

    const prods = inv.products || [];
    prods.forEach((p) => {
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

      empObj.totalSold += qty;
      empObj.expectedSales += lineTotal;
      if (isPaid) {
        empObj.receivedAmount += lineTotal;
      } else {
        empObj.pendingAmount += lineTotal;
      }

      if (!empObj.products[pId]) {
        empObj.products[pId] = {
          productId: pId,
          productName: pName,
          image: image,
          category: category,
          unit: "units",
          unitPrice: unitPrice,
          issued: 0,
          sold: 0,
          balance: 0,
          utilization: 0,
          utilizationFormatted: "0%",
          salesShare: 0,
          salesShareFormatted: "0%",
          stockValue: 0,
          salesValue: 0,
          invoiceCount: 0
        };
      }

      empObj.products[pId].sold += qty;
      empObj.products[pId].salesValue += lineTotal;
      empObj.products[pId].invoiceCount += 1;

      if (!empObj.products[pId].image && image) {
        empObj.products[pId].image = image;
      }
    });
  });

  // Compute balances, utilization percentages, stock values, and status badges
  const employeesReconciliation = Object.values(ledger).map((emp) => {
    emp.currentBalance = emp.totalIssued - emp.totalSold;
    emp.overallUtilization = emp.totalIssued > 0 ? Number(((emp.totalSold / emp.totalIssued) * 100).toFixed(1)) : 0;
    emp.overallUtilizationFormatted = `${emp.overallUtilization}%`;

    emp.paymentDifference = emp.expectedSales - emp.receivedAmount;

    let hasMismatch = false;

    const productList = Object.values(emp.products).map((p) => {
      p.balance = p.issued - p.sold;

      // Stock Utilization Percentage = (Sold / Issued) * 100
      p.utilization = p.issued > 0 ? Number(((p.sold / p.issued) * 100).toFixed(1)) : (p.sold > 0 ? 100 : 0);
      p.utilizationFormatted = `${p.utilization}%`;

      // Product Sales Percentage = (Product Sold / Total Products Sold) * 100
      p.salesShare = emp.totalSold > 0 ? Number(((p.sold / emp.totalSold) * 100).toFixed(1)) : 0;
      p.salesShareFormatted = `${p.salesShare}%`;

      // Remaining Stock Value = Remaining Balance * Unit Rate
      p.stockValue = Math.max(0, p.balance) * p.unitPrice;

      let prodStatus = { label: "Stock Remaining", color: "bg-amber-50 text-amber-700 border-amber-200", code: "remaining", icon: "🟡" };
      if (p.issued === 0 && p.sold === 0) {
        prodStatus = { label: "No Stock Issued", color: "bg-gray-100 text-gray-500 border-gray-200", code: "no_stock", icon: "⚪" };
      } else if (p.balance === 0) {
        prodStatus = { label: "Fully Sold", color: "bg-green-50 text-green-700 border-green-200", code: "sold", icon: "🟢" };
      } else if (p.balance < 0) {
        hasMismatch = true;
        prodStatus = {
          label: `STOCK MISMATCH (Over-sold: ${Math.abs(p.balance)} units)`,
          color: "bg-red-100 text-red-700 border-red-200 font-bold",
          code: "mismatch",
          icon: "🔴",
          overSold: Math.abs(p.balance)
        };
      }
      p.status = prodStatus;
      return p;
    }).sort((a, b) => b.sold - a.sold || b.issued - a.issued);

    emp.productList = productList;

    // Highest selling product
    emp.highestSellingProduct = productList.length > 0 && productList[0].sold > 0 ? productList[0] : null;

    // Total Stock Value for Employee
    emp.totalStockValue = productList.reduce((sum, p) => sum + p.stockValue, 0);
    emp.totalSalesValue = productList.reduce((sum, p) => sum + p.salesValue, 0);

    // Overall Employee Status
    let status = { label: "Normal", color: "bg-green-100 text-green-700 border-green-200", code: "normal", icon: "🟢" };
    if (hasMismatch || emp.currentBalance < 0) {
      status = { label: "STOCK MISMATCH", color: "bg-red-100 text-red-700 border-red-200 font-bold", code: "stock_mismatch", icon: "🔴" };
    } else if (emp.currentBalance > 0) {
      status = { label: "Stock Remaining", color: "bg-amber-100 text-amber-700 border-amber-200", code: "stock_remaining", icon: "🟡" };
    }
    emp.status = status;

    emp.issueRecords.sort((a, b) => b.dateVal - a.dateVal);
    emp.salesRecords.sort((a, b) => b.dateVal - a.dateVal);

    return emp;
  });

  const overallIssued = employeesReconciliation.reduce((sum, e) => sum + e.totalIssued, 0);
  const overallSold = employeesReconciliation.reduce((sum, e) => sum + e.totalSold, 0);
  const overallBalance = overallIssued - overallSold;
  const overallStockUtilization = overallIssued > 0 ? Number(((overallSold / overallIssued) * 100).toFixed(1)) : 0;
  const overallStockUtilizationFormatted = `${overallStockUtilization}%`;

  const totalEmployeeStockValue = employeesReconciliation.reduce((sum, e) => sum + e.totalStockValue, 0);

  // Central Available Company Stock & Valuation
  let totalCentralStockQty = 0;
  let totalCentralStockValue = 0;

  if (Array.isArray(productsList)) {
    productsList.forEach(p => {
      const centralQty = Number(p.stock ?? p.companyStock ?? 0);
      const price = Number(p.sellingPrice || p.price || 0);
      totalCentralStockQty += Math.max(0, centralQty);
      totalCentralStockValue += Math.max(0, centralQty) * price;
    });
  }

  const totalCompanyControlledStockQty = totalCentralStockQty + Math.max(0, overallBalance);
  const totalCompanyStockValue = totalCentralStockValue + totalEmployeeStockValue;

  const stockMismatchCount = employeesReconciliation.filter(e => e.status.code === "stock_mismatch").length;
  const paymentDiffCount = employeesReconciliation.filter(e => e.paymentDifference > 0).length;
  const employeesWithBalanceCount = employeesReconciliation.filter(e => e.currentBalance > 0).length;

  return {
    employees: employeesReconciliation,
    overallIssued,
    overallSold,
    overallBalance,
    overallStockUtilization,
    overallStockUtilizationFormatted,
    totalCentralStockQty,
    totalCentralStockValue,
    totalEmployeeStockValue,
    totalCompanyControlledStockQty,
    totalCompanyStockValue,
    stockMismatchCount,
    paymentDiffCount,
    employeesWithBalanceCount
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




