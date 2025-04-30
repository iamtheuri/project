// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, MapPin, CheckCircle, Clock, ArrowRight, Camera, Upload, Loader, Calendar, Weight, Search, Map, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/hooks/use-toast"
import { getWasteCollectionTasks, updateTaskStatus, saveReward, saveCollectedWaste, getUserByEmail } from '@/utils/db/actions'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStatus } from '@/hooks/useAuthStatus'

const modelApiKey = process.env.NEXT_PUBLIC_MODEL_API_KEY
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

type CollectionTask = {
  id: number
  location: string
  wasteType: string
  amount: string
  status: 'pending' | 'in_progress' | 'completed' | 'verified'
  date: string
  collectorId: number | null
  latitude: number
  longitude: number
}

const ITEMS_PER_PAGE = 5

export default function CollectPage() {
  usePageTitle("Collect Waste");
  const { toast } = useToast();
  const [tasks, setTasks] = useState<CollectionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredWasteType, setHoveredWasteType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null)
  const { isLoggedIn } = useAuthStatus(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef<any[]>([]);

  // Load Google Maps API Script
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (!window.google && googleMapsApiKey) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => initMap();
        document.head.appendChild(script);
      } else if (window.google) {
        initMap();
      }
    };

    if (viewMode === 'map') {
      loadGoogleMapsScript();
    }
  }, [viewMode]);

  // Initialize map when tasks are loaded and map mode is active
  useEffect(() => {
    if (viewMode === 'map' && !loading && tasks.length > 0 && window.google) {
      initMap();
    }
  }, [viewMode, loading, tasks]);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting user location:", error);
          toast({
            title: "Location Access Denied",
            description: "Unable to retrieve your location. Please check your browser settings.",
            variant: "destructive",
          });
        }
      );
    }
  }, []);

  // Initialize Google Map
  const initMap = () => {
    if (!mapRef.current || !window.google) return;

    const mapOptions = {
      zoom: 12,
      center: userLocation || {
        lat: 1.286389,
        long: 36.817223
      },
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    };

    // Create new map
    const map = new window.google.maps.Map(mapRef.current, mapOptions);
    googleMapRef.current = map;
    const currentGeoPin = <MapPin />;

    // Add user location marker if available
    if (userLocation) {
      try {
        new window.google.maps.Marker({
          position: userLocation,
          map: map,
          icon: {
            path: currentGeoPin,
            scale: 10,
            fillColor: "#4285F4",
            fillOpacity: 0.8,
            strokeWeight: 2,
            strokeColor: "#FFFFFF"
          },
          title: "Your Location"
        });
      } catch (e) {
        console.error("Error adding user location marker:", e);
      }
    }

    // Add markers for waste collection tasks
    addMarkers(map);
  };

  // Add markers for waste collection tasks
  const addMarkers = (map: any) => {
    // Clear existing markers
    if (markersRef.current) {
      markersRef.current.forEach(marker => marker.setMap(null));
    }
    markersRef.current = [];

    // Filter tasks based on search term
    const visibleTasks = tasks.filter(task =>
      task.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Add markers for each task
    visibleTasks.forEach(task => {
      if (task.latitude && task.longitude) {
        const markerColor = getMarkerColorByStatus(task.status);
        const hasArrived = checkArrivalAtDestination(task);

        if (hasArrived && task.status === 'pending') {
          toast({
            title: "Arrived at Destination",
            description: `You've reached ${task.location}`,
          });
        }

        const marker = new window.google.maps.Marker({
          position: {
            lat: parseFloat(task.latitude),
            lng: parseFloat(task.longitude),
          },
          map: map,
          title: task.location,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: markerColor,
            fillOpacity: 0.9,
            strokeWeight: 1,
            strokeColor: "#FFFFFF"
          }
        });

        // Create info window with task details
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
          <div style="width: 200px; padding: 10px;">
            <h3 style="margin: 0 0 8px; font-weight: bold;">${task.location}</h3>
            <p style="margin: 0 0 5px;"><strong>Waste:</strong> ${task.wasteType}</p>
            <p style="margin: 0 0 5px;"><strong>Amount:</strong> ${task.amount}</p>
            <p style="margin: 0 0 5px;"><strong>Date:</strong> ${task.date}</p>
            <p style="margin: 0 0 5px;"><strong>Status:</strong> ${task.status.replace('_', ' ')}</p>
            ${task.status === 'pending' ?
              `<button id="nav-btn-${task.id}" style="background-color: #3B82F6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 5px; margin-right: 5px;">Navigate</button>` :
              ''}
            ${(hasArrived && task.status === 'pending') ?
              `<button id="start-btn-${task.id}" style="background-color: #10B981; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 5px;">Start Collection</button>` :
              ''}
            ${(task.status === 'in_progress' && task.collectorId === user?.id) ?
              `<button id="complete-btn-${task.id}" style="background-color: #8B5CF6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 5px;">Complete & Verify</button>` :
              ''}
          </div>
        `
        });

        // Add click event listener to marker
        marker.addListener('click', () => {
          infoWindow.open(map, marker);

          // Add click listeners to buttons after the info window is opened
          setTimeout(() => {
            const navButton = document.getElementById(`nav-btn-${task.id}`);
            if (navButton) {
              navButton.addEventListener('click', () => {
                navigateToTask(task);
                infoWindow.close();
              });
            }

            const startButton = document.getElementById(`start-btn-${task.id}`);
            if (startButton) {
              startButton.addEventListener('click', () => {
                handleStatusChange(task.id, 'in_progress');
                infoWindow.close();
              });
            }

            const completeButton = document.getElementById(`complete-btn-${task.id}`);
            if (completeButton) {
              completeButton.addEventListener('click', () => {
                setSelectedTask(task);
                infoWindow.close();
              });
            }
          }, 100);
        });

        markersRef.current.push(marker);
      }
    });

    // Fit map bounds to include all markers
    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach(marker => bounds.extend(marker.getPosition()));
      if (userLocation) bounds.extend(userLocation);
      map.fitBounds(bounds);
    }
  };

  const navigateToTask = (task: CollectionTask) => {
    if (task.latitude && task.longitude) {
      let url;

      if (userLocation) {
        // If we have user location, create a route from user to destination
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${task.latitude},${task.longitude}&travelmode=driving`;
      } else {
        // If we don't have user location, just show destination
        url = `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}&travelmode=driving`;
      }

      window.open(url, '_blank');
    } else {
      toast({
        title: 'Error',
        description: 'Location coordinates not available for navigation.',
        variant: 'destructive',
      });
    }
  };

  // Get marker color based on task status
  const getMarkerColorByStatus = (status: CollectionTask['status']) => {
    switch (status) {
      case 'pending': return '#FCD34D'; // yellow
      case 'in_progress': return '#60A5FA'; // blue
      case 'completed': return '#10B981'; // green
      case 'verified': return '#8B5CF6'; // purple
      default: return '#9CA3AF'; // gray
    }
  };

  const checkArrivalAtDestination = (task: CollectionTask) => {
    if (!userLocation) return false;

    // Simple distance calculation (in kilometers)
    const lat1 = userLocation.lat;
    const lon1 = userLocation.lng;
    const lat2 = parseFloat(task.latitude);
    const lon2 = parseFloat(task.longitude);

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Distance in meters

    // Consider arrived if within 50 meters
    return distance < 50;
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (viewMode === 'map' && userLocation) {
      intervalId = setInterval(() => {
        tasks.forEach(task => {
          if (task.status === 'pending' && checkArrivalAtDestination(task)) {
            toast({
              title: "Arrived at Destination",
              description: `You've reached ${task.location}`,
            });
          }
        });
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [viewMode, userLocation, tasks]);

  useEffect(() => {
    const fetchUserAndTasks = async () => {
      setLoading(true)
      try {
        const userEmail = localStorage.getItem('userEmail')
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail)
          if (fetchedUser) {
            setUser(fetchedUser)
          } else {
            toast({
              title: 'Error',
              description: 'User not found. Please log in again.',
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Error',
            description: 'Please log in to view available tasks.',
            variant: 'destructive',
          });
        }

        const fetchedTasks = await getWasteCollectionTasks();
        console.log("fetchedTasks", fetchedTasks);
        setTasks(fetchedTasks as CollectionTask[]);
      } catch (error) {
        console.error('Error fetching user and tasks:', error)
        toast({
          title: 'Error',
          description: 'Failed to load user data and tasks. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false)
      }
    }

    fetchUserAndTasks()
  }, [])

  // Update map when search term changes
  useEffect(() => {
    if (viewMode === 'map' && googleMapRef.current) {
      addMarkers(googleMapRef.current);
      console.log('fetchedTasks', fetchedTasks)
    }
  }, [searchTerm]);

  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null)
  const [verificationImage, setVerificationImage] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failure'>('idle')
  const [verificationResult, setVerificationResult] = useState<{
    wasteTypeMatch: boolean;
    quantityMatch: boolean;
    confidence: number;
  } | null>(null)
  const [reward, setReward] = useState<number | null>(null)

  const handleStatusChange = async (taskId: number, newStatus: CollectionTask['status']) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to collect waste.',
        variant: 'destructive',
      });
      return
    }

    try {
      const updatedTask = await updateTaskStatus(taskId, newStatus, user.id)
      if (updatedTask) {
        setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, status: newStatus, collectorId: user.id } : task
        ))
        toast({
          title: 'Success',
          description: 'Task status updated successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update task status. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating task status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update task status. Please try again.',
        variant: 'destructive',
      });
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setVerificationImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const readFileAsBase64 = (dataUrl: string): string => {
    return dataUrl.split(',')[1]
  }

  const handleVerify = async () => {
    if (!selectedTask || !verificationImage || !user) {
      toast({
        title: 'Error',
        description: 'Missing required information for verification.',
        variant: 'destructive',
      });
      return
    }

    setVerificationStatus('verifying')

    try {
      const genAI = new GoogleGenerativeAI(modelApiKey!)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

      const base64Data = readFileAsBase64(verificationImage)

      const imageParts = [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg',
          },
        },
      ]

      const prompt = `You are an expert in waste management and recycling. Analyze this image and provide:
  1. Confirm if the waste type matches: ${selectedTask.wasteType}
  2. Estimate the quantity visible in the image and determine if it matches the reported amount: ${selectedTask.amount}
  3. Your confidence level in this assessment (as a percentage)
  
  For quantity comparison:
  - If the amount is in weight (kg/lbs), estimate the total weight in the image
  - If the amount is in items (pieces/bags), count the visible items
  - Consider the scale and perspective of the image
  
  Respond in JSON format like this:
  {
    "wasteTypeMatch": true/false,
    "quantityMatch": true/false,
    "confidence": confidence level as a number between 0 and 1,
    "estimatedQuantity": "your estimate of the visible quantity",
    "requestedQuantity": "${selectedTask.amount}"
  }`

      const result = await model.generateContent([prompt, ...imageParts])
      const response = await result.response
      let text = response.text()
      text = text
        .replace(/^[\s\S]*?\{/, '{') // Remove stuff before the first {
        .replace(/\}[\s\S]*$/, '}')  // Remove stuff after the last }
        .trim();
      console.log("Cleaned response:", text);

      try {
        const parsedResult = JSON.parse(text)
        console.log("Verification result:", parsedResult)
        setVerificationResult({
          wasteTypeMatch: parsedResult.wasteTypeMatch,
          quantityMatch: parsedResult.quantityMatch,
          confidence: parsedResult.confidence
        })

        setVerificationStatus('success')
        const isQuantityMatch = parsedResult.quantityMatch ||
          (parsedResult.confidence > 0.6 && parsedResult.wasteTypeMatch);

        if (parsedResult.wasteTypeMatch && isQuantityMatch && parsedResult.confidence > 0.6) {
          await handleStatusChange(selectedTask.id, 'verified')
          const earnedReward = Math.floor(Math.random() * 50) + 10
          await saveReward(user.id, earnedReward)
          await saveCollectedWaste(selectedTask.id, user.id, parsedResult)

          setReward(earnedReward)
          toast({
            title: 'Success',
            description: `Verification successful! You earned ${earnedReward} tokens!`,
            variant: 'destructive',
            duration: 5000,
            position: 'top-center',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Verification failed. The collected waste does not match the reported waste.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.log(error);

        console.error('Failed to parse JSON response:', text)
        setVerificationStatus('failure')
      }
    } catch (error) {
      console.error('Error verifying waste:', error)
      setVerificationStatus('failure')
    }
  }

  const filteredTasks = tasks.filter(task =>
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pageCount = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE)
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Waste Collection Tasks</h1>
      {isLoggedIn ? (
        <>
          <div className="mb-4 flex items-center">
            <Input
              type="text"
              placeholder="Search by area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mr-3"
            />
            <Button variant="outline" size="icon" className='mr-3 bg-black'>
              <Search className="h-4 w-8 text-white" />
            </Button>

            <div className="ml-auto flex">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                className="mr-3"
                onClick={() => setViewMode('list')}
              >
                List View
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'outline'}
                onClick={() => setViewMode('map')}
              >
                <Map className="h-4 w-4 mr-1" />
                Map View
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="animate-spin h-8 w-8 text-gray-500" />
            </div>
          ) : viewMode === 'map' ? (
            <div className="">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div ref={mapRef} style={{ height: '500px', width: '100%' }} />
              </div>
              <Button
                variant="outline"
                className="my-4"
                disabled={!!userLocation}
                onClick={() => {
                  toast({
                    title: "Requesting Location Access",
                    description: "Please allow access to your location in the browser.",
                  });

                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const newLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                      };
                      setUserLocation(newLocation);

                      toast({
                        title: "Location Access Granted",
                        description: "Your current location has been set successfully.",
                      });

                      if (googleMapRef.current) {
                        googleMapRef.current.setCenter(newLocation);
                      }
                    },
                    (error) => {
                      console.error("Error getting location:", error);
                      toast({
                        title: "Location Access Denied",
                        description:
                          "Unable to retrieve your location. Please check your browser settings.",
                        variant: "destructive",
                      });
                    }
                  );
                }}
              >
                <Navigation className="h-4 w-4 mr-1" />
                Get My Location
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedTasks.map(task => (
                  <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-lg font-medium text-gray-800 flex items-center">
                        <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                        {task.location}
                      </h2>
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                      <div className="flex items-center relative">
                        <Trash2 className="w-4 h-4 mr-2 text-gray-500" />
                        <span
                          onMouseEnter={() => setHoveredWasteType(task.wasteType)}
                          onMouseLeave={() => setHoveredWasteType(null)}
                          className="cursor-pointer"
                        >
                          {task.wasteType.length > 8 ? `${task.wasteType.slice(0, 8)}...` : task.wasteType}
                        </span>
                        {hoveredWasteType === task.wasteType && (
                          <div className="absolute left-0 top-full mt-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                            {task.wasteType}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Weight className="w-4 h-4 mr-2 text-gray-500" />
                        {task.amount}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                        {task.date}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {task.status === 'pending' && (
                        <>
                          {/* <Button
                            onClick={() => navigateToTask(task)}
                            variant="outline"
                            size="sm"
                            className="mr-2"
                          >
                            <Navigation className="w-4 h-4 mr-1" />
                            Navigate
                          </Button> */}
                          <Button onClick={() => handleStatusChange(task.id, 'in_progress')} variant="outline" size="sm">
                            Start Collection
                          </Button>
                        </>
                      )}
                      {task.status === 'in_progress' && task.collectorId === user?.id && (
                        <Button onClick={() => setSelectedTask(task)} variant="outline" size="sm">
                          Complete & Verify
                        </Button>
                      )}
                      {task.status === 'in_progress' && task.collectorId !== user?.id && (
                        <span className="text-yellow-600 text-sm font-medium">In progress by another collector</span>
                      )}
                      {task.status === 'verified' && (
                        <span className="text-green-600 text-sm font-medium">Reward Earned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-center">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="mr-2"
                >
                  Previous
                </Button>
                <span className="mx-2 self-center">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))}
                  disabled={currentPage === pageCount}
                  className="ml-2"
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium text-gray-800 flex items-center">
                Login to view more
              </h2>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
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
                      <input id="verification-image" name="verification-image" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
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
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: CollectionTask['status'] }) {
  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    in_progress: { color: 'bg-blue-100 text-blue-800', icon: Trash2 },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    verified: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  }

  const { color, icon: Icon } = statusConfig[status]

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color} flex items-center`}>
      <Icon className="mr-1 h-3 w-3" />
      {status.replace('_', ' ')}
    </span>
  )
}