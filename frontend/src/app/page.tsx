import { CallInterface } from "@/components/CallInterface";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            <span className="text-brand-500">CareAI</span> Health
          </h1>
          <p className="text-sm text-white/40 mt-0.5">AI Front Desk · Powered by Gemini + LiveKit</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </header>

      <CallInterface />
    </main>
  );
}
