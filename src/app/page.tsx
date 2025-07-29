"use client";

import { useEffect } from "react";
import { ideCore } from "@/core";
import { IDECanvas } from "@/components/layout/IDECanvas";

export default function Home() {
  useEffect(() => {
    console.log("IDE Core Status:", ideCore.getStatus());
  }, []);

  return <IDECanvas />;
}
