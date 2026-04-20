const StatsCard = ({ title, value, icon, color = 'border-red-600', subtitle, onClick }) => {
  const baseClass = `bg-white rounded-xl shadow-sm border-l-4 ${color} p-5 ${
    onClick ? 'cursor-pointer hover:shadow-md transition-shadow w-full text-left' : ''
  }`;

  const content = (
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
      {icon && (
        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-red-50`}>
          <i className={`fas ${icon} text-red-600 text-xl`}></i>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return <button type="button" className={baseClass} onClick={onClick}>{content}</button>;
  }

  return <div className={baseClass}>{content}</div>;
};

export default StatsCard;
