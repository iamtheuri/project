// @ts-nocheck
'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'

interface DatePickerWithRangeProps {
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  className?: string
}

export function DatePickerWithRange({
  date,
  setDate,
  className
}: DatePickerWithRangeProps) {
  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      console.log("Selected date range:", range);
      setDate(range);
    }, [setDate]
  );

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={new Date()}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={false}
            classNames={{
              day: "w-9 h-9 text-sm aria-selected:opacity-100",
              head_cell: "text-xs font-semibold text-muted-foreground w-9",
              caption: "text-sm font-medium text-center",
              day_selected: "bg-black text-white hover:bg-black",
              day_range_start: "bg-black text-white rounded-l-md",
              day_range_end: "bg-black text-white rounded-r-md",
              day_range_middle: "bg-muted text-foreground",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}