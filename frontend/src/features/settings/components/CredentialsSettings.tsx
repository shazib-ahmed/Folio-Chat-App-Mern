import React, { useState, useEffect } from 'react';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faShieldHalved, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { updatePasswordApi } from '@/features/auth/authService';
import { cn } from '@/shared/lib/utils';

export function CredentialsSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    if (errors.global) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.global;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess(false);

    // Frontend validation
    if (formData.newPassword !== formData.confirmPassword) {
      setErrors({ confirmPassword: "New passwords do not match" });
      return;
    }

    if (formData.newPassword.length < 6) {
      setErrors({ newPassword: "New password must be at least 6 characters" });
      return;
    }

    setIsLoading(true);

    try {
      await updatePasswordApi({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      });
      setSuccess(true);
      setFormData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to update password";
      const message = Array.isArray(errorMessage) ? errorMessage[0] : errorMessage;
      
      if (message.toLowerCase().includes('old password')) {
        setErrors({ oldPassword: message });
      } else {
        setErrors({ global: message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <FontAwesomeIcon icon={faShieldHalved} className="text-3xl" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="oldPassword">Current Password</Label>
          <div className="relative">
            <Input 
              id="oldPassword" 
              type={showOldPassword ? "text" : "password"} 
              value={formData.oldPassword}
              onChange={handleChange}
              className={cn("bg-background/50 pr-10", errors.oldPassword && "border-red-500/50 focus-visible:ring-red-500/50")} 
              placeholder="••••••••" 
              disabled={isLoading}
              required
            />
            <button
              type="button"
              onClick={() => setShowOldPassword(!showOldPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={showOldPassword ? faEyeSlash : faEye} className="h-4 w-4" />
            </button>
          </div>
          {errors.oldPassword && <p className="text-xs text-red-400 font-semibold mt-1">{errors.oldPassword}</p>}
        </div>
        
        <div className="border-t border-border/40 my-6" />
        
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input 
              id="newPassword" 
              type={showNewPassword ? "text" : "password"} 
              value={formData.newPassword}
              onChange={handleChange}
              className={cn("bg-background/50 pr-10", errors.newPassword && "border-red-500/50 focus-visible:ring-red-500/50")} 
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} className="h-4 w-4" />
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-red-400 font-semibold mt-1">{errors.newPassword}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Input 
              id="confirmPassword" 
              type={showConfirmPassword ? "text" : "password"} 
              value={formData.confirmPassword}
              onChange={handleChange}
              className={cn("bg-background/50 pr-10", errors.confirmPassword && "border-red-500/50 focus-visible:ring-red-500/50")} 
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} className="h-4 w-4" />
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-red-400 font-semibold mt-1">{errors.confirmPassword}</p>}
        </div>
      </div>

      {errors.global && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400 font-semibold text-center">{errors.global}</p>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 flex items-center justify-center gap-2">
          <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
          <p className="text-xs text-green-500 font-semibold text-center">Password updated successfully!</p>
        </div>
      )}

      <div className="pt-4">
        <Button 
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          {isLoading && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />}
          Update Password
        </Button>
      </div>
      
      <p className="text-xs text-center text-muted-foreground pt-2">
        We recommend using a strong password that you don't use elsewhere.
      </p>
    </form>
  );
}
