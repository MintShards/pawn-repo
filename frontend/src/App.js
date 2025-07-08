// App.js - Complete Pawnshop Management System
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Auth/Login';
import { FirstTimeSetup } from './components/Auth/FirstTimeSetup';
import { AuthProvider, AuthConsumer } from './context/JWTAuthContext';
import { Flex, Spinner, Text, VStack } from '@chakra-ui/react';
import { PublicRoute } from './components/Auth/PublicRoute';
import { Authenticated } from './components/Auth/Authenticated';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import CustomerList from './components/Customers/CustomerList';
import CustomerForm from './components/Customers/CustomerForm';
import TransactionList from './components/Transactions/TransactionList';
import NewPawnLoan from './components/Transactions/NewPawnLoan';
import Reports from './components/Reports/Reports';

const App = () => {
  return (
    <AuthProvider>
      <AuthConsumer>
        {(auth) => !auth.isInitialized ? (
          <Flex height="100vh" justifyContent="center" alignItems="center">
            <VStack spacing={4}>
              <Spinner 
                thickness='4px'
                speed='0.65s'
                emptyColor='green.200'
                size='xl'
                color='green.500'
              />
              <Text color="gray.600">Initializing Pawn Repo...</Text>
            </VStack>
          </Flex>
        ) : (
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              
              <Route 
                path="/setup" 
                element={
                  <PublicRoute>
                    <FirstTimeSetup />
                  </PublicRoute>
                } 
              />
              
              {/* Protected Routes with Layout */}
              <Route 
                path="/" 
                element={
                  <Authenticated>
                    <Layout />
                  </Authenticated>
                }
              >
                {/* Dashboard */}
                <Route index element={<Navigate to="/dashboard" />} />
                <Route path="dashboard" element={<Dashboard />} />
                
                {/* Customer Management */}
                <Route path="customers" element={<CustomerList />} />
                <Route path="customers/new" element={<CustomerForm />} />
                <Route path="customers/:customerId" element={<div>Customer Details (Coming Soon)</div>} />
                <Route path="customers/:customerId/edit" element={<CustomerForm />} />
                
                
                {/* Transaction Management */}
                <Route path="transactions" element={<TransactionList />} />
                <Route path="transactions/new" element={<NewPawnLoan />} />
                <Route path="transactions/payment" element={<div>Payment Processing (Coming Soon)</div>} />
                
                {/* Items */}
                <Route path="items" element={<div>Items Management (Coming Soon)</div>} />
                
                {/* Reports */}
                <Route path="reports" element={<Reports />} />
                
                {/* Admin */}
                <Route path="admin" element={<div>Admin Panel (Coming Soon)</div>} />
                
                {/* Profile */}
                <Route path="profile" element={<div>User Profile (Coming Soon)</div>} />
                <Route path="profile/pin" element={<div>Change PIN (Coming Soon)</div>} />
              </Route>
              
              {/* Redirect any unknown routes to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Router>
        )}
      </AuthConsumer>
    </AuthProvider>
  );
};

export default App;