import { useEffect } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { SectorGrid } from "./components/SectorGrid";
import { connectSocket } from "./services/socket";

export default function App() {
  useEffect(() => {
    const close = connectSocket();
    return close;
  }, []);

  return (
    <div className="min-h-screen flex flex-col max-w-[1200px] mx-auto bg-gray-50 shadow-md">
      <Header />
      <main className="flex-1">
        <SectorGrid />
      </main>
      <Footer />
    </div>
  );
}
