"use client";

import { useEffect } from "react";
import { ClientWebsocketDaemon } from "./websocket";

export default function Home() {
  useEffect(() => {
    ClientWebsocketDaemon.start();
    return () => {
      ClientWebsocketDaemon.stop();
    };
  }, []);

  return (
    <main>
      <h1>Chat list</h1>
    </main>
  );
}
