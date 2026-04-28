import React, { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { registerApi } from '../authService';
import { setCredentials } from '../authSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

interface SignupFormProps {
  onSwitchToLogin: () => void;
}


export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
    if (errors[e.target.id]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[e.target.id];
        return next;
      });
    }
    if (authError) setAuthError(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username) newErrors.username = 'Username is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password && formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError(null);
    
    if (!validate()) return;

    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      const data = await registerApi(registerData);
      dispatch(setCredentials(data));
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during signup";
      const message = Array.isArray(errorMessage) ? errorMessage[0] : errorMessage;
      
      // Map specific backend errors to fields
      if (message.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: message }));
      } else if (message.toLowerCase().includes('username')) {
        setErrors(prev => ({ ...prev, username: message }));
      } else if (message.toLowerCase().includes('phone')) {
        setErrors(prev => ({ ...prev, phone: message }));
      } else if (message.toLowerCase().includes('password')) {
        setErrors(prev => ({ ...prev, password: message }));
      } else {
        setAuthError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/40 shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Join our chat community today
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                placeholder="John Doe" 
                className="bg-background/50 h-9" 
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="johndoe" 
                className={cn("bg-background/50 h-9", errors.username && "border-red-500/50 focus-visible:ring-red-500/50")} 
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.username && <p className="text-xs text-red-400 font-semibold mt-1">{errors.username}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john@example.com" 
              className={cn("bg-background/50 h-9", errors.email && "border-red-500/50 focus-visible:ring-red-500/50")} 
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.email && <p className="text-xs text-red-400 font-semibold mt-1">{errors.email}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="+1234567890" 
              className={cn("bg-background/50 h-9", errors.phone && "border-red-500/50 focus-visible:ring-red-500/50")} 
              value={formData.phone}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.phone && <p className="text-xs text-red-400 font-semibold mt-1">{errors.phone}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                className={cn("bg-background/50 h-9", errors.password && "border-red-500/50 focus-visible:ring-red-500/50")} 
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-red-400 font-semibold mt-1">{errors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                className={cn("bg-background/50 h-9", errors.confirmPassword && "border-red-500/50 focus-visible:ring-red-500/50")} 
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.confirmPassword && <p className="text-xs text-red-400 font-semibold mt-1">{errors.confirmPassword}</p>}
            </div>
          </div>

          {authError && (
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 mt-2">
              <p className="text-xs text-red-400 font-semibold text-center">{authError}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-2">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isLoading ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : null}
            Create Account
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <button 
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary hover:underline font-medium"
            >
              Log in
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
