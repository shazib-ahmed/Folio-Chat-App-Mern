import React, { useState } from 'react';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from 'react-redux';
import { cn } from "@/shared/lib/utils";
import { loginApi } from '../authService';
import { setCredentials } from '../authSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

export function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors: { identifier?: string; password?: string } = {};
    if (!identifier) newErrors.identifier = 'Username, email or phone is required';
    if (!password) newErrors.password = 'Password is required';
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
      const data = await loginApi({ identifier, password });
      dispatch(setCredentials(data));
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "An error occurred during login";
      setAuthError(Array.isArray(errorMessage) ? errorMessage[0] : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/40 shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Username, Email or Phone</Label>
            <Input 
              id="identifier" 
              placeholder="john.doe@example.com" 
              className={cn("bg-background/50", errors.identifier && "border-red-500/50 focus-visible:ring-red-500/50")} 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
            />
            {errors.identifier && <p className="text-xs text-red-400 font-semibold mt-1">{errors.identifier}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="#" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                className={cn("bg-background/50 pr-10", errors.password && "border-red-500/50 focus-visible:ring-red-500/50")} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="h-4 w-4" />
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400 font-semibold mt-1">{errors.password}</p>}
          </div>

          {authError && (
            <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 font-semibold text-center">{authError}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isLoading ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : null}
            Sign In
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Don't have an account?{" "}
            <button 
              type="button"
              onClick={onSwitchToSignup}
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
