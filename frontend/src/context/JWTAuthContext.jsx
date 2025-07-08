// JWTAuthContext.jsx - Updated for PIN Authentication System
import { createContext, useEffect, useReducer } from 'react';
import { setSession, resetSession } from '../utils/sessions';
import validateToken from '../utils/jwt';
import axiosInstance from '../services/axios';


const initialState = {
    isAuthenticated: false,
    isInitialized: false,
    user: null,
    token: null
};

const reducer = (state, action) => {
    switch (action.type) {
        case 'INITIAL': {
            const { isAuthenticated, user } = action.payload;
            return {
                ...state,
                isAuthenticated,
                isInitialized: true,
                user
            };
        }
        case 'LOGIN': {
            const { user, token } = action.payload;
            return {
                ...state,
                isAuthenticated: true,
                user,
                token
            };
        }
        case 'LOGOUT': {
            return {
                ...state,
                isAuthenticated: false,
                user: null,
                token: null
            };
        }
        default:
            return state;
    }
};

export const AuthContext = createContext({
    ...initialState,
    login: () => Promise.resolve(),
    logout: () => {},
    checkFirstTimeSetup: () => Promise.resolve(),
    createFirstAdmin: () => Promise.resolve()
});

export const AuthProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const init = async () => {
            try {
                const accessToken = localStorage.getItem('accessToken');
                
                if (accessToken && validateToken(accessToken)) {
                    setSession(accessToken);
                    
                    // Test the token and get user info
                    const response = await axiosInstance.post('/auth/test-token');
                    const user = response.data;
                    
                    dispatch({
                        type: 'INITIAL',
                        payload: {
                            isAuthenticated: true,
                            user
                        }
                    });
                } else {
                    dispatch({
                        type: 'INITIAL',
                        payload: {
                            isAuthenticated: false,
                            user: null
                        }
                    });
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                resetSession();
                dispatch({
                    type: 'INITIAL',
                    payload: {
                        isAuthenticated: false,
                        user: null
                    }
                });
            }
        };

        init();
    }, []);

    // Check if first time setup is needed
    const checkFirstTimeSetup = async () => {
        try {
            const response = await axiosInstance.get('/auth/setup/check');
            return response.data;
        } catch (error) {
            console.error('Error checking setup status:', error);
            throw new Error('Failed to check system setup status');
        }
    };

    // Create first admin user
    const createFirstAdmin = async (adminData) => {
        try {
            const response = await axiosInstance.post('/auth/setup/admin', adminData);
            return response.data;
        } catch (error) {
            console.error('Error creating first admin:', error);
            const errorMessage = error.response?.data?.detail || 'Failed to create admin user';
            throw new Error(errorMessage);
        }
    };

    // Login with user number and PIN
    const login = async (userNumber, pin) => {
        try {
            const loginData = {
                user_number: parseInt(userNumber),
                pin: pin
            };

            const response = await axiosInstance.post('/auth/login', loginData);
            const { access_token, refresh_token, user } = response.data;

            setSession(access_token, refresh_token);
            
            dispatch({
                type: 'LOGIN',
                payload: {
                    user,
                    token: access_token
                }
            });

            return { user, token: access_token };
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error.response?.data?.detail || 'Invalid user number or PIN';
            throw new Error(errorMessage);
        }
    };

    // Logout
    const logout = () => {
        resetSession();
        dispatch({ type: 'LOGOUT' });
    };

    // Refresh token
    const refreshToken = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await axiosInstance.post('/auth/refresh', {
                refresh_token: refreshToken
            });

            const { access_token, refresh_token: newRefreshToken } = response.data;
            setSession(access_token, newRefreshToken);

            return access_token;
        } catch (error) {
            console.error('Token refresh error:', error);
            logout();
            throw error;
        }
    };

    // Update user PIN
    const updateUserPin = async (currentPin, newPin) => {
        try {
            const response = await axiosInstance.post('/users/me/pin/update', {
                current_pin: currentPin,
                new_pin: newPin,
                confirm_new_pin: newPin
            });
            return response.data;
        } catch (error) {
            console.error('PIN update error:', error);
            const errorMessage = error.response?.data?.detail || 'Failed to update PIN';
            throw new Error(errorMessage);
        }
    };

    // Check PIN strength
    const checkPinStrength = async (pin) => {
        try {
            const response = await axiosInstance.post('/auth/pin/check-strength', {
                pin: pin
            });
            return response.data;
        } catch (error) {
            console.error('PIN strength check error:', error);
            return { is_strong: false, score: 1, feedback: ['Unable to check PIN strength'], suggestions: [] };
        }
    };

    return (
        <AuthContext.Provider
            value={{
                ...state,
                login,
                logout,
                refreshToken,
                checkFirstTimeSetup,
                createFirstAdmin,
                updateUserPin,
                checkPinStrength
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const AuthConsumer = AuthContext.Consumer;