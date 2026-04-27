import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Folio Chat App
        </h1>
        <p className="text-muted-foreground max-w-[600px]">
          Welcome to your new MERN chat application. 
          TypeScript, Tailwind CSS, Redux, and Shadcn UI are now configured.
        </p>
        <div className="flex gap-4 justify-center">
          <code className="bg-muted px-2 py-1 rounded">src/app/app.tsx</code>
        </div>
      </header>
    </div>
  );
}

export default App;
