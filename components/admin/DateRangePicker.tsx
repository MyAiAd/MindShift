'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  onRangeChange: (range: string) => void;
  defaultRange?: string;
}

export default function DateRangePicker({
  onRangeChange,
  defaultRange = '7days',
}: DateRangePickerProps) {
  const [selectedRange, setSelectedRange] = useState(defaultRange);

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    onRangeChange(value);
  };

  return (
    <Select value={selectedRange} onValueChange={handleRangeChange}>
      <SelectTrigger className="w-[180px]">
        <Calendar className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="7days">Last 7 Days</SelectItem>
        <SelectItem value="30days">Last 30 Days</SelectItem>
        <SelectItem value="90days">Last 90 Days</SelectItem>
        <SelectItem value="1year">Last Year</SelectItem>
        <SelectItem value="all">All Time</SelectItem>
      </SelectContent>
    </Select>
  );
}
