export interface TimelineEvent {
  id: number;
  year: number;
  label: string; // Title of the work
  artist?: string; // Artist name
  description?: string;
  imageUrl?: string; // Placeholder or link
}

export interface ArtMovement {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  lane: number; // Vertical stacking order
  eraId: string;
}

export interface EraColumn {
  id: string;
  title: string;
  colorHeader: string; // Tailwind class or Hex
  colorBackground: string; // Hex for canvas bg
  colorHex: string; // Explicit Hex for UI consistency
  borderColor: string;
  startYear: number;
  endYear: number; 
  events: TimelineEvent[];
}

export interface Viewport {
  startYear: number;
  endYear: number;
}