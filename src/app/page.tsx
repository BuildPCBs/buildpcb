"use client";

import { useEffect } from "react";
import { ideCore } from "@/core";

export default function Home() {
  useEffect(() => {
    console.log("IDE Core Status:", ideCore.getStatus());
  }, []);

  return null;
}
