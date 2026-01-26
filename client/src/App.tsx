import React from 'react';
import LobbyPage from './pages/LobbyPage';
import MeetingPage from './pages/MeetingPage';
import { useMeetingStore } from './store/useMeetingStore';

const App: React.FC = () => {
  const { roomId } = useMeetingStore();

  return (
    <div className="h-screen w-screen bg-[#202124] text-white overflow-hidden">
      {!roomId ? <LobbyPage /> : <MeetingPage />}
    </div>
  );
};

export default App;
