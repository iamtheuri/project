// @ts-nocheck
import { useState } from 'react';
import { Loader, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VerificationModalProps {
  selectedTask: CollectionTask | null;
  setSelectedTask: (task: CollectionTask | null) => void;
  handleVerify: () => Promise<void>;
  verificationImage: string | null;
  setVerificationImage: (image: string | null) => void;
  verificationStatus: 'idle' | 'verifying' | 'success' | 'failure';
  verificationResult: {
    wasteTypeMatch: boolean;
    quantityMatch: boolean;
    confidence: number;
  } | null;
  reward: number | null;
}

export const VerificationModal = ({
  selectedTask,
  setSelectedTask,
  handleVerify,
  verificationImage,
  setVerificationImage,
  verificationStatus,
  verificationResult,
  reward
}: VerificationModalProps) => {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVerificationImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!selectedTask) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">Verify Collection</h3>
        <p className="mb-4 text-sm text-gray-600">Upload a photo of the collected waste to verify and earn your reward.</p>

        <div className="mb-4">
          <label htmlFor="verification-image" className="block text-sm font-medium text-gray-700 mb-2">
            Upload Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="verification-image"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="verification-image"
                    name="verification-image"
                    type="file"
                    className="sr-only"
                    onChange={handleImageUpload}
                    accept="image/*"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        </div>

        {verificationImage && (
          <img src={verificationImage} alt="Verification" className="mb-4 rounded-md w-full" />
        )}

        <Button
          onClick={handleVerify}
          className="w-full"
          disabled={!verificationImage || verificationStatus === 'verifying'}
        >
          {verificationStatus === 'verifying' ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
              Verifying...
            </>
          ) : 'Verify Collection'}
        </Button>

        {verificationStatus === 'success' && verificationResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p>Waste Type Match: {verificationResult.wasteTypeMatch ? 'Yes' : 'No'}</p>
            <p>Quantity Match: {verificationResult.quantityMatch ? 'Yes' : 'No'}</p>
            <p>Confidence: {(verificationResult.confidence * 100).toFixed(2)}%</p>
            {reward && <p className="font-bold">Reward Earned: {reward} tokens!</p>}
          </div>
        )}

        {verificationStatus === 'failure' && (
          <p className="mt-2 text-red-600 text-center text-sm">Verification failed. Please try again.</p>
        )}

        <Button onClick={() => setSelectedTask(null)} variant="outline" className="w-full mt-2">
          Close
        </Button>
      </div>
    </div>
  );
};