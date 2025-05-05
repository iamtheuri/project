// @ts-nocheck

import { useEffect, useRef, useState } from 'react'
import { useToast } from "@/components/hooks/use-toast"
import { MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MapViewProps {
  tasks: CollectionTask[]
  searchTerm: string
  userLocation: { lat: number; lng: number } | null
  setUserLocation: (location: { lat: number; lng: number } | null) => void
  handleStatusChange: (taskId: number, newStatus: CollectionTask['status']) => Promise<void>
  user: { id: number; email: string; name: string } | null
  setSelectedTask: (task: CollectionTask | null) => void
  navigateToTask: (task: CollectionTask) => void
}

export const MapViewComponent = ({
  tasks,
  searchTerm,
  userLocation,
  setUserLocation,
  handleStatusChange,
  user,
  setSelectedTask,
  navigateToTask
}: MapViewProps) => {
  const { toast } = useToast()
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY


  // Load Google Maps API Script
  useEffect(() => {
    if (!window.google && !scriptLoaded && googleMapsApiKey) {
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
      if (existingScript) {
        setScriptLoaded(true)
        initMap()
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => {
        setScriptLoaded(true)
        initMap()
      }
      document.head.appendChild(script)
    } else if (window.google) {
      initMap()
    }

    return () => {
      // Clean up markers when component unmounts
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
    }
  }, [])

  // Re-initialize map when tasks or search term changes
  useEffect(() => {
    if (scriptLoaded && googleMapRef.current) {
      addMarkers(googleMapRef.current)
    }
  }, [tasks, searchTerm, scriptLoaded])

  // Initialize Google Map
  // Update the initMap function in your MapViewComponent.tsx
  const initMap = () => {
    if (!mapRef.current || !window.google) return;

    const mapOptions = {
      zoom: 12,
      center: userLocation, // Default center if no location
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
      new window.google.maps.Marker({
        position: userLocation,
        map: map,
        icon: {
          path: currentGeoPin,
          scale: 8,
          fillColor: "#4285F4", // Blue color for user location
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#FFFFFF"
        },
        title: "Your Location"
      });

      // Also add a circle around the user location for better visibility
      new window.google.maps.Circle({
        strokeColor: "#4285F4",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#4285F4",
        fillOpacity: 0.35,
        map: map,
        center: userLocation,
        radius: 50 // 50 meters radius
      });
    }

    addMarkers(map);
  };



  // Add markers for waste collection tasks
  const addMarkers = (map: google.maps.Map) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Filter tasks based on search term
    const visibleTasks = tasks.filter(task =>
      task.location.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !isNaN(Number(task.latitude)) &&
      !isNaN(Number(task.longitude))
    )

    // Add markers for each task
    visibleTasks.forEach(task => {
      const position = {
        lat: Number(task.latitude),
        lng: Number(task.longitude)
      }

      const marker = new window.google.maps.Marker({
        position: position,
        map: map,
        title: task.location,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: getMarkerColorByStatus(task.status),
          fillOpacity: 0.9,
          strokeWeight: 1,
          strokeColor: "#FFFFFF"
        }
      })

      // Create info window with task details
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="width: 200px; padding: 10px;">
            <h3 style="margin: 0 0 8px; font-weight: bold;">${task.location}</h3>
            <p style="margin: 0 0 5px;"><strong>Waste:</strong> ${task.wasteType}</p>
            <p style="margin: 0 0 5px;"><strong>Amount:</strong> ${task.amount}</p>
            <p style="margin: 0 0 5px;"><strong>Status:</strong> ${task.status.replace('_', ' ')}</p>
            <button id="nav-btn-${task.id}" style="background-color: #3B82F6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 5px; margin-right: 5px;">
              Navigate
            </button>
            ${task.status === 'pending' && checkArrivalAtDestination(task) ? `
              <button id="start-btn-${task.id}" style="background-color: #10B981; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 5px;">
                Start Collection
              </button>` : ''}
            ${(task.status === 'in_progress' && task.collectorId === user?.id) ? `
              <button id="complete-btn-${task.id}" style="background-color: #8B5CF6; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 5px;">
                Complete & Verify
              </button>` : ''}
          </div>
        `
      })

      // Add click event listener to marker
      marker.addListener('click', () => {
        infoWindow.open(map, marker)

        // Add click listeners to buttons after the info window is opened
        setTimeout(() => {
          const navButton = document.getElementById(`nav-btn-${task.id}`)
          if (navButton) {
            navButton.addEventListener('click', () => {
              navigateToTask(task)
              infoWindow.close()
            })
          }

          const startButton = document.getElementById(`start-btn-${task.id}`)
          if (startButton) {
            startButton.addEventListener('click', () => {
              handleStatusChange(task.id, 'in_progress')
              infoWindow.close()
            })
          }

          const completeButton = document.getElementById(`complete-btn-${task.id}`)
          if (completeButton) {
            completeButton.addEventListener('click', () => {
              setSelectedTask(task)
              infoWindow.close()
            })
          }
        }, 100)
      })

      markersRef.current.push(marker)
    })

    // Fit map bounds to include all markers
    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      markersRef.current.forEach(marker => bounds.extend(marker.getPosition()!))
      if (userLocation) bounds.extend(userLocation)
      map.fitBounds(bounds)
    }
  }

  const getMarkerColorByStatus = (status: CollectionTask['status']) => {
    switch (status) {
      case 'pending': return '#FCD34D' // yellow
      case 'in_progress': return '#60A5FA' // blue
      case 'completed': return '#10B981' // green
      case 'verified': return '#8B5CF6' // purple
      default: return '#9CA3AF' // gray
    }
  }

  const checkArrivalAtDestination = (task: CollectionTask) => {
    if (!userLocation) return false

    // Simple distance calculation (in kilometers)
    const lat1 = userLocation.lat
    const lon1 = userLocation.lng
    const lat2 = Number(task.latitude)
    const lon2 = Number(task.longitude)

    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c * 1000 // Distance in meters

    // Consider arrived if within 50 meters
    return distance < 50
  }

  return (
    <div className="">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div ref={mapRef} style={{ height: '500px', width: '100%' }} />
      </div>
      <Button
        variant="outline"
        className="my-4"
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
                // Center map on new location
                googleMapRef.current.setCenter(newLocation);
                // Add marker at new location
                new window.google.maps.Marker({
                  position: newLocation,
                  map: googleMapRef.current,
                  icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#4285F4",
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "#FFFFFF"
                  },
                  title: "Your Location"
                });
                // Add circle
                new window.google.maps.Circle({
                  strokeColor: "#4285F4",
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  fillColor: "#4285F4",
                  fillOpacity: 0.35,
                  map: googleMapRef.current,
                  center: newLocation,
                  radius: 50
                });
              }
            },
            (error) => {
              console.error("Error getting location:", error);
              toast({
                title: "Location Access Denied",
                description: "Unable to retrieve your location. Please check your browser settings.",
                variant: "destructive",
              });
            }
          );
        }}
      >
        <Navigation className="h-4 w-4 mr-1" />
        {userLocation ? "Update My Location" : "Show My Location"}
      </Button>
    </div>
  )
}