import { createFileRoute } from "@tanstack/react-router";
import { ModelerApp } from "@/components/eq/ModelerApp";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <ModelerApp />;
}
