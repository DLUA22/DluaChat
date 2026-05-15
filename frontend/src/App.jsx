import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SplashScreen from "./pages/SplashScreen";

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        {showSplash && (
          <SplashScreen key="splash" onFinish={() => setShowSplash(false)} />
        )}
      </AnimatePresence>
      {!showSplash && (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
export default App;