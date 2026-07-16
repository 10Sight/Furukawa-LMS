import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconCalendar, IconFilter, IconChevronDown } from "@tabler/icons-react";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns';

const DashboardDateFilter = ({ onFilterChange }) => {
    const [selectedLabel, setSelectedLabel] = useState('All Time');
    
    const applyFilter = (label, start, end) => {
        setSelectedLabel(label);
        onFilterChange({
            startDate: start ? format(start, 'yyyy-MM-dd') : '',
            endDate: end ? format(end, 'yyyy-MM-dd') : ''
        });
    };

    const filters = [
        { label: 'Today', getValue: () => [startOfDay(new Date()), endOfDay(new Date())] },
        { label: 'Yesterday', getValue: () => [startOfDay(subDays(new Date(), 1)), endOfDay(subDays(new Date(), 1))] },
        { label: 'Last 7 Days', getValue: () => [subDays(new Date(), 7), new Date()] },
        { label: 'Last 30 Days', getValue: () => [subDays(new Date(), 30), new Date()] },
        { label: 'This Month', getValue: () => [startOfMonth(new Date()), endOfMonth(new Date())] },
        { label: 'Last Month', getValue: () => [startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1))] },
        { label: 'All Time', getValue: () => ['', ''] }
    ];

    // Initialize with All Time on mount — no default date range shown or applied
    useEffect(() => {
        const allTime = filters.find(f => f.label === 'All Time').getValue();
        applyFilter('All Time', allTime[0], allTime[1]);
    }, []);

    return (
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    <IconCalendar className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Dashboard Timeline</h3>
                    <p className="text-xs text-gray-500">Filter all charts and statistics</p>
                </div>
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2 border-2 hover:bg-gray-50 font-medium">
                        <IconFilter className="h-4 w-4 text-blue-600" />
                        {selectedLabel}
                        <IconChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                    {filters.map((filter) => (
                        <DropdownMenuItem 
                            key={filter.label}
                            onClick={() => {
                                const [start, end] = filter.getValue();
                                applyFilter(filter.label, start, end);
                            }}
                            className={selectedLabel === filter.label ? 'bg-blue-50 text-blue-700 font-medium' : ''}
                        >
                            {filter.label}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="text-xs text-gray-400">
                        Custom Range (Available soon)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

export default DashboardDateFilter;
