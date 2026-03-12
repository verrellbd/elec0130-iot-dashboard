// components/dashboard/ActuatorCard.jsx
export default function ActuatorCard({ name, icon, status, onToggle }) {
  const isOn = status === "ON";
  
  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors ${isOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          {icon}
        </div>
        <div>
          <div className="text-[13px] font-bold text-[#1a1d26]">{name}</div>
          <div className="text-[10px] text-[#8b93a7] font-medium uppercase tracking-wider">
            {isOn ? "Active" : "Standby"}
          </div>
        </div>
      </div>
      
    
      <button 
        type="button"
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-all relative ${isOn ? 'bg-green-500' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isOn ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}