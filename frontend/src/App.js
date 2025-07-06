// App.js - Updated for PIN Authentication System
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Auth/Login';
import { FirstTimeSetup } from './components/Auth/FirstTimeSetup';
import { AuthProvider, AuthConsumer } from './context/JWTAuthContext';
import { Flex, Spinner, Text, VStack } from '@chakra-ui/react';
import { PublicRoute } from './components/Auth/PublicRoute';
import { Authenticated } from './components/Auth/Authenticated';

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
              {/* Protected Routes */}
              <Route 
                path="/" 
                element={
                  <Authenticated>
                    <div>
                      <h1>Welcome to Pawn Repo</h1>
                      <p>User: {auth.user?.full_name} (#{auth.user?.user_number})</p>
                      <p>Role: {auth.user?.role}</p>
                      <button onClick={auth.logout}>Logout</button>
                    </div>
                  </Authenticated>
                } 
              />
              
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
              
              {/* Remove the register route since we don't have self-registration */}
              
              {/* Redirect any unknown routes to home */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        )}
      </AuthConsumer>
    </AuthProvider>
  );
};

export default App;