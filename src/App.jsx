import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PwaProvider } from './context/PwaContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import Invoice from './pages/Invoice';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Employees from './pages/Employees';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

function RootRedirect() {
  const { role } = useAuth();
  if (role === "employee") {
    return <Navigate to="/employee-dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <PwaProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes Wrapper with Layout */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<RootRedirect />} />
                
                {/* Admin-only Routes */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="add-product" element={<AddProduct />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* Employee-only Routes */}
                <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
                  <Route path="employee-dashboard" element={<EmployeeDashboard />} />
                </Route>

                {/* Shared Routes (Accessible to both Admin & Employee) */}
                <Route element={<ProtectedRoute allowedRoles={['admin', 'employee']} />}>
                  <Route path="invoice" element={<Invoice />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback Route */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PwaProvider>
  );
}

export default App;

