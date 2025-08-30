import React from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

const LoadingDialog = ({ 
  open, 
  title = 'Processing...', 
  description = 'Please wait while we process your request.',
  progress = null // { current: number, total: number, label: string }
}) => {
  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      <DialogContent 
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-4">
              {description}
            </div>
            
            {progress && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {progress.label || `${progress.current} of ${progress.total}`}
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round((progress.current / progress.total) * 100)}%
                </div>
              </div>
            )}
            
            {!progress && (
              <div className="flex justify-center">
                <div className="animate-pulse flex space-x-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoadingDialog;