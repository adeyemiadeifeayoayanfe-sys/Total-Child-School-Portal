import React, { useEffect, useMemo, useRef, useState } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
  id?: string;
  name?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDate = (value: string) => {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
  className = '',
  id,
  name,
}: DatePickerProps) {
  const selectedDate = parseDate(value);
  const minimumDate = parseDate(minDate || '');
  const maximumDate = parseDate(maxDate || '');

  const today = startOfDay(new Date());

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(
    selectedDate || today
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const years = useMemo(() => {
    const currentYear = today.getFullYear();
    const startYear = Math.min(
      currentYear - 100,
      selectedDate?.getFullYear() || currentYear
    );
    const endYear = Math.max(
      currentYear + 20,
      selectedDate?.getFullYear() || currentYear
    );

    return Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index
    );
  }, [today, selectedDate]);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const previousMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      currentMonth: boolean;
    }> = [];

    for (let i = startOffset - 1; i >= 0; i -= 1) {
      days.push({
        date: new Date(year, month - 1, previousMonthDays - i),
        currentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({
        date: new Date(year, month, day),
        currentMonth: true,
      });
    }

    let nextDay = 1;

    while (days.length < 42) {
      days.push({
        date: new Date(year, month + 1, nextDay),
        currentMonth: false,
      });

      nextDay += 1;
    }

    return days;
  }, [viewDate]);

  const isDisabledDate = (date: Date) => {
    const normalized = startOfDay(date);

    if (minimumDate && normalized < startOfDay(minimumDate)) {
      return true;
    }

    if (maximumDate && normalized > startOfDay(maximumDate)) {
      return true;
    }

    return false;
  };

  const selectDate = (date: Date) => {
    if (isDisabledDate(date)) return;

    onChange(formatDate(date));
    setOpen(false);
  };

  const goToPreviousMonth = () => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
    );
  };

  const setMonth = (month: number) => {
    setViewDate(
      new Date(viewDate.getFullYear(), month, 1)
    );
  };

  const setYear = (year: number) => {
    setViewDate(
      new Date(year, viewDate.getMonth(), 1)
    );
  };

  const goToToday = () => {
    if (!isDisabledDate(today)) {
      onChange(formatDate(today));
      setViewDate(today);
      setOpen(false);
    } else {
      setViewDate(today);
    }
  };

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      <input
        type="hidden"
        id={id}
        name={name}
        value={value}
        readOnly
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        className="form-input flex w-full items-center justify-between gap-3 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue || placeholder}
        </span>

        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="shrink-0 text-gray-500"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 top-full z-[200] mt-2 w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
              aria-label="Previous month"
            >
              ‹
            </button>

            <div className="flex flex-1 gap-2">
              <select
                className="form-select min-w-0 flex-1"
                value={viewDate.getMonth()}
                onChange={(event) => setMonth(Number(event.target.value))}
                aria-label="Month"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                className="form-select w-[92px]"
                value={viewDate.getFullYear()}
                onChange={(event) => setYear(Number(event.target.value))}
                aria-label="Year"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-semibold text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, currentMonth }) => {
              const dateValue = formatDate(date);
              const selected = value === dateValue;
              const todayDate = formatDate(today);
              const isToday = dateValue === todayDate;
              const disabledDate = isDisabledDate(date);

              return (
                <button
                  key={dateValue}
                  type="button"
                  disabled={disabledDate}
                  onClick={() => selectDate(date)}
                  className={[
                    'flex h-9 w-full items-center justify-center rounded-lg text-sm transition',
                    currentMonth
                      ? 'text-gray-800'
                      : 'text-gray-300',
                    selected
                      ? 'bg-blue-600 font-semibold text-white'
                      : '',
                    !selected && isToday
                      ? 'border border-blue-500 font-semibold text-blue-600'
                      : '',
                    !selected && !disabledDate
                      ? 'hover:bg-blue-50'
                      : '',
                    disabledDate
                      ? 'cursor-not-allowed opacity-40'
                      : '',
                  ].join(' ')}
                  aria-label={date.toLocaleDateString()}
                  aria-pressed={selected}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
            >
              Today
            </button>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
