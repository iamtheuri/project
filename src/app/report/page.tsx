//@ts-nocheck
"use client";
import { useState, useCallback, useEffect } from "react";
import { MapPin, Upload, CheckCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { StandaloneSearchBox, useJsApiLoader } from "@react-google-maps/api";
import { Libraries } from "@react-google-maps/api";
import {
  createUser,
  getUserByEmail,
  createReport,
  getRecentReports,
} from "@/utils/db/actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStatus } from "@/lib/web3auth";


const modelApiKey = process.env.NEXT_PUBLIC_MODEL_API_KEY;
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const libraries: Libraries = ["places"];

export default function ReportPage() {
  usePageTitle("Report Waste");
  const { toast } = useToast();
  const [user, setUser] = useState<{
    id: number;
    role: string;
    email: string;
    name: string;
  } | null>(null);
  const router = useRouter();

  const [reports, setReports] = useState<
    Array<{
      id: number;
      location: string;
      wasteType: string;
      amount: string;
      description: string;
      recommendation: string;
      createdAt: string;
    }>
  >([]);

  const [newReport, setNewReport] = useState<{
    location: string;
    type: string;
    amount: string;
    description: string;
    recommendation: string;
    latitude: number | null;
    longitude: number | null;
  }>({
    location: "",
    type: "",
    amount: "",
    description: "",
    recommendation: "",
    latitude: null,
    longitude: null,
  });


  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure" | "partial">("idle");
  const [verificationResult, setVerificationResult] = useState<{
    wasteType: string;
    quantity: string;
    description: string;
    recommendation: string;
    confidence: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchBox, setSearchBox] =
    useState<google.maps.places.SearchBox | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleMapsApiKey!,
    libraries: libraries,
  });

  const onLoad = useCallback((ref: google.maps.places.SearchBox) => {
    setSearchBox(ref);
  }, []);

  const onPlacesChanged = () => {
    if (searchBox) {
      const places = searchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];

        setNewReport(prev => ({
          ...prev,
          location: place.formatted_address || "",
          latitude: place.geometry?.location?.lat() ?? null,
          longitude: place.geometry?.location?.lng() ?? null,
        }));
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewReport({ ...newReport, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleVerify = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Upload must be an image.",
        variant: "destructive",
      });
      return;
    };

    setVerificationStatus("verifying");

    try {
      const genAI = new GoogleGenerativeAI(modelApiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Add file validation before processing
      if (!file || !file.type.startsWith('image/')) {
        setVerificationStatus("failure");
        throw new Error("Invalid file: Please upload an image");
      }

      // Show loading state to user
      setVerificationStatus("verifying");

      const base64Data = await readFileAsBase64(file);

      const imageParts = [
        {
          inlineData: {
            data: base64Data.split(",")[1],
            mimeType: file.type,
          },
        },
      ];

      // Enhanced prompt with more specific instructions and edge cases
      const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
      1. The type of waste (e.g., plastic, paper, glass, metal, organic, electronic, hazardous, mixed)
      2. An estimate of the quantity or amount (in kg or liters)
      3. Your confidence level in this assessment (as a percentage)
      4. A brief description of what you see in the image
      5. Recommendations for proper disposal or recycling methods
      
      Please follow these guidelines:
      - If the waste is packed in a bag, identify the type of bag (e.g., decomposable, non-decomposable) and specify if it contains waste.
      - If the image is unclear or the waste is not visible, set confidence to 0.
      - If you cannot determine the type of waste or if the image doesn't contain waste, set wasteType to "unidentified".
      - If the waste is a common item (e.g., plastic bottle, cardboard box), provide a specific type (e.g., PET, cardboard).
      - If the waste is a mixed item (e.g., a pizza box with food residue), provide a general type (e.g., mixed waste).
      - If the waste is hazardous (e.g., batteries, chemicals), provide a specific type and disposal method as recommendation.
      - If the waste is organic (e.g., food scraps, yard waste), provide a specific type and disposal method as recommendation.
      - If the waste is electronic (e.g., old phone, computer), provide a specific type and disposal method as recommendation.
      - If the waste is recyclable (e.g., glass, metal), provide a specific type and recycling method as recommendation.
      - If the waste is not recyclable (e.g., plastic wrap, polystyrene), provide a specific type and disposal method.
      
      Respond in JSON format ONLY, with NO additional text or markdown. The response must be valid JSON.
      {
        "wasteType": "Type of waste",
        "quantity": "Estimated quantity with unit",
        "confidence": Confidence level as a number between 0 and 1,
        "description": "Brief description of what you see in the image (should not exceed 100 words)"
        "recommendation": "Recommendations for proper disposal or recycling methods (should not exceed 100 words)"
      }`;

      // Set timeout for API call
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("API request timed out")), 15000)
      );

      const apiPromise = model.generateContent([prompt, ...imageParts]);
      const result = await Promise.race([apiPromise, timeoutPromise]);

      const response = result.response;
      let text = response.text();
      const rawrepsonse = response.text();
      console.log("Raw response:", rawrepsonse);
      text = text
        .replace(/^[\s\S]*?\{/, '{') // Remove stuff before the first {
        .replace(/\}[\s\S]*$/, '}')  // Remove stuff after the last }
        .trim();
      console.log("Cleaned response:", text);

      try {
        const parsedResult = JSON.parse(text);

        // Validate all required fields exist and have appropriate values
        if (
          parsedResult.wasteType &&
          parsedResult.quantity &&
          parsedResult.description &&
          parsedResult.recommendation &&
          typeof parsedResult.confidence === 'number' &&
          parsedResult.confidence >= 0 &&
          parsedResult.confidence <= 1
        ) {
          setVerificationResult({
            ...parsedResult,
            // Standardize confidence as percentage for display
            confidencePercent: Math.round(parsedResult.confidence * 100)
          });

          // Only update report if confidence exceeds threshold
          if (parsedResult.confidence >= 0.6 && parsedResult.wasteType !== "unidentified") {
            setVerificationStatus("success");
            setNewReport({
              ...newReport,
              type: parsedResult.wasteType,
              amount: parsedResult.quantity,
              description: parsedResult.description || "",
              recommendation: parsedResult.recommendation || ""
            });
          } else {
            // Still success but with warning
            setVerificationStatus("partial");
            setVerificationMessage(
              parsedResult.wasteType === "unidentified"
                ? "Unable to identify waste type. Please manually specify."
                : "Low confidence detection. Please verify results."
            );
          }
        } else {
          console.error("Invalid verification result structure:", parsedResult);
          setVerificationStatus("failure");
          setVerificationMessage("Analysis produced invalid results. Please try again with a clearer image.");
        }
      } catch (error) {
        console.error("Failed to parse JSON response:", error, "Text:", text);
        setVerificationStatus("failure");
        setVerificationMessage("Failed to process response. Please try again.");
      }
    } catch (error) {
      console.error("Error verifying waste:", error);
      setVerificationStatus("failure");
      setVerificationMessage("Error analyzing image. Please try again.");
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationStatus !== "success" || !user) {
      toast({
        title: "Error",
        description: "Please verify the waste before submitting",
        variant: "destructive",
      });
      return;
    }

    if (newReport.latitude == null || newReport.longitude == null) {
      toast({
        title: "Missing coordinates",
        description: "Please pick a location from the dropdown so we can get lat/long.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const report = (await createReport(
        user.id,
        newReport.location,
        newReport.type,
        newReport.amount,
        newReport.description,
        newReport.recommendation,
        newReport.latitude,
        newReport.longitude,
        preview || undefined,
        verificationResult ? JSON.stringify(verificationResult) : undefined
      )) as any;

      const formattedReport = {
        id: report.id,
        location: report.location,
        wasteType: report.wasteType,
        amount: report.amount,
        description: report.description,
        recommendation: report.recommendation,
        createdAt: report.createdAt.toISOString().split("T")[0],
      };

      setReports([formattedReport, ...reports]);
      setNewReport({
        location: "",
        type: "",
        amount: "",
        description: "",
        recommendation: "",
        latitude: null,
        longitude: null,
      });
      setFile(null);
      setPreview(null);
      setVerificationStatus("idle");
      setVerificationResult(null);
      toast({
        title: "Success",
        description: "Report submitted successfully! You've earned points for reporting waste.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isReporter, setIsReporter] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem("userEmail");
      if (email) {
        let user = await getUserByEmail(email);
        if (!user) {
          user = await createUser(email, "Anonymous User");
        }
        setUser(user);
        setIsReporter(user.role === "Reporter");

        const recentReports = await getRecentReports();
        const formattedReports = recentReports.map((report) => ({
          ...report,
          createdAt: report.createdAt.toISOString().split("T")[0],
        }));
        setReports(formattedReports);
      } else {
        toast({
          title: "Error",
          description: "Please log in to report waste.",
          variant: "destructive",
        });
        return;
      }
    };
    checkUser();
  }, [router]);

  const { isLoggedIn } = useAuthStatus(true);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {isLoggedIn && isReporter ? (
        <>
          <h1 className="text-3xl font-semibold mb-6 text-gray-800">
            Report waste
          </h1>
          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-2xl shadow-lg mb-12"
          >
            <div className="mb-8">
              <label
                htmlFor="waste-image"
                className="block text-lg font-medium text-gray-700 mb-2"
              >
                Upload Waste Image
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="waste-image"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="waste-image"
                        name="waste-image"
                        type="file"
                        className="sr-only"
                        onChange={handleFileChange}
                        accept="image/*"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
              </div>
            </div>

            {preview && (
              <div className="mt-4 mb-8">
                <img
                  src={preview}
                  alt="Waste preview"
                  className="max-w-full h-auto rounded-xl shadow-md"
                />
              </div>
            )}

            <Button
              type="button"
              onClick={handleVerify}
              className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300"
              disabled={!file || verificationStatus === "verifying"}
            >
              {verificationStatus === "verifying" ? (
                <>
                  <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Verifying...
                </>
              ) : (
                "Verify Waste"
              )}
            </Button>

            {verificationStatus === "success" && verificationResult && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
                <div className="flex items-center">
                  <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-green-800">
                      Verification Successful
                    </h3>
                    <div className="mt-2 text-base font-medium text-green-700">
                      <p><span className="text-base font-black">WASTE TYPE:</span> {verificationResult.wasteType}</p>
                      <p> <span className="text-lg font-black">Quantity:</span> {verificationResult.quantity}</p>
                      <p><span className="text-lg font-black">Confidence:</span>  {(verificationResult.confidence * 100).toFixed(2)}%</p>
                      <p className="text-lg font-black">Description:</p><p>  {verificationResult.description}</p>
                      <p className="text-lg font-black">Recommendation:</p><p>  {verificationResult.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Location
                </label>
                {isLoaded ? (
                  <StandaloneSearchBox
                    onLoad={onLoad}
                    onPlacesChanged={onPlacesChanged}
                  >
                    <input
                      type="text"
                      id="location"
                      name="location"
                      value={newReport.location}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                      placeholder="Enter waste location"
                    />
                  </StandaloneSearchBox>
                ) : (
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={newReport.location}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                    placeholder="Enter waste location"
                  />
                )}
              </div>
              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Waste Type
                </label>
                <input
                  type="text"
                  id="type"
                  name="type"
                  value={newReport.type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                  placeholder="Verified waste type"
                  readOnly
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Waste Description
                </label>
                <textarea
                  type="text"
                  id="description"
                  name="description"
                  rows={6}
                  value={newReport.description}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                  placeholder="Description"
                  readOnly
                />
              </div>
              <div>
                <label
                  htmlFor="recommendation"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Disposal Recommendation
                </label>
                <textarea
                  type="text"
                  id="recommendation"
                  name="recommendation"
                  rows={6}
                  value={newReport.recommendation}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                  placeholder="Recommendation"
                  readOnly
                />
              </div>
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Estimated Amount
                </label>
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  value={newReport.amount}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
                  placeholder="Verified amount"
                  readOnly
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </form>
        </>
      ) : (null)}
      <h2 className="text-3xl font-semibold mb-6 text-gray-800">
        Recent Reports
      </h2>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.wasteType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}