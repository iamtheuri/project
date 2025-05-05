// @ts-nocheck
import { useState } from 'react'
import { Trash2, MapPin, Clock, Weight, Calendar, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './StatusBadge'

interface CollectionTask {
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

interface TaskListProps {
  tasks: CollectionTask[]
  searchTerm: string
  currentPage: number
  pageCount: number
  setCurrentPage: (page: number) => void
  handleStatusChange: (taskId: number, newStatus: CollectionTask['status']) => Promise<void>
  user: { id: number; email: string; name: string } | null
  setSelectedTask: (task: CollectionTask | null) => void
  navigateToTask: (task: CollectionTask) => void
}

export const TaskListComponent = ({
  tasks,
  searchTerm,
  currentPage,
  pageCount,
  setCurrentPage,
  handleStatusChange,
  user,
  setSelectedTask,
  navigateToTask
}: TaskListProps) => {
  const [hoveredWasteType, setHoveredWasteType] = useState<string | null>(null)
  const ITEMS_PER_PAGE = 5

  const filteredTasks = tasks.filter(task =>
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
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
                  <Button
                    onClick={() => navigateToTask(task)}
                    variant="outline"
                    size="sm"
                    className="mr-2"
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Navigate
                  </Button>
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
  )
}