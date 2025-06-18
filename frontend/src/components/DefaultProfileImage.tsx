export default function DefaultProfileImage() {
  return (
    <div className="w-24 h-24 rounded-full bg-[#1F1B24] flex items-center justify-center border border-[#2C2C2C] shadow-md">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-10 text-[#8A6EFF]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 14c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 2c-2.67 0-8 1.33-8 4v1h16v-1c0-2.67-5.33-4-8-4z"
        />
      </svg>
    </div>
  );
} 