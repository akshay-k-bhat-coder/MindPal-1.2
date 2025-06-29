import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { 
  Brain, 
  Home, 
  CheckSquare, 
  Heart, 
  Mic, 
  Video,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  Zap,
  Star,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { isSupabaseConfigured } from '../lib/supabase';
import toast from 'react-hot-toast';

const FloatingIcon = ({ icon: Icon, delay }: { icon: any; delay: number }) => (
  <motion.div
    className="absolute text-purple-300/20"
    initial={{ y: 100, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800), opacity: 0 }}
    animate={{
      y: -100,
      x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800),
      opacity: [0, 1, 0],
      rotate: 360,
    }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: "easeOut"
    }}
  >
    <Icon className="h-6 w-6" />
  </motion.div>
);

export function Layout() {
  const { user, signOut } = useAuth();
  const { isOnline, isSupabaseConnected, checkConnection, isChecking } = useNetworkStatus();
  const location = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const { scrollY } = useScroll();
  
  const headerY = useTransform(scrollY, [0, 100], [0, -50]);
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.8]);

  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.warn('Sign out error:', error);
        toast.error('Error signing out, but you have been logged out locally');
      } else {
        toast.success('Signed out successfully ✨');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      toast.success('Signed out successfully ✨'); // Still show success since local state is cleared
    }
  };

  const handleRetryConnection = async () => {
    if (isChecking) return;
    
    const toastId = 'retry-connection';
    toast.loading('Checking connection...', { id: toastId });
    
    try {
      const isConnected = await checkConnection();
      
      if (isConnected) {
        toast.success('Connection restored! 🎉', { id: toastId });
      } else {
        toast.error('Still having connection issues. Please check your internet connection.', { id: toastId });
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      toast.error('Connection check failed', { id: toastId });
    }
  };

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard', color: 'from-blue-500 to-cyan-500' },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks', color: 'from-green-500 to-emerald-500' },
    { icon: Heart, label: 'Mood', path: '/mood', color: 'from-pink-500 to-rose-500' },
    { icon: Mic, label: 'Voice AI', path: '/voice', color: 'from-purple-500 to-violet-500' },
    { icon: Video, label: 'Video', path: '/video', color: 'from-indigo-500 to-blue-500' },
    { icon: Settings, label: 'Settings', path: '/settings', color: 'from-gray-500 to-slate-500' },
  ];

  // Determine what issues we have
  const hasConfigIssue = !isConfigured;
  const hasNetworkIssue = !isOnline && navigator.onLine === false;
  const hasSupabaseIssue = isOnline && !isSupabaseConnected;
  
  const showBanner = hasConfigIssue || hasNetworkIssue || hasSupabaseIssue;

  const getBannerConfig = () => {
    if (hasConfigIssue) {
      return {
        type: 'error',
        icon: AlertTriangle,
        title: 'Configuration Required',
        message: 'Supabase environment variables are not configured. Please check your .env file.',
        bgColor: 'bg-gradient-to-r from-red-600 to-red-700',
        showRetry: false
      };
    }
    
    if (hasNetworkIssue) {
      return {
        type: 'warning',
        icon: WifiOff,
        title: 'No Internet Connection',
        message: 'Please check your internet connection. Some features may not work properly.',
        bgColor: 'bg-gradient-to-r from-orange-600 to-red-600',
        showRetry: true
      };
    }
    
    if (hasSupabaseIssue) {
      return {
        type: 'warning',
        icon: WifiOff,
        title: 'Server Connection Issues',
        message: 'Having trouble connecting to our servers. Retrying automatically...',
        bgColor: 'bg-gradient-to-r from-yellow-600 to-orange-600',
        showRetry: true
      };
    }
    
    return null;
  };

  const bannerConfig = getBannerConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width=%2260%22%20height=%2260%22%20viewBox=%220%200%2060%2060%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill=%22none%22%20fill-rule=%22evenodd%22%3E%3Cg%20fill=%22%239C92AC%22%20fill-opacity=%220.05%22%3E%3Ccircle%20cx=%2230%22%20cy=%2230%22%20r=%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse"></div>
        
        {/* Floating Icons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <FloatingIcon 
            key={i} 
            icon={[Brain, Heart, Sparkles, Zap, Star][i % 5]} 
            delay={i * 2} 
          />
        ))}
        
        {/* Mouse Follower */}
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)',
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Connection Status Banner */}
      <AnimatePresence>
        {showBanner && bannerConfig && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`relative z-50 ${bannerConfig.bgColor} text-white px-4 py-3 shadow-lg`}
          >
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center space-x-3">
                <motion.div
                  animate={{ rotate: bannerConfig.type === 'error' ? 0 : 360 }}
                  transition={{ duration: 2, repeat: bannerConfig.type === 'error' ? 0 : Infinity, ease: "linear" }}
                >
                  <bannerConfig.icon className="h-5 w-5" />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm">{bannerConfig.title}</p>
                  <p className="text-xs opacity-90">{bannerConfig.message}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Connection Details */}
                <button
                  onClick={() => setShowConnectionDetails(!showConnectionDetails)}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors duration-200"
                >
                  Details
                </button>
                
                {bannerConfig.showRetry && (
                  <motion.button
                    onClick={handleRetryConnection}
                    disabled={isChecking}
                    className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs transition-colors duration-200 flex items-center space-x-1 disabled:opacity-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>{isChecking ? 'Checking...' : 'Retry'}</span>
                  </motion.button>
                )}
              </div>
            </div>
            
            {/* Connection Details Panel */}
            <AnimatePresence>
              {showConnectionDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-white/20"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span>Configuration: {isConfigured ? 'OK' : 'Missing'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span>Internet: {isOnline ? 'Connected' : 'Offline'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isSupabaseConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span>Database: {isSupabaseConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        className="relative z-40 bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0"
        style={{ y: headerY, opacity: headerOpacity }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <motion.div
                className="relative"
                whileHover={{ scale: 1.1, rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-xl">
                  <Brain className="h-6 w-6 text-white" />
                </div>
              </motion.div>
              <motion.span
                className="text-xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
                whileHover={{ scale: 1.05 }}
              >
                MindPal
              </motion.span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      to={item.path}
                      className="relative group"
                    >
                      <motion.div
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                          isActive
                            ? 'bg-white/10 text-white shadow-lg'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <motion.div
                          className={`p-1 rounded-lg bg-gradient-to-r ${item.color} ${
                            isActive ? 'shadow-lg' : ''
                          }`}
                          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </motion.div>
                        <span className="text-sm font-medium">{item.label}</span>
                      </motion.div>
                      
                      {isActive && (
                        <motion.div
                          className="absolute -bottom-1 left-1/2 w-1 h-1 bg-white rounded-full"
                          layoutId="activeIndicator"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Connection Status Indicator */}
              <div className="flex items-center space-x-2">
                <motion.div
                  className={`w-2 h-2 rounded-full ${
                    isOnline && isSupabaseConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs text-white/60 hidden sm:block">
                  {isOnline && isSupabaseConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
              
              <motion.div
                className="text-sm text-white/80 hidden sm:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Welcome, <span className="text-white font-medium">{user?.email?.split('@')[0]}</span>
              </motion.div>
              <motion.button
                onClick={handleSignOut}
                className="p-2 text-white/60 hover:text-red-400 transition-colors duration-200 rounded-lg hover:bg-white/5"
                title="Sign out"
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
              >
                <LogOut className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-xl border-t border-white/10">
        <div className="flex justify-around py-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={item.path}
                  className="relative"
                >
                  <motion.div
                    className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <motion.div
                      className={`p-1 rounded-lg bg-gradient-to-r ${item.color} ${
                        isActive ? 'shadow-lg' : ''
                      }`}
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </motion.div>
                    <span className="text-xs mt-1 font-medium">{item.label}</span>
                  </motion.div>
                  
                  {isActive && (
                    <motion.div
                      className="absolute -top-1 left-1/2 w-1 h-1 bg-white rounded-full"
                      layoutId="mobileActiveIndicator"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}