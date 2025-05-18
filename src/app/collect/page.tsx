// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, MapPin, CheckCircle, Clock, ArrowRight, Camera, Upload, Loader, Calendar, Weight, Search, Map, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from "@/components/hooks/use-toast"
import { getWasteCollectionTasks, updateTaskStatus, saveReward, saveCollectedWaste, getUserByEmail } from '@/utils/db/actions'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { MapViewComponent } from './MapViewComponent'
import { TaskListComponent } from './TaskListComponent.tsx'
import { VerificationModal } from './VerificationModal'

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

export default function CollectPage() {
  usePageTitle("Collect Waste")
  const { toast } = useToast()
  const [tasks, setTasks] = useState<CollectionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [user, setUser] = useState<{ id: number; email: string; name: string } | null>(null)
  const { isLoggedIn } = useAuthStatus(true)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)

  // Verification modal state
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null)
  const [verificationImage, setVerificationImage] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failure'>('idle')
  const [verificationResult, setVerificationResult] = useState<{
    wasteTypeMatch: boolean
    quantityMatch: boolean
    confidence: number
  } | null>(null)
  const [reward, setReward] = useState<number | null>(null)

  // Fetch user and tasks on mount
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
            })
          }
        }

        const fetchedTasks = await getWasteCollectionTasks()
        setTasks(fetchedTasks as CollectionTask[])
      } catch (error) {
        console.error('Error fetching user and tasks:', error)
        toast({
          title: 'Error',
          description: 'Failed to load user data and tasks. Please try again.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUserAndTasks()
  }, [])

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting user location:", error);
          toast({
            title: "Location Access Denied",
            description:
              "Unable to retrieve your location. Please check your browser settings.",
            variant: "destructive",
          });
        }
      );
    }
  }, []);

  const navigateToTask = (task: CollectionTask) => {
    if (!task.latitude || !task.longitude) {
      toast({
        title: 'Error',
        description: 'Location coordinates not available for navigation.',
        variant: 'destructive',
      })
      return
    }

    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : ''
    const destination = `${task.latitude},${task.longitude}`
    const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${destination}&travelmode=driving`

    window.open(url, '_blank')
  }

  const handleStatusChange = async (taskId: number, newStatus: CollectionTask['status']) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to collect waste.',
        variant: 'destructive',
      })
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
        })
      }
    } catch (error) {
      console.error('Error updating task status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update task status. Please try again.',
        variant: 'destructive',
      })
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
      })
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
      text = text.replace(/^[\s\S]*?\{/, '{').replace(/\}[\s\S]*$/, '}').trim()

      try {
        const parsedResult = JSON.parse(text)
        setVerificationResult({
          wasteTypeMatch: parsedResult.wasteTypeMatch,
          quantityMatch: parsedResult.quantityMatch,
          confidence: parsedResult.confidence
        })

        setVerificationStatus('success')
        const isQuantityMatch = parsedResult.quantityMatch ||
          (parsedResult.confidence > 0.6 && parsedResult.wasteTypeMatch)

        if (parsedResult.wasteTypeMatch && isQuantityMatch && parsedResult.confidence > 0.6) {
          await handleStatusChange(selectedTask.id, 'verified')
          const earnedReward = Math.floor(Math.random() * 50) + 10
          await saveReward(user.id, earnedReward)
          await saveCollectedWaste(selectedTask.id, user.id, parsedResult)

          setReward(earnedReward)
          toast({
            title: 'Success',
            description: `Verification successful! You earned ${earnedReward} tokens!`,
          })
        } else {
          toast({
            title: 'Error',
            description: 'Verification failed. The collected waste does not match the reported waste.',
            variant: 'destructive',
          })
        }
      } catch (error) {
        console.error('Failed to parse JSON response:', text)
        setVerificationStatus('failure')
      }
    } catch (error) {
      console.error('Error verifying waste:', error)
      setVerificationStatus('failure')
    }
  }

  const ITEMS_PER_PAGE = 5
  const filteredTasks = tasks.filter(task =>
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const pageCount = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE)

  if (loading) {
    return (
      <div className="flex items-center justify-center my-60">
        <Loader className="animate-spin h-10 w-10 text-green-300" />
      </div>
    );
  }

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
            <MapViewComponent
              tasks={tasks}
              searchTerm={searchTerm}
              userLocation={userLocation}
              setUserLocation={setUserLocation}
              handleStatusChange={handleStatusChange}
              user={user}
              setSelectedTask={setSelectedTask}
              navigateToTask={navigateToTask}
            />
          ) : (
            <TaskListComponent
              tasks={tasks}
              searchTerm={searchTerm}
              currentPage={currentPage}
              pageCount={pageCount}
              setCurrentPage={setCurrentPage}
              handleStatusChange={handleStatusChange}
              user={user}
              setSelectedTask={setSelectedTask}
              navigateToTask={navigateToTask}
            />
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

      <VerificationModal
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        handleVerify={handleVerify}
        verificationImage={verificationImage}
        setVerificationImage={setVerificationImage}
        verificationStatus={verificationStatus}
        verificationResult={verificationResult}
        reward={reward}
      />
    </div>
  )
}