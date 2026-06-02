export default function Navbar({ onMenuClick }) {
  return (
    <header className="lg:hidden bg-primary-700 text-white px-4 py-3 flex items-center gap-3 shadow-md z-10">
      <button onClick={onMenuClick} className="text-white p-1 rounded hover:bg-primary-600">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span className="font-bold text-sm">Sugathadasa & Sons SMS</span>
    </header>
  );
}
