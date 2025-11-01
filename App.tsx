import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import CustomerView from './components/customer/CustomerView';
import OwnerView from './components/owner/OwnerView';
import DeliveryView from './components/delivery/DeliveryView';
import FastLoading from './components/shared/FastLoading';
import { UserRole } from './types';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

const Main: React.FC = () => {
  const { session, profile, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return <FastLoading />;
  }

  // Show auth screen if no session
  if (!session) {
    return <Auth />;
  }

  // If session exists but no profile, show error
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Profile Error</h2>
          <p className="text-gray-600 mb-4">
            Unable to load your profile. Please try logging in again.
          </p>
          <button
            onClick={async () => {
              const { useAuth } = await import('./hooks/useAuth');
              // This is a workaround, ideally pass signOut through props
              window.location.reload();
            }}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Route based on user type
  switch (profile.user_type) {
    case UserRole.Owner:
      return <OwnerView />;
    case UserRole.Delivery:
      return <DeliveryView />;
    case UserRole.Customer:
      return <CustomerView />;
    default:
      return <Auth />;
  }
};

export default App;
