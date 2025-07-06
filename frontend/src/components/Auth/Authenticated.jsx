import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate, useLocation } from 'react-router-dom';

export const Authenticated = ( props ) => {
    const { children } = props;
    const auth = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        // Only proceed if auth is initialized
        if (!auth.isInitialized) {
            return;
        }

        if (!auth.isAuthenticated){
            navigate('/login', { replace: true, state: { from: location } });
        } else {
            setIsVerified(true);
        }
    }, [auth.isAuthenticated, auth.isInitialized, navigate, location]);

    // Show nothing while auth is initializing or while verifying
    if (!auth.isInitialized || !isVerified) {
        return null; // or a loading spinner
    }
    
    return <>{children}</>
}