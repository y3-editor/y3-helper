import React from 'react';
import {
  Input,
  Box,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useDisclosure,
  useOutsideClick,
} from '@chakra-ui/react';
import {
  Calendar,
  CalendarDate,
  CalendarValues,
  CalendarControls,
  CalendarPrevButton,
  CalendarNextButton,
  CalendarMonths,
  CalendarMonth,
  CalendarMonthName,
  CalendarWeek,
  CalendarDays,
} from '@uselessdev/datepicker';
import { isValid, format } from 'date-fns';
import styles from './index.module.scss';

interface DatePicker {
  value?: number;
  placeholder?: string;
  inputStyles?: React.CSSProperties;
  onChange?: (value?: number) => void;
  disablePastDates?: boolean | Date;
}

const Datepicker = (props: DatePicker) => {
  const {
    value,
    onChange,
    disablePastDates,
    placeholder = '请选择日期',
    inputStyles,
  } = props;
  const [date, setDate] = React.useState<CalendarDate | CalendarValues>();
  const [inputValue, setInputValue] = React.useState('');

  const initialRef = React.useRef(null);
  const calendarRef = React.useRef(null);

  React.useEffect(() => {
    if (value) {
      const newDate = new Date(value * 1000);
      setDate(newDate);
      setInputValue(format(newDate as Date, 'MM/dd/yyyy'));
    } else {
      setDate(undefined);
      setInputValue('');
    }
  }, [value]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const match = (val: string) => val.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const handleInputChange = ({
    target,
  }: React.ChangeEvent<HTMLInputElement>) => {
    const val = target.value;
    setInputValue(val);
    if (!val) {
      onChange?.();
      onClose();
      return;
    }
    if (match(val)) {
      onClose();
    }
  };

  const handleSelectDate = (date: CalendarDate | CalendarValues) => {
    if (!isValid(date)) return;
    onChange?.(Math.floor((date as Date).valueOf() / 1000));
    onClose();
  };

  useOutsideClick({
    ref: calendarRef,
    handler: onClose,
    enabled: isOpen,
  });

  return (
    <Popover
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={initialRef}
      isLazy
    >
      <PopoverTrigger>
        <Box onClick={onOpen} ref={initialRef}>
          <Input
            style={inputStyles}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
          />
        </Box>
      </PopoverTrigger>
      <PopoverContent
        border="none"
        outline="none"
        _focus={{ boxShadow: 'none' }}
        ref={calendarRef}
        className={styles['wrapper']}
      >
        <Calendar
          value={{ start: date as CalendarDate }}
          onSelectDate={handleSelectDate}
          singleDateSelection
          disablePastDates={disablePastDates}
        >
          <PopoverBody p={0}>
            <CalendarControls>
              <CalendarPrevButton />
              <CalendarNextButton />
            </CalendarControls>

            <CalendarMonths>
              <CalendarMonth>
                <CalendarMonthName />
                <CalendarWeek />
                <CalendarDays />
              </CalendarMonth>
            </CalendarMonths>
          </PopoverBody>
        </Calendar>
      </PopoverContent>
    </Popover>
  );
};

export default Datepicker;
