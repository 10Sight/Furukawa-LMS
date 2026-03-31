import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  XCircle,
  Phone,
  Mail,
  Info
} from 'lucide-react';

const DepartmentCancellationBanner = ({
  department,
  className = '',
  showContactInfo = true,
  variant = 'destructive'
}) => {
  if (!department || department.status !== 'CANCELLED') {
    return null;
  }

  // Extract cancellation reason from notes if exists
  const extractCancellationReason = (notes) => {
    if (!notes) return null;

    const lines = notes.split('\n');
    const cancelledLine = lines.find(line => line.startsWith('CANCELLED:'));

    if (cancelledLine) {
      // Extract reason between "CANCELLED: " and the timestamp
      const match = cancelledLine.match(/CANCELLED: (.+?) \(/);
      return match ? match[1].trim() : null;
    }

    return null;
  };

  const cancellationReason = extractCancellationReason(department.notes);
  const hasReason = cancellationReason && cancellationReason.length > 0;

  return (
    <div className={`w-full ${className}`}>
      {/* Main Cancellation Alert */}
      <Alert variant={variant} className="border-2 border-red-200 bg-red-50 mb-4">
        <XCircle className="h-6 w-6 text-red-600" />
        <AlertTitle className="text-red-800 text-lg font-bold flex items-center gap-2">
          Department Cancelled
          <AlertTriangle className="h-5 w-5" />
        </AlertTitle>
        <AlertDescription className="text-red-700 mt-2">
          <div className="space-y-2">
            <p className="font-medium">
              This department "{department.name}" has been cancelled and is no longer active.
            </p>

            {hasReason && (
              <div className="mt-3 p-3 bg-red-100 rounded-md border border-red-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">Cancellation Reason:</p>
                    <p className="text-red-700 text-sm mt-1">{cancellationReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Contact Information Card */}
      {showContactInfo && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Phone className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-orange-800 mb-2">
                  Need Help?
                </h4>
                <p className="text-orange-700 text-sm mb-3">
                  If you have questions about this cancellation or need assistance with alternative options,
                  please contact our support team.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-700 border-orange-300 hover:bg-orange-100"
                    onClick={() => window.location.href = 'mailto:support@example.com'}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email Support
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-700 border-orange-300 hover:bg-orange-100"
                    onClick={() => window.location.href = 'tel:+1-555-0123'}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Support
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DepartmentCancellationBanner;
