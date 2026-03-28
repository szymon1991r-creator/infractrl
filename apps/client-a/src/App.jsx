import React from 'react';

const App = () => {
  const accentColor = import.meta.env.VITE_ACCENT_COLOR || '#0ea5e9';
  const clientId = import.meta.env.VITE_CLIENT_ID || 'A';

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Navigation */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tighter">INFRACTRL <span style={{color: accentColor}}>| PORTAL</span></h1>
          <div className="space-x-6 text-sm uppercase tracking-widest">
            <a href="#" className="hover:opacity-75">Home</a>
            <a href="#" className="hover:opacity-75">Services</a>
            <a href="#" className="hover:opacity-75">Contact</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative py-24 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{color: accentColor}}>Client ID: {clientId}</p>
          <h2 className="text-5xl font-black mb-6 leading-tight">PREMIUM SOLUTIONS<br/>FOR YOUR BUSINESS.</h2>
          <button 
            className="px-8 py-3 text-white font-bold transition-transform hover:scale-105"
            style={{backgroundColor: accentColor}}
          >
            DISCOVER MORE
          </button>
        </div>
      </header>

      {/* Grid Section */}
      <main className="max-w-7xl mx-auto py-16 px-4 grid md:grid-cols-3 gap-8">
        {[1, 2, 3].map((item) => (
          <div key={item} className="group cursor-pointer">
            <div className="aspect-[4/5] bg-gray-200 mb-4 overflow-hidden relative">
               <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold italic text-4xl">IMAGE</div>
            </div>
            <h3 className="text-lg font-bold group-hover:underline">PRODUCT CATEGORY 0{item}</h3>
            <p className="text-gray-500 text-sm mt-1">High-quality infrastructure management tools.</p>
          </div>
        ))}
      </main>
    </div>
  );
};

export default App;
