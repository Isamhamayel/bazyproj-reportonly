import { Badge } from "./ui/badge";

interface DeviceStatusBadgeProps {
  status?: 'online' | 'offline' | 'idle' | string;
}

export function DeviceStatusBadge({ status }: DeviceStatusBadgeProps) {
  const variants = {
    online: { className: "bg-green-100 text-green-700 border-green-200", label: "Online" },
    offline: { className: "bg-gray-100 text-gray-700 border-gray-200", label: "Offline" },
    idle: { className: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Idle" },
  };

  // Default to 'offline' if status is undefined or unknown
  const normalizedStatus = (status && status in variants ? status : 'offline') as keyof typeof variants;
  const variant = variants[normalizedStatus];

  return (
    <Badge variant="outline" className={variant.className}>
      <span className={`w-2 h-2 rounded-full mr-2 ${
        normalizedStatus === 'online' ? 'bg-green-500' : normalizedStatus === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'
      }`} />
      {variant.label}
    </Badge>
  );
}