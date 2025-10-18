import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Map, 
  FileText, 
  Settings, 
  Moon, 
  Sun,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Risk Map', href: '/map', icon: Map },
    { name: 'SOS Map', href: '/sos-map', icon: AlertTriangle },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Navbar */}
      <Navbar />
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col h-0 flex-1 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
              {/* Logo */}
              <div className="flex h-16 items-center justify-center border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Shield className="h-8 w-8 text-primary-600" />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    SafetyNet
                  </span>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 px-4 py-4">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        isActive
                          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 h-5 w-5 flex-shrink-0 ${
                          isActive
                            ? 'text-primary-500'
                            : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                        }`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Theme Toggle */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  {theme === 'light' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                  <span>{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1">
          <main className="flex-1 py-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="animate-fade-in">
                {children}
              </div>
            </div>
          </main>
          
          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Layout;
