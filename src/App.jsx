import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { Vote, Wallet, LogOut, CheckCircle, AlertCircle, Bell, X, User, Shield, Home } from 'lucide-react';
import axios from 'axios';
import { CONTRACT_ABI } from './utils/ABI';
import AdminDashboard from './components/AdminDashboard';
import VoterDashboard from './components/VoterDashboard';
import Notification from './components/Notification';
import NotificationPanel from './components/NotificationPanel';
import FaceAuth from './components/FaceAuth';

// Deployed Contract Address
const CONTRACT_ADDRESS = "0x219b1E30823236b188f38E933A3fad90E79C0883";

// --- Contexts ---
const RouterContext = createContext();
const Web3Context = createContext();

// --- Components ---

// Simple Router
const useRouter = () => useContext(RouterContext);
const RouterProvider = ({ children }) => {
  const [currentPage, setCurrentPage] = useState('home');
  return (
    <RouterContext.Provider value={{ currentPage, navigate: setCurrentPage }}>
      {children}
    </RouterContext.Provider>
  );
};

// Web3 Provider
const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // New Auth State
  const [isFaceVerified, setIsFaceVerified] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('notification_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('notification_history', JSON.stringify(history));
  }, [history]);

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    const newNotif = { id, message, type, timestamp: id, read: false };

    // Add to toasts (transient)
    setToasts(prev => [...prev, newNotif]);
    setTimeout(() => setToasts(prev => prev.filter(n => n.id !== id)), 5000);

    // Add to history (persistent)
    setHistory(prev => [newNotif, ...prev]);
  }, []);

  const markAsRead = (id) => {
    setHistory(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setHistory(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id) => {
    setHistory(prev => prev.filter(n => n.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Clear all notifications?")) {
      setHistory([]);
    }
  };

  const togglePanel = () => setIsPanelOpen(!isPanelOpen);

  const getContract = async (signerOrProvider) => {
    if (!CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      addNotification("MetaMask not found!", "error");
      return;
    }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const acc = await signer.getAddress();

      setAccount(acc);
      setIsConnected(true);
      addNotification("Wallet Verified. Checking registration...", "info");

      // Check backend for user registration status
      try {
        const res = await axios.get(`http://localhost:5000/api/users/${acc}`);
        if (res.data.success) {
          setIsRegistered(true);
          setUserProfile(res.data.user);
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setIsRegistered(false);
          setUserProfile(null);
        } else {
          console.error("Backend error", err);
          addNotification("Could not communicate with backend database", "warning");
        }
      }

      // Check Admin Status
      const contractInstance = await getContract(signer);

      if (contractInstance) {
        setContract(contractInstance);
        try {
          const adminAddress = await contractInstance.admin();
          if (adminAddress.toLowerCase() === acc.toLowerCase()) {
            setIsAdmin(true);
          }
        } catch (e) {
          console.error("Failed to fetch admin", e);
          addNotification("Connected, but could not verify Admin status. Check Contract Address.", "warning");
        }
      }
    } catch (error) {
      console.error(error);
      addNotification("Connection Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setIsConnected(false);
    setIsAdmin(false);
    setContract(null);
    setIsFaceVerified(false);
    setIsRegistered(false);
    setUserProfile(null);
    addNotification("Wallet Disconnected", "info");
  };

  const handleFaceVerification = (user) => {
    setIsFaceVerified(true);
    setUserProfile(user);
    setIsRegistered(true);
  };

  return (
    <Web3Context.Provider value={{
      account, isAdmin, isConnected, contract,
      connectWallet, disconnectWallet,
      isFaceVerified, setIsFaceVerified,
      isRegistered, setIsRegistered,
      userProfile, setUserProfile,
      handleFaceVerification,
      notifications: toasts,
      history, isPanelOpen, togglePanel,
      addNotification, markAsRead, markAllAsRead, removeNotification, clearHistory,
      loading, ethers
    }}>
      {children}
    </Web3Context.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWeb3 = () => useContext(Web3Context);


// --- Main Layout Components ---

const Navbar = () => {
  const { account, isConnected, isFaceVerified, isAdmin, userProfile, connectWallet, disconnectWallet, history, togglePanel } = useWeb3();
  const { navigate } = useRouter();

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('home')}>
          <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-lg">
            <Vote className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            VoteChain
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {isConnected ? (
            <>
              {isFaceVerified && (
                <>
                  {isAdmin ? (
                    <button
                      onClick={() => navigate('admin')}
                      className="px-4 py-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Admin Dashboard
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('voter')}
                      className="px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Voter Dashboard
                    </button>
                  )}
                </>
              )}

              {/* Notification Bell */}
              <button
                onClick={togglePanel}
                className="relative p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Bell className="w-5 h-5" />
                {history.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0f172a]"></span>
                )}
              </button>

              <div className="flex items-center space-x-2 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700">
                {userProfile && userProfile.name && (
                  <div className="flex items-center mr-2 pr-2 border-r border-gray-600">
                    <User className="w-4 h-4 text-blue-400 mr-1" />
                    <span className="text-sm font-medium text-gray-200">{userProfile.name}</span>
                  </div>
                )}
                <div className={`w-2 h-2 rounded-full animate-pulse ${isFaceVerified ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-sm text-gray-300 font-mono">
                  {account.substring(0, 6)}...{account.slice(-4)}
                </span>
                <button onClick={disconnectWallet} className="ml-2 text-gray-500 hover:text-red-400">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={connectWallet}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const HomePage = () => {
  const { isConnected, isFaceVerified, isAdmin } = useWeb3();
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center pt-20 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0f172a] to-[#0f172a]" />
      </div>

      <div className="relative z-10 text-center max-w-4xl space-y-8 animate-in slide-in-from-bottom duration-700 fade-in">
        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">Secure Face-Verified Blockchain Voting System</span>
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
          Destiny of the Future <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
            Decided by You
          </span>
        </h1>

        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Experience the next generation of electoral integrity. Identity verified by face recognition, voting powered by Ethereum smart contracts.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          {isConnected ? (
            isFaceVerified ? (
              <button
                onClick={() => navigate(isAdmin ? 'admin' : 'voter')}
                className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-colors flex items-center space-x-2"
              >
                <span>Go to Dashboard</span>
              </button>
            ) : (
              <div className="text-yellow-400 mb-8 font-medium bg-yellow-400/10 px-4 py-2 rounded-lg border border-yellow-400/20">
                Please verify your face to access the dashboard.
              </div>
            )
          ) : (
            <div className="text-gray-500 mb-8 italic">
              Connect your wallet to get started
            </div>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-6xl w-full px-4 text-left">
        {[
          { title: "Dual Security", desc: "Requires both Web3 Wallet and Biometric Face Verification for entry.", icon: User },
          { title: "Immutable Records", desc: "Every vote is recorded permanently on the blockchain, ensuring 100% data integrity.", icon: Shield },
          { title: "Transparency", desc: "Results are verifiable by anyone, but only released after the election ends.", icon: CheckCircle },
        ].map((feature, i) => (
          <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors">
            <feature.icon className="w-10 h-10 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-gray-400">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};


// --- App Entry Point ---

function App() {
  return (
    <RouterProvider>
      <Web3Provider>
        <div className="min-h-screen bg-[#0f172a] text-white selection:bg-blue-500/30">
          <Navbar />
          <Notification />
          <NotificationPanel />

          <MainContent />
        </div>
      </Web3Provider>
    </RouterProvider>
  );
}

// Separate component to consume router context
const MainContent = () => {
  const { currentPage } = useRouter();
  const { isConnected, isFaceVerified, isRegistered, account, addNotification, handleFaceVerification } = useWeb3();

  // If connected but not verified, force Face Verification
  if (isConnected && !isFaceVerified) {
    return (
      <div className="pt-16 min-h-screen bg-[#0f172a] text-white flex items-center justify-center pb-20">
        <FaceAuth
          account={account}
          isRegistration={!isRegistered}
          onVerified={(user) => {
            handleFaceVerification(user);
          }}
          addNotification={addNotification}
        />
      </div>
    );
  }

  return (
    <div className="pt-16">
      {currentPage === 'home' && <HomePage />}
      {currentPage === 'admin' && <AdminDashboard />}
      {currentPage === 'voter' && <VoterDashboard />}
    </div>
  );
};

export default App;