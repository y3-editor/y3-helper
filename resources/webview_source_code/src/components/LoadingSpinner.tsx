import { VscLoading } from 'react-icons/vsc';

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center">
      <VscLoading className="w-4 h-4 animate-spin text-blue-500" />
    </div>
  );
};

export default LoadingSpinner;
