import React, { useState, useEffect } from 'react';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faSpinner, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { updateProfileApi } from '@/features/auth/authService';
import { updateUser } from '@/features/auth/authSlice';
import { cn } from '@/shared/lib/utils';

export function ProfileSettings() {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = React.useState(user?.avatar || "");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    country: user?.country || '',
  });

  useEffect(() => {
    if (user?.avatar) {
      setAvatarPreview(user.avatar);
    }
  }, [user?.avatar]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const fieldId = id.replace('profile-', '');
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setSuccess(false);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value);
      });
      
      if (selectedFile) {
        data.append('avatar', selectedFile);
        console.log('Appending avatar file to FormData:', selectedFile.name);
      }

      console.log('Sending Profile Update FormData...');
      data.forEach((value, key) => {
        console.log(key + ': ' + (value instanceof File ? `File (${value.name})` : value));
      });

      const updatedUser = await updateProfileApi(data);
      dispatch(updateUser(updatedUser));
      setAvatarPreview(updatedUser.avatar);
      setSelectedFile(null);
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to update profile";
      const message = Array.isArray(errorMessage) ? errorMessage[0] : errorMessage;

      if (message.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: message }));
      } else if (message.toLowerCase().includes('username')) {
        setErrors(prev => ({ ...prev, username: message }));
      } else if (message.toLowerCase().includes('phone')) {
        setErrors(prev => ({ ...prev, phone: message }));
      } else {
        setErrors(prev => ({ ...prev, global: message }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string = "User") => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-2 border-primary/20">
            <AvatarImage src={avatarPreview} />
            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          <button 
            type="button"
            onClick={handleAvatarClick}
            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <FontAwesomeIcon icon={faCamera} className="text-white text-xl" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-lg">{user?.name || 'User'}</h3>
          <p className="text-xs text-muted-foreground">Click the avatar to change your profile picture</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Full Name</Label>
          <Input 
            id="profile-name" 
            value={formData.name} 
            onChange={handleChange}
            placeholder="John Doe" 
            className="bg-background/50" 
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-username">Username</Label>
          <Input 
            id="profile-username" 
            value={formData.username} 
            onChange={handleChange}
            placeholder="johndoe" 
            className={cn("bg-background/50", errors.username && "border-red-500/50 focus-visible:ring-red-500/50")} 
            disabled={isLoading}
          />
          {errors.username && <p className="text-xs text-red-400 font-semibold mt-1">{errors.username}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email Address</Label>
          <Input 
            id="profile-email" 
            type="email" 
            value={formData.email} 
            onChange={handleChange}
            placeholder="john@example.com" 
            className={cn("bg-background/50", errors.email && "border-red-500/50 focus-visible:ring-red-500/50")} 
            disabled={isLoading}
          />
          {errors.email && <p className="text-xs text-red-400 font-semibold mt-1">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-phone">Phone Number</Label>
          <Input 
            id="profile-phone" 
            type="tel" 
            value={formData.phone} 
            onChange={handleChange}
            placeholder="+1234567890" 
            className={cn("bg-background/50", errors.phone && "border-red-500/50 focus-visible:ring-red-500/50")} 
            disabled={isLoading}
          />
          {errors.phone && <p className="text-xs text-red-400 font-semibold mt-1">{errors.phone}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-country">Country</Label>
          <Input 
            id="profile-country" 
            value={formData.country} 
            onChange={handleChange}
            placeholder="Bangladesh" 
            className="bg-background/50" 
            disabled={isLoading}
          />
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
          <p className="text-xs text-green-500 font-semibold text-center">Profile updated successfully!</p>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button 
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
        >
          {isLoading && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
