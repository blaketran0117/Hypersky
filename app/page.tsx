import DataFeed from "@/components/DataFeed";
import FlightList from "@/components/FlightList";
import FlightPanel from "@/components/FlightPanel";
import FlightMap from "@/components/Map/FlightMap";
import StatsBar from "@/components/StatsBar";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#05070a]">
      <FlightMap />
      <StatsBar />
      <FlightList />
      <FlightPanel />
      <DataFeed />
    </main>
  );
}
