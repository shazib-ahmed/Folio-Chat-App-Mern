import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { SignupForm } from '../components/SignupForm';
import { usePageTitle } from '@/shared/hooks/usePageTitle';

import { ThemeSwitcher } from '@/shared/components/ThemeSwitcher';

export function AuthPage({ initialIsLogin = true }: { initialIsLogin?: boolean }) {
  const { pathname } = useLocation();
  const [isLogin, setIsLogin] = useState(pathname === '/login');

  React.useEffect(() => {
    setIsLogin(pathname === '/login');
  }, [pathname]);

  usePageTitle(isLogin ? "Login | Folio Chat" : "Sign Up | Folio Chat");

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Theme Switcher in Auth Page */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeSwitcher />
      </div>
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-md space-y-8 relative z-10">

        <div className="transform transition-all duration-500 ease-in-out">
          {isLogin ? (
            <LoginForm />
          ) : (
            <SignupForm />
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground opacity-50">
            &copy; {new Date().getFullYear()} Folio Chat App. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
