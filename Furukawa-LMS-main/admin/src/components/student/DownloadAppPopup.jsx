import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Download,
  Monitor,
  X,
  CheckCircle2,
  Wifi,
  Zap,
  Bell,
  Star
} from 'lucide-react';

const DownloadAppPopup = ({ isOpen, onClose, userRole }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState('desktop');

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    // Detect platform
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
        setPlatform('mobile');
      } else {
        setPlatform('desktop');
      }
    };

    checkInstalled();
    detectPlatform();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      const result = await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        onClose();
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleRemindLater = () => {
    // Set a reminder in localStorage to show popup again after 7 days
    const remindTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    localStorage.setItem('downloadAppRemindTime', remindTime.toString());
    onClose();
  };

  const handleDontShowAgain = () => {
    // Set flag to never show the popup again
    localStorage.setItem('downloadAppDontShow', 'true');
    onClose();
  };

  const features = [
    {
      icon: <Zap className="h-5 w-5 text-blue-600" />,
      title: "Faster Performance",
      description: "Lightning-fast loading and smooth interactions"
    },
    {
      icon: <Wifi className="h-5 w-5 text-green-600" />,
      title: "Offline Access",
      description: "Access your courses even without internet"
    },
    {
      icon: <Bell className="h-5 w-5 text-purple-600" />,
      title: "Push Notifications",
      description: "Get notified about assignments and updates"
    },
    {
      icon: <Star className="h-5 w-5 text-yellow-600" />,
      title: "Native Experience",
      description: "App-like experience on your device"
    }
  ];

  // Only show for students
  if (userRole !== 'STUDENT') return null;

  // Don't show if already installed
  if (isInstalled) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 pb-4">
          <DialogHeader className="text-center relative">
            <div className="mx-auto mb-4 p-3 bg-white rounded-full shadow-lg">
              {platform === 'mobile' ? (
                <Smartphone className="h-8 w-8 text-blue-600" />
              ) : (
                <Monitor className="h-8 w-8 text-blue-600" />
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 mb-2">
              Download Our App
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base">
              Get the best learning experience with our mobile app
            </DialogDescription>
            <Badge className="absolute top-0 right-0 bg-green-100 text-green-800 border-green-200">
              Free
            </Badge>
          </DialogHeader>
        </div>

        {/* Features section */}
        <div className="px-6 py-4">
          <h3 className="font-semibold text-gray-900 mb-4 text-center">
            Why download the app?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="p-2 bg-white rounded-full shadow-sm">
                  {feature.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 mb-1">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Install instructions for different platforms */}
        <div className="px-6 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                {platform === 'mobile' ? (
                  <>
                    <p className="font-medium mb-1">Mobile Installation:</p>
                    <p>
                      Tap "Install" below or look for "Add to Home Screen" in your browser menu
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium mb-1">Desktop Installation:</p>
                    <p>
                      Click "Install" below or look for the install icon in your browser's address bar
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with buttons */}
        <DialogFooter className="px-6 pb-6 pt-2 flex-col sm:flex-row gap-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleRemindLater}
              className="flex-1 text-gray-600 hover:text-gray-700"
            >
              Remind Later
            </Button>
            <Button
              variant="ghost"
              onClick={handleDontShowAgain}
              className="flex-1 text-gray-400 hover:text-gray-500 text-sm"
            >
              Don't Show Again
            </Button>
          </div>
          
          {isInstallable ? (
            <Button
              onClick={handleInstallClick}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
          ) : (
            <Button
              onClick={() => window.open(window.location.href, '_blank')}
              variant="outline"
              className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50 px-8"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Open in Browser
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadAppPopup;
