import BleTest from "@/components/BleTest";
import ControlPanel from "@/components/ControlPanel";


export default function Home() {

  return (
    <main className="min-h-screen">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">        
        <BleTest />
        <ControlPanel mode="free-ride" />
      </div>
    </main>
  );
}
